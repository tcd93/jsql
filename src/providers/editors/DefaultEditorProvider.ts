import * as vscode from "vscode";
import { getService, MetadataCacheService } from "../../services";
import { ConnectionProfile, ExtensionToWebviewMessage } from "../../types";
import { findQueryRangeAtCursor } from "../../utils";
import { SqlCodeLensProvider } from "../SqlCodeLensProvider";
import { SqlCompletionProvider } from "../SqlCompletionProvider";
import { BaseEditorProvider } from "./BaseEditorProvider";

export class DefaultEditorProvider extends BaseEditorProvider {
  private completionProvider: SqlCompletionProvider | undefined;
  private readonly codeLensProvider: SqlCodeLensProvider | undefined;
  private readonly metadataCacheService: MetadataCacheService;

  constructor(context: vscode.ExtensionContext) {
    super(context);

    this.metadataCacheService = getService(MetadataCacheService);

    // map handlers to the dispatcher
    this.messageService.registerHandler("wv.findMatchingTables", (message) => {
      const document = this.getFocusedContext();
      if (!document) {
        this.outputService.showWarning("No active editor found");
        return;
      }
      this.findMatchingTablesHandler.findMatchingTables(
        message.payload.uniqueColumnNames,
        document
      );
    });

    this.messageService.registerHandler(
      "wv.generateSmartDrillQuery",
      (message) => {
        this.generateSmartDrillQueryHandler.generateSmartDrillQueryForTable(
          message.payload.selectedTable,
          message.payload.selectedCells
        );
      }
    );

    this.messageService.registerHandler(
      "ext.smartDrillQueryGenerated",
      (message) => {
        this.appendTextToDocument(message.payload.query);
      }
    );
    this.messageService.registerHandler("ext.smartDrillError", (message) => {
      this.outputService.showError(
        `Smart Drill Error: ${message.payload.error}`
      );
    });

    // Handle connection changes
    this.messageService.registerHandler(
      "wv.getSchemaData",
      async (_message) => {
        const document = this.getFocusedContext();
        if (!document) {
          this.outputService.showWarning("No active editor found");
          return;
        }
        await this.getSchemaDataHandler.handle(document);
      }
    );

    // Triggered on connection select / change
    this.messageService.registerHandler("ext.schemaDataFound", (_message) => {
      // Initialize completion provider
      this.completionProvider ??= new SqlCompletionProvider(
        this.metadataCacheService,
        this.profileService
      );

      // Register completion provider for SQL files (matching the j.sql pattern used by this extension)
      context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
          [
            { language: "sql", scheme: "untitled" },
            { language: "sql", scheme: "file" },
          ],
          this.completionProvider
        )
      );
    });

    this.messageService.registerHandler("ext.schemaDataError", (message) => {
      this.outputService.showError(
        `Failed to retrieve schema data: ${message.payload.error}`
      );
      if (message.payload.profile) {
        this.metadataCacheService.clearSchemaData(message.payload.profile);
      }
    });

    this.messageService.registerHandler("ext.documentDiagnostics", (_) => {
      // No need to handle diagnostics in default editor
    });

    this.messageService.registerHandler("ext.documentSyncStatus", (message) => {
      if (!message.payload.synced) {
        vscode.window.setStatusBarMessage("Document not synced", 3000);
      }
    });

    this.messageService.registerHandler("ext.documentContent", (message) => {
      const document = this.getFocusedContext();
      if (!document) {
        this.outputService.showWarning("No active editor found");
        return;
      }
      // overwrite the entire document content
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, fullRange, message.payload.content);
      vscode.workspace.applyEdit(edit);
    });

    const codeLensEnabled = vscode.workspace
      .getConfiguration("jSql.codeLens")
      .get<boolean>("enabled", true);

    if (codeLensEnabled) {
      this.codeLensProvider = new SqlCodeLensProvider(
        this.executeStreamingQueryHandler.executeStreamingQuery.bind(
          this.executeStreamingQueryHandler
        ),
        context
      );

      context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
          [
            { language: "sql", scheme: "untitled" },
            { language: "sql", scheme: "file" },
          ],
          this.codeLensProvider
        )
      );

      // Refresh CodeLens on query state changes
      this.queryStateManager.onStateChange((_) => {
        this.codeLensProvider?.refresh();
      });
    }

    vscode.workspace.textDocuments.forEach((document) => {
      if (document.languageId === "sql") {
        this.setUpDocument(document);
      }
    });

    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === "sql") {
          this.setUpDocument(document);
        }
      }),
      vscode.workspace.onDidCloseTextDocument(async (document) => {
        if (document.languageId === "sql") {
          await this.handleDocumentClose(document);
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((_) => {
        this.updateStatusBarForFocusedContext();
        // Notify webview that editor focus has changed to close any open context menus
        this.messageService.invoke({
          type: "ext.editorFocusChanged",
          payload: undefined,
        });
      }),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        // Close context menus when user clicks in the editor (mouse interaction)
        if (event.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
          this.messageService.invoke({
            type: "ext.editorFocusChanged",
            payload: undefined,
          });
        }
      })
    );
  }

  async openEditor(): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      language: "sql",
      content: "",
    });
    const editor = await vscode.window.showTextDocument(document);
    this.setUpDocument(editor.document);
  }

  setUpDocument(document: vscode.TextDocument): void {
    this.registerContext(document);
    this.statusBarService.displayConnectionStatus("Disconnected");
    vscode.commands.executeCommand("setContext", "jSqlEditorActive", true);
  }

  private async handleDocumentClose(
    document: vscode.TextDocument
  ): Promise<void> {
    // Cancel any active queries for this document before closing
    const activeQueries = Array.from(
      this.queryStateManager.queryStates.values()
    )
      .filter(
        (queryState) =>
          queryState.status === "running" &&
          queryState.documentUri?.toString() === document.uri.toString()
      )
      .map((queryState) => queryState.queryId);

    for (const queryId of activeQueries) {
      this.queryStateManager.cancelQuery(queryId);
    }

    const connectionInfo = this.profileService.getConnectionStatus(document);
    const profile = await this.profileService.getActiveConnection(document);

    if (
      profile &&
      profile.provider !== "None" &&
      (connectionInfo === "Connected" || connectionInfo === "Connecting")
    ) {
      try {
        await this.connectionService.closeConnection(profile, document);
      } catch (error) {
        console.error(
          `Failed to close connection for document ${document.uri.toString()}:`,
          error
        );
      }
    }

    this.profileService.removeContext(document);
  }

  async executeAllQueries(): Promise<void> {
    const document = this.getFocusedContext();
    if (!document) {
      this.outputService.showWarning("No active editor found");
      return;
    }

    const text = document.getText().trim();
    if (!text) {
      this.outputService.showWarning("No query to execute");
      return;
    }
    for (const query of this.splitTextAtKeyword(text)) {
      await this.executeStreamingQueryHandler.executeStreamingQuery(
        crypto.randomUUID(),
        query,
        document
      );
    }
  }

  async executeQueryAtCursor(
    connectionProfile?: ConnectionProfile
  ): Promise<void> {
    const document = this.getFocusedContext();
    if (!document) {
      this.outputService.showWarning("No active editor found");
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor?.document !== document) {
      this.outputService.showWarning("No active editor found");
      return;
    }

    const selection = editor.selection;

    // If there's selected text, execute that
    if (!selection.isEmpty) {
      const text = document.getText(selection).trim();
      if (!text) {
        this.outputService.showWarning("No query to execute");
        return;
      }
      for (const query of this.splitTextAtKeyword(text)) {
        await this.executeStreamingQueryHandler.executeStreamingQuery(
          crypto.randomUUID(),
          query,
          document,
          selection,
          connectionProfile
        );
      }
    } else {
      // If no selection, find the query at cursor position
      const cursorPosition = document.offsetAt(editor.selection.active);
      const fullText = document.getText();
      const queryRange = findQueryRangeAtCursor(fullText, cursorPosition);
      if (!queryRange) {
        return;
      }
      const selection = new vscode.Selection(
        document.positionAt(queryRange.from),
        document.positionAt(queryRange.to)
      );
      await this.executeStreamingQueryHandler.executeStreamingQuery(
        crypto.randomUUID(),
        queryRange.query,
        document,
        selection,
        connectionProfile
      );
    }
  }

  appendTextToDocument(text: string): void {
    const document = this.getFocusedContext();
    if (!document) {
      this.outputService.showWarning("No active editor found");
      return;
    }
    const edit = new vscode.WorkspaceEdit();

    // Get the last position in the document
    const lastLineIndex = Math.max(0, document.lineCount - 1);
    const lastLine = document.lineAt(lastLineIndex);
    const position = lastLine.range.end;

    // Add a newline before the text if the document is not empty and doesn't end with a newline
    const textToInsert =
      document.getText().length > 0 && !document.getText().endsWith("\n")
        ? `\n${text}`
        : text;

    edit.insert(document.uri, position, textToInsert);
    vscode.workspace.applyEdit(edit);
  }

  dispose(): void {
    // Completion provider now gets data directly from cache service
  }

  getFocusedContext(): vscode.TextDocument | undefined {
    return vscode.window.activeTextEditor?.document;
  }

  async notifyCustomEditor(_message: ExtensionToWebviewMessage): Promise<void> {
    // default editor does not need bridge to communicate
    return;
  }
}
