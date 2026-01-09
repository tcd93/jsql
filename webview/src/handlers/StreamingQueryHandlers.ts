import {
  ExecuteStreamingQueryCompleteMessage,
  ExecuteStreamingQueryDataMessage,
  ExecuteStreamingQueryErrorMessage,
  ExecuteStreamingQueryInfoMessage,
  ExecuteStreamingQuerySchemaMessage,
} from "@src/types";
import { useTabStore } from "../store/tabStore";

export const handleStreamingQuerySchemaMessage = (
  message: ExecuteStreamingQuerySchemaMessage
): void => {
  const { query, queryId, schema, tabId } = message.payload;

  // create a new tab upon receiving schema
  useTabStore.getState().addTab(query, queryId, tabId);
  useTabStore.getState().updateTab(tabId, { isLoading: true, schema });
};

export const handleStreamingQueryDataMessage = (
  message: ExecuteStreamingQueryDataMessage
): void => {
  const { data, tabId } = message.payload;

  const tab = useTabStore.getState().getTab(tabId)?.id;
  if (!tab) {
    console.error("No active tab found to update data, tabId received:", tabId);
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
};

export const handleStreamingQueryCompleteMessage = (
  message: ExecuteStreamingQueryCompleteMessage
): void => {
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
      `StreamingQueryHandlers: Query complete for tab ${tab.id}. Total Rows: ${summary.totalRows}, Total Batches: ${summary.totalBatches}`
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
};

export const handleStreamingQueryErrorMessage = (
  message: ExecuteStreamingQueryErrorMessage
): void => {
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
};

export const handleStreamingQueryInfoMessage = (
  message: ExecuteStreamingQueryInfoMessage
): void => {
  const { queryId, tabId, info } = message.payload;
  console.info(
    `StreamingQueryHandlers: Info message for queryId ${queryId} in tabId ${tabId}: ${info}`
  );
};
