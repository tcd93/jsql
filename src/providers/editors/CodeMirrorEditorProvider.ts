import * as vscode from "vscode";
import {
  ConnectionProfile,
  ExecuteQueryMessage,
  ExtensionToWebviewMessage,
} from "../../types";
import { DocumentSyncHandler } from "../handlers";
import { BaseEditorProvider } from "./BaseEditorProvider";

export class CodeMirrorEditorProvider
  extends BaseEditorProvider
  implements vscode.CustomTextEditorProvider
{
  private readonly webviewPanels: Map<
    vscode.WebviewPanel,
    vscode.TextDocument
  > = new Map();

  protected readonly documentSyncHandlers = new Map<
    vscode.TextDocument,
    DocumentSyncHandler
  >();

  private readonly extensionUri: vscode.Uri;

  constructor(context: vscode.ExtensionContext) {
    super(context);

    this.extensionUri = context.extensionUri;

    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider("jSql.editor", this, {
        supportsMultipleEditorsPerDocument: true,
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      })
    );
  }

  /**
   * Called when our custom editor is opened.
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.registerContext(document);
    this.webviewPanels.set(webviewPanel, document);

    // Force LF once when the editor opens
    // THIS IS VERY IMPORTANT TO PROPERLY SYNC CONTENTS WITH CODEMIRROR
    const edit = new vscode.WorkspaceEdit();
    edit.set(document.uri, [vscode.TextEdit.setEndOfLine(vscode.EndOfLine.LF)]);
    vscode.workspace.applyEdit(edit).then((success) => {
      if (success) {
        console.debug("Successfully set end of line to LF");
      } else {
        console.error("Failed to set end of line to LF");
      }
    });

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    const dataViewType = "editor";
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      dataViewType
    );

    // map handlers to the dispatcher
    this.messageService.registerHandler(
      "wv.executeStreamingQuery",
      (message) => {
        this.executeStreamingQueryHandler.handleExecuteStreamingQuery(
          message.payload,
          document
        );
      }
    );
    this.messageService.registerHandler("wv.findMatchingTables", (message) => {
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
        this.notifyCustomEditor(message);
      }
    );
    this.messageService.registerHandler("ext.smartDrillError", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("ext.exportDataSuccess", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("ext.exportDataError", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("wv.getSchemaData", (_message) => {
      this.getSchemaDataHandler.handle(document);
    });

    this.messageService.registerHandler("ext.schemaDataFound", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("ext.schemaDataError", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("ext.connectionChanged", (message) => {
      this.notifyCustomEditor(message);
    });

    // Add missing streaming query event handlers
    this.messageService.registerHandler(
      "ext.streamingQuerySchema",
      (message) => {
        this.notifyCustomEditor(message);
      }
    );
    this.messageService.registerHandler("ext.streamingQueryData", (message) => {
      this.notifyCustomEditor(message);
    });
    this.messageService.registerHandler(
      "ext.streamingQueryComplete",
      (message) => {
        this.notifyCustomEditor(message);
      }
    );
    this.messageService.registerHandler(
      "ext.streamingQueryError",
      (message) => {
        this.notifyCustomEditor(message);
      }
    );

    this.messageService.registerHandler(
      "ext.smartDrillTablesFound",
      (message) => {
        this.notifyCustomEditor(message);
      }
    );

    this.messageService.registerHandler(
      "wv.documentContentChanged",
      (message) => {
        const documentSyncHandler = this.documentSyncHandlers.get(document);
        documentSyncHandler?.handleDocumentContentChanged(message);
      }
    );

    this.messageService.registerHandler("ext.documentSyncStatus", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler(
      "ext.documentDiagnostics",
      (message) => {
        this.notifyCustomEditor(message);
      }
    );

    this.messageService.registerHandler("ext.documentContent", (message) => {
      this.notifyCustomEditor(message);
    });

    // Add status bar aggregation handlers
    this.messageService.registerHandler(
      "wv.updateStatusBarAggregation",
      (message) => {
        this.statusBarService.displayAggregationMetrics(message.payload);
      }
    );

    this.messageService.registerHandler("wv.clearStatusBarAggregation", () => {
      this.statusBarService.hideAggregationMetrics();
    });

    // Receive message from the webview.
    webviewPanel.webview.onDidReceiveMessage((message) => {
      this.messageService.invoke(message);
    });

    // Show status bar when switched from default editors to custom editor
    // Change display connection status based on active editor
    webviewPanel.onDidChangeViewState((event) => {
      this.updateStatusBarForFocusedContext();
      const documentSyncHandler = this.documentSyncHandlers.get(document);

      if (event.webviewPanel.visible) {
        documentSyncHandler?.startDiagnosticMonitoring();
      } else {
        documentSyncHandler?.stopDiagnosticMonitoring();
      }
    });

    webviewPanel.onDidDispose(() => {
      this.documentSyncHandlers.delete(document);
      this.webviewPanels.delete(webviewPanel);
      // if there are no more webview panels, hide the context and status bar
      if (this.webviewPanels.size === 0) {
        vscode.commands.executeCommand("setContext", "jSqlEditorActive", false);
        this.statusBarService.hideConnectionStatus();
        this.statusBarService.hideQueryStatus();
      }
    });

    this.statusBarService.displayConnectionStatus("Disconnected");
    vscode.commands.executeCommand("setContext", "jSqlEditorActive", true);
  }

  async notifyCustomEditor(message: ExtensionToWebviewMessage): Promise<void> {
    const activePanel = Array.from(this.webviewPanels.keys()).find(
      (panel) => panel.active
    );
    if (activePanel) {
      await activePanel.webview.postMessage(message);
    } else {
      this.outputService.showWarning("No active custom web panel found.");
    }
  }

  async openEditor(): Promise<void> {
    // Create a temporary file in the system temp directory
    const timestamp = Date.now();
    const tempFileName = `Untitled-${timestamp}.j.sql`;

    // Get temp directory path
    const os = await import("os");
    const path = await import("path");
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, tempFileName);

    // Create the file URI
    const uri = vscode.Uri.file(tempFilePath);

    try {
      // Create an empty file
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(uri, encoder.encode(""));

      // Open with custom editor
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        "jSql.editor"
      );
    } catch (error) {
      console.error("Failed to create temporary file:", error);
      // Fallback to untitled document if temp file creation fails
      const untitledUri = vscode.Uri.parse(`untitled:${tempFileName}`);
      await vscode.commands.executeCommand(
        "vscode.openWith",
        untitledUri,
        "jSql.editor"
      );
    }
  }

  async executeAllQueries(): Promise<void> {
    const context = this.getFocusedContext();
    if (!context) {
      this.outputService.showWarning("No active SQL editor found.");
      return;
    }
    const command: ExecuteQueryMessage = {
      type: "ext.executeAllQuery",
      payload: void 0, // No payload needed for this command
    };
    await this.notifyCustomEditor(command);
  }

  async executeQueryAtCursor(
    _connectionProfile?: ConnectionProfile
  ): Promise<void> {
    throw new Error("Not implemented");
  }

  getFocusedContext(): vscode.TextDocument | undefined {
    const activePanel = Array.from(this.webviewPanels.keys()).find(
      (panel) => panel.active
    );
    return activePanel ? this.webviewPanels.get(activePanel) : undefined;
  }

  dispose(): void {
    this.webviewPanels.forEach((_, panel) => panel.dispose());
    this.webviewPanels.clear();
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(
    webview: vscode.Webview,
    dataViewType?: "results" | "editor"
  ): string {
    // Local path to script and css for the webview from the out/webview folder
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "webview", "jsql-editor.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "out",
        "webview",
        "jsql-editor.css"
      )
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    const dataViewTypeAttr = dataViewType
      ? `data-view-type="${dataViewType}"`
      : "";

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; connect-src ${webview.cspSource};">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>JSQL Editor</title>
        </head>
        <body>
            <div id="root" ${dataViewTypeAttr}></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
