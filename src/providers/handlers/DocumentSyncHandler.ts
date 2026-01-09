import * as vscode from "vscode";
import { getService, MessageService, OutputService } from "../../services";
import {
  DocumentSyncStatusMessage,
  DocumentDiagnosticsMessage,
  DocumentContentMessage,
  DocumentContentChangedMessage,
} from "../../types";

/**
 * Handler for synchronizing document content between the custom editor webview and VS Code text document.
 */
export interface DocumentSyncHandler {
  handleDocumentContentChanged(
    message: DocumentContentChangedMessage
  ): Promise<void>;

  startDiagnosticMonitoring(): void;

  stopDiagnosticMonitoring(): void;
}

export class DocumentSyncHandlerImpl
  extends vscode.Disposable
  implements DocumentSyncHandler
{
  private syncTimeout: NodeJS.Timeout | undefined;
  private diagnosticListener: vscode.Disposable | undefined;
  private readonly messageService: MessageService;
  private readonly outputService: OutputService;

  constructor(
    readonly context: vscode.ExtensionContext,
    private readonly document: vscode.TextDocument
  ) {
    super(() => {
      this.stopDiagnosticMonitoring();

      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = undefined;
      }
    });

    this.outputService = getService(OutputService);
    this.messageService = getService(MessageService);

    this.loadLastSavedContent();
  }

  async handleDocumentContentChanged(
    message: DocumentContentChangedMessage
  ): Promise<void> {
    const { content, version, delta } = message.payload;

    try {
      // Check version to prevent conflicts
      if (version < this.document.version) {
        this.outputService.writeToOutput(
          `Ignoring outdated content change for document ${this.document.uri.toString()}. Current version: ${
            this.document.version
          }, Received version: ${version}`,
          "WARNING"
        );
        return;
      }

      // Clear any pending sync for this document
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
      }

      // Set a new timeout to debounce rapid changes
      this.syncTimeout = setTimeout(async () => {
        try {
          if (delta) {
            // Apply delta update
            await this.applyDeltaToDocument(delta);
          } else {
            // Fallback to full content replacement
            await this.syncContentToDocument(content);
          }
          await this.saveContent();
          this.syncTimeout = undefined;

          // Notify webview of successful sync
          const statusMessage: DocumentSyncStatusMessage = {
            type: "ext.documentSyncStatus",
            payload: { synced: true },
          };
          this.messageService.invoke(statusMessage);
        } catch (error) {
          this.outputService.showError(
            `Error syncing content for document ${this.document.uri.toString()}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );

          // Notify webview of sync error
          const statusMessage: DocumentSyncStatusMessage = {
            type: "ext.documentSyncStatus",
            payload: {
              synced: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
          };
          this.messageService.invoke(statusMessage);
        }
      }, 300); // 300ms debounce time
    } catch (error) {
      this.outputService.showError(
        `Error handling content change for document ${this.document.uri.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Notify webview of sync error
      const statusMessage: DocumentSyncStatusMessage = {
        type: "ext.documentSyncStatus",
        payload: {
          synced: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
      this.messageService.invoke(statusMessage);
    }
  }

  private async syncContentToDocument(content: string): Promise<void> {
    // Create a workspace edit to update the document
    const edit = new vscode.WorkspaceEdit();

    // Replace the entire document content
    const fullRange = new vscode.Range(
      this.document.positionAt(0),
      this.document.positionAt(this.document.getText().length)
    );

    edit.replace(this.document.uri, fullRange, content);

    // Apply the edit
    const success = await vscode.workspace.applyEdit(edit);

    if (!success) {
      throw new Error("Failed to apply workspace edit");
    }
  }

  private async applyDeltaToDocument(delta: {
    from: number;
    to: number;
    insert: string;
  }): Promise<void> {
    // Create a workspace edit to apply the delta
    const edit = new vscode.WorkspaceEdit();

    // Convert character positions to VS Code positions
    const fromPosition = this.document.positionAt(delta.from);
    const toPosition = this.document.positionAt(delta.to);
    const range = new vscode.Range(fromPosition, toPosition);

    // Apply the delta as a replacement
    edit.replace(this.document.uri, range, delta.insert);

    // Apply the edit
    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
      console.debug(
        `Document delta applied successfully (version ${this.document.version}): ` +
          `[${delta.from}-${delta.to}] -> "${delta.insert}"`
      );
    } else {
      throw new Error("Failed to apply delta workspace edit");
    }
  }

  async saveContent(): Promise<void> {
    // Skip saving for untitled documents to avoid filesystem errors
    if (this.document.uri.scheme === "untitled") {
      console.debug(
        "Skipping save for untitled document:",
        this.document.uri.toString()
      );
      return;
    }

    try {
      const enc = new TextEncoder();
      await vscode.workspace.fs.writeFile(
        this.document.uri,
        enc.encode(this.document.getText())
      );
    } catch (error) {
      this.outputService.showError(
        `Failed to save document ${this.document.uri.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async loadLastSavedContent(): Promise<void> {
    try {
      this.outputService.writeToOutput(
        `Loading last saved content for document: ${this.document.uri.toString()}`,
        "INFO"
      );
      const content = await vscode.workspace.fs.readFile(this.document.uri);
      const text = new TextDecoder().decode(content);
      await this.syncContentToDocument(text);
      const documentContentMessage: DocumentContentMessage = {
        type: "ext.documentContent",
        payload: {
          content: text,
          version: this.document.version,
        },
      };
      this.messageService.invoke(documentContentMessage);
    } catch (error) {
      this.outputService.showError(
        `Failed to load last saved content for document ${this.document.uri.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  startDiagnosticMonitoring(): void {
    const documentKey = this.document.uri.toString();

    // Stop any existing monitoring for this document
    this.stopDiagnosticMonitoring();

    // Monitor diagnostic changes for this document
    const diagnosticListener = vscode.languages.onDidChangeDiagnostics((e) => {
      // Check if the change is for our document
      const relevantUri = e.uris.find((uri) => uri.toString() === documentKey);
      if (relevantUri) {
        // Get current diagnostics for the document
        const diagnostics = vscode.languages.getDiagnostics(this.document.uri);
        this.sendDiagnosticsToClient(diagnostics);
      }
    });

    this.diagnosticListener = diagnosticListener;

    // Send initial diagnostics
    const initialDiagnostics = vscode.languages.getDiagnostics(
      this.document.uri
    );
    this.sendDiagnosticsToClient(initialDiagnostics);
  }

  stopDiagnosticMonitoring(): void {
    if (this.diagnosticListener) {
      this.diagnosticListener.dispose();
      this.diagnosticListener = undefined;
    }
  }

  private sendDiagnosticsToClient(
    diagnostics: readonly vscode.Diagnostic[]
  ): void {
    const diagnosticMessage: DocumentDiagnosticsMessage = {
      type: "ext.documentDiagnostics",
      payload: {
        diagnostics: diagnostics.map((diag) => ({
          range: {
            start: {
              line: diag.range.start.line,
              character: diag.range.start.character,
            },
            end: {
              line: diag.range.end.line,
              character: diag.range.end.character,
            },
          },
          severity: this.convertSeverity(diag.severity),
          message: diag.message,
          source: diag.source,
          code: typeof diag.code === "object" ? diag.code.value : diag.code,
        })),
      },
    };
    this.messageService.invoke(diagnosticMessage);
  }

  private convertSeverity(severity: vscode.DiagnosticSeverity): 1 | 2 | 3 | 4 {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 1;
      case vscode.DiagnosticSeverity.Warning:
        return 2;
      case vscode.DiagnosticSeverity.Information:
        return 3;
      case vscode.DiagnosticSeverity.Hint:
        return 4;
      default:
        return 1; // Default to error
    }
  }
}
