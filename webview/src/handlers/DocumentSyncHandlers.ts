import {
  DocumentSyncStatusMessage,
  DocumentDiagnosticsMessage,
  DocumentContentMessage,
} from "@src/types";
import { useEditorStore } from "../store/editorStore";

// Convert VS Code position to CodeMirror character offset
const positionToOffset = (line: number, character: number): number => {
  const { content } = useEditorStore.getState();
  const lines = content.split("\n");

  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline character
  }

  return offset + Math.min(character, lines[line]?.length || 0);
};

// Handler for document sync status updates
export const handleDocumentSyncStatus = (
  message: DocumentSyncStatusMessage
): void => {
  if (!message.payload.synced && message.payload.error) {
    console.warn("Document sync failed:", message.payload.error);
  }
};

// Handler for document diagnostics updates
export const handleDocumentDiagnostics = (
  message: DocumentDiagnosticsMessage
): void => {
  const { updateFromVSCodeDiagnostics } = useEditorStore.getState();
  updateFromVSCodeDiagnostics(message.payload.diagnostics, positionToOffset);
};

// Handler for document content updates from vscode side
export const handleDocumentContent = (
  message: DocumentContentMessage
): void => {
  const { updateContent, setEditorContent } = useEditorStore.getState();
  updateContent(message.payload.content);
  if (setEditorContent) {
    setEditorContent(message.payload.content);
  } else {
    console.warn("setEditorContent is not yet defined in editor store");
  }
};
