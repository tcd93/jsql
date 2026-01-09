import * as vscode from "vscode";

export class QueryHighlightService extends vscode.Disposable {
  constructor() {
    super(() => {
      this.dispose();
    });
  }

  public showDocument(
    uri: vscode.Uri
  ): Thenable<vscode.TextEditor> | undefined {
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === uri.toString()
    );
    if (document) {
      return vscode.window.showTextDocument(document);
    }
    return;
  }

  /**
   * Highlight the given range in the editor and reveal it if it is not visible.
   * If the query text is provided, only reveal if it matches the current text in the range.
   */
  public highlightQuery(
    editor: vscode.TextEditor,
    range: vscode.Range,
    query?: string
  ): void {
    editor.selection = new vscode.Selection(range.start, range.end);
    const selectionCurrentText = editor.document.getText(range);
    if (query?.trim() === selectionCurrentText.trim() || !query) {
      editor.revealRange(
        range,
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
      );
    }
  }

  public dispose(): void {}
}
