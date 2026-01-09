import { ChangeSet } from "@codemirror/state";
import {
  DocumentSyncStatusMessage,
  DocumentDiagnosticsMessage,
  DocumentContentMessage,
  DocumentContentChangedMessage,
} from "@src/types";
import { useCallback } from "react";
import { useEditorStore } from "../store/editorStore";
import { getVSCodeAPI } from "../utils/vscode";

export interface UseDocumentSyncProps {
  calculateDeltaFromChangeSet: (changeSet: ChangeSet) => TextDelta | undefined;
  /**
   * Sync the content changes to the VS Code extension backend
   */
  syncContentChange: (delta: TextDelta | undefined) => void;
  handleDocumentContent: (message: DocumentContentMessage) => void;
  handleDocumentSyncStatus: (message: DocumentSyncStatusMessage) => void;
  handleDocumentDiagnostics: (message: DocumentDiagnosticsMessage) => void;
}

/**
 * Hook to sync CodeMirror content with VS Code document
 * Follows the same pattern as useQuery - provides handlers for App.tsx to register
 */
export const useDocumentSync = (): UseDocumentSyncProps => {
  const vscode = getVSCodeAPI();

  const calculateDeltaFromChangeSet = useCallback(
    (changeSet: ChangeSet): TextDelta | undefined => {
      const delta = changeSetToTextDelta(changeSet);
      if (delta && isDeltaSignificant(delta)) {
        return delta;
      }
      return undefined;
    },
    []
  );

  const syncContentChange = useCallback(
    (delta: TextDelta | undefined) => {
      const { content, version } = useEditorStore.getState();
      // Send content to VS Code
      const message: DocumentContentChangedMessage = {
        type: "wv.documentContentChanged",
        payload: {
          content,
          version: version + 1,
          delta,
        },
      };
      vscode.postMessage(message);
    },
    [vscode]
  );

  // Handler for document sync status updates
  const handleDocumentSyncStatus = useCallback(
    (message: DocumentSyncStatusMessage) => {
      if (!message.payload.synced && message.payload.error) {
        console.warn("Document sync failed:", message.payload.error);
      }
    },
    []
  );

  // Convert VS Code position to CodeMirror character offset
  const positionToOffset = useCallback(
    (line: number, character: number): number => {
      const { content } = useEditorStore.getState();
      const contentToUse = content;
      const lines = contentToUse.split("\n");

      let offset = 0;
      for (let i = 0; i < line && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for newline character
      }

      return offset + Math.min(character, lines[line]?.length || 0);
    },
    []
  );

  // Handler for document diagnostics updates
  const handleDocumentDiagnostics = useCallback(
    (message: DocumentDiagnosticsMessage) => {
      const { updateFromVSCodeDiagnostics } = useEditorStore.getState();
      updateFromVSCodeDiagnostics(
        message.payload.diagnostics,
        positionToOffset
      );
    },
    [positionToOffset]
  );

  // Handler for document content updates from vscode side
  const handleDocumentContent = useCallback(
    (message: DocumentContentMessage) => {
      const { updateContent, setEditorContent } = useEditorStore.getState();
      updateContent(message.payload.content);
      if (setEditorContent) {
        setEditorContent(message.payload.content);
      } else {
        console.warn("setEditorContent is not yet defined in editor store");
      }
    },
    []
  );

  return {
    calculateDeltaFromChangeSet,
    syncContentChange,
    handleDocumentContent,
    handleDocumentSyncStatus,
    handleDocumentDiagnostics,
  };
};

/**
 * Represents a text change delta
 */
interface TextDelta {
  from: number;
  to: number;
  insert: string;
}

/**
 * Convert CodeMirror's ChangeSet to our TextDelta format
 * This is more reliable than manual delta calculation
 */
function changeSetToTextDelta(changeSet: ChangeSet): TextDelta | null {
  if (changeSet.empty) {
    return null;
  }
  // For simplicity, we'll take the first change from the ChangeSet
  // CodeMirror can have multiple changes, but for document sync we typically
  // want to send them as separate deltas anyway
  let firstDelta: TextDelta | null = null;

  changeSet.iterChanges((fromA, toA, fromB, toB, inserted) => {
    firstDelta ??= {
      from: fromB,
      to: toB,
      insert: inserted.toString(),
    };
  }, true);

  return firstDelta;
}

/**
 * Utility to check if a delta is significant enough to send
 * Helps reduce noise from tiny changes
 */
function isDeltaSignificant(delta: TextDelta, threshold = 0): boolean {
  // Ensure threshold is non-negative
  const minThreshold = Math.max(0, threshold);

  // Calculate the size of the change
  const deletedLength = delta.to - delta.from;
  const insertedLength = delta.insert.length;

  // If both are zero, it's not a significant change
  if (deletedLength === 0 && insertedLength === 0) {
    return false;
  }

  const changeSize = Math.max(deletedLength, insertedLength);

  return changeSize >= minThreshold;
}
