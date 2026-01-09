import { ChangeSet } from "@codemirror/state";
import { DocumentContentChangedMessage } from "@src/types";
import { useEditorStore } from "../store/editorStore";
import { getVSCodeAPI } from "../utils/vscode";

const vscode = getVSCodeAPI();

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

export const calculateDeltaFromChangeSet = (
  changeSet: ChangeSet
): TextDelta | undefined => {
  const delta = changeSetToTextDelta(changeSet);
  if (delta && isDeltaSignificant(delta)) {
    return delta;
  }
  return undefined;
};

/**
 * Sync the content changes to the VS Code extension backend
 */
export const syncContentChange = (delta: TextDelta | undefined): void => {
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
};
