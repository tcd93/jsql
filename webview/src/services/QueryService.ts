import { ExecuteStreamingQueryMessage } from "@src/types";
import { useEditorStore } from "../store/editorStore";
import { getVSCodeAPI } from "../utils/vscode";

const vscode = getVSCodeAPI();

export const executeQuery = async (specificQuery?: string): Promise<void> => {
  const { content } = useEditorStore.getState();
  const queryToExecute = specificQuery ?? content;
  const queryId = crypto.randomUUID();

  if (!queryToExecute.trim()) {
    return;
  }

  // Post message to JSqlEditorProvider for streaming execution
  const message: ExecuteStreamingQueryMessage = {
    type: "wv.executeStreamingQuery",
    payload: {
      query: queryToExecute,
      queryId,
    },
  };
  vscode.postMessage(message);
};
