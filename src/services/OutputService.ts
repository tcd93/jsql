import * as vscode from "vscode";

export class OutputService extends vscode.Disposable {
  private readonly outputChannel: vscode.OutputChannel;

  constructor() {
    super(() => this.dispose());
    this.outputChannel = vscode.window.createOutputChannel("JSQL Extension");
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }

  /**
   * Write info message to OUTPUT channel and show bell notification
   */
  public showInfo(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] INFO: ${message}`);
    vscode.window.showInformationMessage(message);
  }

  /**
   * Write error message to OUTPUT channel and show error notification
   */
  public showError(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
    vscode.window.showErrorMessage(message);
  }

  /**
   * Write warning message to OUTPUT channel and show warning notification
   */
  public showWarning(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] WARNING: ${message}`);
    vscode.window.showWarningMessage(message);
  }

  /**
   * Write message to OUTPUT channel without notification
   */
  public writeToOutput(
    message: string,
    level: "INFO" | "ERROR" | "WARNING" | "DEBUG" = "INFO"
  ): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${level}: ${message}`);
  }

  /**
   * Show the OUTPUT channel
   */
  public show(): void {
    this.outputChannel.show();
  }
}
