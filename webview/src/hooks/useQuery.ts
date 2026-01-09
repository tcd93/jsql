import {
  ExecuteStreamingQueryCompleteMessage,
  ExecuteStreamingQueryDataMessage,
  ExecuteStreamingQueryErrorMessage,
  ExecuteStreamingQueryInfoMessage,
  ExecuteStreamingQuerySchemaMessage,
  ExecuteStreamingQueryMessage,
} from "@src/types";
import { useCallback } from "react";
import { useEditorStore } from "../store/editorStore";
import { useTabStore } from "../store/tabStore";
import { getVSCodeAPI } from "../utils/vscode";

export interface useQueryProps {
  executeQuery: (specificQuery?: string) => void;
  handleStreamingQuerySchemaMessage: (
    message: ExecuteStreamingQuerySchemaMessage
  ) => void;
  handleStreamingQueryDataMessage: (
    message: ExecuteStreamingQueryDataMessage
  ) => void;
  handleStreamingQueryCompleteMessage: (
    message: ExecuteStreamingQueryCompleteMessage
  ) => void;
  handleStreamingQueryErrorMessage: (
    message: ExecuteStreamingQueryErrorMessage
  ) => void;
  handleStreamingQueryInfoMessage: (
    message: ExecuteStreamingQueryInfoMessage
  ) => void;
}

export const useQuery = (): useQueryProps => {
  const vscode = getVSCodeAPI();

  const executeQuery = useCallback(
    async (specificQuery?: string) => {
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
    },
    [vscode]
  );

  const handleStreamingQuerySchemaMessage = useCallback(
    (message: ExecuteStreamingQuerySchemaMessage) => {
      const { query, queryId, schema, tabId } = message.payload;

      // create a new tab upon receiving schema
      useTabStore.getState().addTab(query, queryId, tabId);
      useTabStore.getState().updateTab(tabId, { isLoading: true, schema });
    },
    []
  );

  const handleStreamingQueryDataMessage = useCallback(
    (message: ExecuteStreamingQueryDataMessage) => {
      const { data, tabId } = message.payload;

      const tab = useTabStore.getState().getTab(tabId)?.id;
      if (!tab) {
        console.error(
          "No active tab found to update data, tabId received:",
          tabId
        );
        return;
      }

      // Update the tab with new data
      useTabStore.getState().appendData(tabId, data.rows);
      useTabStore.getState().updateTab(tabId, {
        streamStats: {
          batches: data.batchNumber,
          rows: data.totalRowsSoFar,
          complete: false,
        },
      });
    },
    []
  );

  const handleStreamingQueryCompleteMessage = useCallback(
    (message: ExecuteStreamingQueryCompleteMessage) => {
      const { query, queryId, summary } = message.payload;

      const tabs = useTabStore.getState().getTabsByQueryId(queryId);
      // No tabs found for this query -> no schema received, probably an non-query such as DML
      // Create a new tab to show the result for clarity
      if (!tabs.length) {
        const tabId = crypto.randomUUID();
        useTabStore.getState().addTab(query, queryId, tabId);
        useTabStore.getState().updateTab(tabId, {
          streamStats: {
            complete: true,
            rows: summary.totalRows,
            batches: summary.totalBatches,
            affectedRows: summary.affectedRows,
          },
          isLoading: false,
        });
        return;
      }
      tabs.forEach((tab) => {
        console.debug(
          `useQuery: Query complete for tab ${tab.id}. Total Rows: ${summary.totalRows}, Total Batches: ${summary.totalBatches}`
        );

        // Mark the tab as complete
        useTabStore.getState().updateTab(tab.id, {
          streamStats: {
            complete: true,
            rows: summary.totalRows,
            batches: summary.totalBatches,
            affectedRows: summary.affectedRows,
          },
          isLoading: false,
        });
      });
    },
    []
  );

  const handleStreamingQueryErrorMessage = useCallback(
    (message: ExecuteStreamingQueryErrorMessage) => {
      const { queryId, query, tabId, error } = message.payload;

      const tab = useTabStore.getState().getTab(tabId);
      if (!tab) {
        // create a new tab to show the error
        useTabStore.getState().addTab(query, queryId, tabId);
      }

      useTabStore.getState().updateTab(tabId, {
        error,
        isLoading: false,
      });
    },
    []
  );

  const handleStreamingQueryInfoMessage = useCallback(
    (message: ExecuteStreamingQueryInfoMessage) => {
      const { queryId, tabId, info } = message.payload;
      console.info(
        `useQuery: Info message for queryId ${queryId} in tabId ${tabId}: ${info}`
      );
    },
    []
  );

  return {
    executeQuery,
    handleStreamingQuerySchemaMessage,
    handleStreamingQueryDataMessage,
    handleStreamingQueryCompleteMessage,
    handleStreamingQueryErrorMessage,
    handleStreamingQueryInfoMessage,
  };
};
