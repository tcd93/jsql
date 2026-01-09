import * as vscode from "vscode";
import { MessageService, StatusBarService, getService } from "../../services";
import { ConnectionProfile, ExtensionToWebviewMessage } from "../../types";
import { IVscodeCommand } from "./ICommand";

export class ResultPanelProvider
  implements vscode.WebviewViewProvider, IVscodeCommand
{
  private webviewView?: vscode.WebviewView;
  private readonly messageService: MessageService;
  private readonly statusBarService: StatusBarService;
  private readonly extensionUri: vscode.Uri;

  constructor(context: vscode.ExtensionContext) {
    this.extensionUri = context.extensionUri;

    this.messageService = getService(MessageService);
    this.statusBarService = getService(StatusBarService);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "jsql-query-results-view",
        this,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      )
    );
  }

  /**
   * Called when the webview panel (bottom panel) is resolved.
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };
    // result view only
    webviewView.webview.html = this.getHtmlForWebview(
      webviewView.webview,
      "results"
    );
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
    this.messageService.registerHandler("ext.streamingQueryInfo", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler(
      "ext.smartDrillTablesFound",
      (message) => {
        this.notifyCustomEditor(message);
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

    this.messageService.registerHandler("ext.editorFocusChanged", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("ext.connectionChanged", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("ext.schemaDataFound", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler("ext.schemaDataError", (message) => {
      this.notifyCustomEditor(message);
    });

    this.messageService.registerHandler(
      "wv.updateStatusBarAggregation",
      (message) => {
        this.statusBarService.displayAggregationMetrics(message.payload);
      }
    );

    this.messageService.registerHandler("wv.clearStatusBarAggregation", () => {
      this.statusBarService.hideAggregationMetrics();
    });

    webviewView.webview.onDidReceiveMessage((message) => {
      this.messageService.invoke(message);
    });
  }

  notifyCustomEditor(message: ExtensionToWebviewMessage): void {
    if (!this.webviewView) {
      return;
    }
    try {
      this.webviewView.webview.postMessage(message);
    } catch (error) {
      // Webview may have been disposed
      console.error(
        `Failed to post message to webview: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  openEditor(): void {
    // not implemented
  }

  chooseConnection(): void {
    // not implemented
  }

  executeAllQueries(): void {
    // not implemented
  }

  executeQueryAtCursor(_connectionProfile?: ConnectionProfile): void {
    // not implemented
  }

  cancelAllQueries(): void {
    // not implemented
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
