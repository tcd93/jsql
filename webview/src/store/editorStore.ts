import { Diagnostic } from "@codemirror/lint";
import { VSCodeDiagnostic } from "@src/types";
import { create } from "zustand";

interface EditorState {
  // Content sync
  content: string;
  version: number;
  /**
   * Method to display content of the customer editor (such as codemirror)
   */
  setEditorContent?: (content: string) => void;
  /**
   * Send `DocumentContentChangedMessage` event to vscode extension to sync it's document
   */
  updateContent: (newContent: string) => void;
  // Diagnostics
  diagnostics: Diagnostic[];
  setDiagnostics: (diagnostics: Diagnostic[]) => void;
  updateFromVSCodeDiagnostics: (
    vscDiagnostics: VSCodeDiagnostic[],
    positionToOffset: (line: number, character: number) => number
  ) => void;
  getDiagnostics: () => Diagnostic[];
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  //#region text editors
  version: 0,
  content: "",

  updateContent: (newContent: string): void => {
    const { version } = get();
    set({ version: version + 1, content: newContent });
  },
  //#endregion text editors

  //#region diagnostics
  diagnostics: [],
  setDiagnostics: (diagnostics: Diagnostic[]): void => {
    set({ diagnostics });
  },

  updateFromVSCodeDiagnostics: (
    vscDiagnostics: VSCodeDiagnostic[],
    positionToOffset: (line: number, character: number) => number
  ): void => {
    const cmDiagnostics: Diagnostic[] = vscDiagnostics.map((diag) => {
      const from = positionToOffset(
        diag.range.start.line,
        diag.range.start.character
      );
      const to = positionToOffset(
        diag.range.end.line,
        diag.range.end.character
      );

      // Convert VS Code severity to CodeMirror severity
      let severity: "error" | "warning" | "info" = "error";
      switch (diag.severity) {
        case 1: // Error
          severity = "error";
          break;
        case 2: // Warning
          severity = "warning";
          break;
        case 3: // Information
        case 4: // Hint
          severity = "info";
          break;
      }

      return {
        from: Math.max(0, from),
        to: Math.max(from, to),
        severity,
        message: diag.message,
        source: diag.source,
      };
    });

    set({ diagnostics: cmDiagnostics });
  },

  getDiagnostics: (): Diagnostic[] => {
    const { diagnostics } = get();
    return diagnostics;
  },
  //#endregion diagnostics
}));
