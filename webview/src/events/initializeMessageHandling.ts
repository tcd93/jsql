import {
  handleConnectionChanged,
  handleDocumentContent,
  handleDocumentDiagnostics,
  handleDocumentSyncStatus,
  handleSchemaDataErrorMessage,
  handleSchemaDataFoundMessage,
  handleSmartDrillError,
  handleSmartDrillQueryGenerated,
  handleSmartDrillTablesFound,
  handleStreamingQueryCompleteMessage,
  handleStreamingQueryDataMessage,
  handleStreamingQueryErrorMessage,
  handleStreamingQueryInfoMessage,
  handleStreamingQuerySchemaMessage,
} from "../handlers";
import { executeQuery } from "../services/QueryService";
import { useGlobalContextMenuStore } from "../store/globalContextMenuStore";
import { useMessageHandlerStore } from "./messageHandlerStore";

/**
 * Initialize message handling and register all handlers.
 * Returns a cleanup function that unregisters all handlers and tears down the message listener.
 */
export const initializeMessageHandling = (): (() => void) => {
  const { initialize, registerHandler, unregisterHandler } =
    useMessageHandlerStore.getState();

  // Initialize the window message listener
  const cleanupListener = initialize();

  // Query handlers
  registerHandler("ext.executeAllQuery", () => executeQuery());
  registerHandler(
    "ext.streamingQuerySchema",
    handleStreamingQuerySchemaMessage
  );
  registerHandler("ext.streamingQueryData", handleStreamingQueryDataMessage);
  registerHandler(
    "ext.streamingQueryComplete",
    handleStreamingQueryCompleteMessage
  );
  registerHandler("ext.streamingQueryError", handleStreamingQueryErrorMessage);
  registerHandler("ext.streamingQueryInfo", handleStreamingQueryInfoMessage);

  // Smart Drill handlers
  registerHandler("ext.smartDrillTablesFound", (message) => {
    handleSmartDrillTablesFound(message.payload.tables);
  });
  registerHandler("ext.smartDrillQueryGenerated", (message) => {
    handleSmartDrillQueryGenerated(message.payload.query);
  });
  registerHandler("ext.smartDrillError", (message) => {
    handleSmartDrillError(message.payload.error);
  });

  // Schema handlers
  registerHandler("ext.schemaDataFound", handleSchemaDataFoundMessage);
  registerHandler("ext.schemaDataError", handleSchemaDataErrorMessage);

  // Connection change handler
  registerHandler("ext.connectionChanged", handleConnectionChanged);

  // Document sync handlers
  registerHandler("ext.documentSyncStatus", handleDocumentSyncStatus);
  registerHandler("ext.documentDiagnostics", handleDocumentDiagnostics);
  registerHandler("ext.documentContent", handleDocumentContent);

  // Editor focus handler
  registerHandler("ext.editorFocusChanged", () => {
    useGlobalContextMenuStore.getState().closeContextMenu();
  });

  // Return cleanup function
  return (): void => {
    // Unregister all handlers
    unregisterHandler("ext.executeAllQuery");
    unregisterHandler("ext.streamingQuerySchema");
    unregisterHandler("ext.streamingQueryData");
    unregisterHandler("ext.streamingQueryComplete");
    unregisterHandler("ext.streamingQueryError");
    unregisterHandler("ext.streamingQueryInfo");
    unregisterHandler("ext.smartDrillTablesFound");
    unregisterHandler("ext.smartDrillQueryGenerated");
    unregisterHandler("ext.smartDrillError");
    unregisterHandler("ext.schemaDataFound");
    unregisterHandler("ext.schemaDataError");
    unregisterHandler("ext.connectionChanged");
    unregisterHandler("ext.documentSyncStatus");
    unregisterHandler("ext.documentDiagnostics");
    unregisterHandler("ext.documentContent");
    unregisterHandler("ext.editorFocusChanged");

    // Clean up message listener
    cleanupListener();
  };
};
