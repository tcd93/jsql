import { ConnectionChangedMessage } from "@src/types";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMessageHandlerStore } from "../events/messageHandlerStore";
import { useDocumentSync } from "../hooks/useDocumentSync";
import { useQuery } from "../hooks/useQuery";
import { useSchema } from "../hooks/useSchema";
import { useSmartDrill } from "../hooks/useSmartDrill";
import { useGlobalContextMenuStore } from "../store/globalContextMenuStore";
import { useSchemaStore } from "../store/schemaStore";
import { useSmartDrillStore } from "../store/smartDrillStore";
import { useTabStore } from "../store/tabStore";
import styles from "./App.module.css";
import QueryEditor from "./Editor/QueryEditor";
import QueryTabList from "./Panel/Results/QueryTabList";
import SmartDrillPanel from "./Panel/SmartDrillPanel";

const App: React.FC = () => {
  // viewType: editor - editor only
  // viewType: results - results only
  const viewType =
    document.getElementById("root")?.getAttribute("data-view-type") ??
    "editor results";

  const [isSmartDrillOpen, setSmartDrillOpen] = useSmartDrillStore(
    useShallow((state) => [state.isSmartDrillOpen, state.setSmartDrillOpen])
  );

  // Resize state
  // no editorHeight if viewType is results only
  const [editorHeight, setEditorHeight] = useState(() => {
    if (viewType.trim() === "results") {
      return 0;
    }
    return 70;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
      const constrainedHeight = Math.max(20, Math.min(80, newHeight));
      setEditorHeight(constrainedHeight);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return (): void => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const isResultTabOpen = useTabStore((state) => state.tabs.length > 0);

  // Initialize message handling
  const initialize = useMessageHandlerStore((state) => state.initialize);
  const registerHandler = useMessageHandlerStore(
    (state) => state.registerHandler
  );
  const unregisterHandler = useMessageHandlerStore(
    (state) => state.unregisterHandler
  );

  const {
    executeQuery,
    handleStreamingQuerySchemaMessage,
    handleStreamingQueryDataMessage,
    handleStreamingQueryCompleteMessage,
    handleStreamingQueryErrorMessage,
    handleStreamingQueryInfoMessage,
  } = useQuery();

  const {
    handleSmartDrillTablesFound,
    handleSmartDrillError,
    handleSmartDrillQueryGenerated,
  } = useSmartDrill();

  const {
    fetchSchema,
    handleSchemaDataFoundMessage,
    handleSchemaDataErrorMessage,
  } = useSchema();

  const setCurrentProfile = useSchemaStore((state) => state.setCurrentProfile);

  // Document sync with VS Code
  const {
    handleDocumentContent,
    handleDocumentDiagnostics,
    handleDocumentSyncStatus,
  } = useDocumentSync();

  // Context menu management
  const closeContextMenu = useGlobalContextMenuStore(
    (state) => state.closeContextMenu
  );

  // Handle connection changes to trigger schema loading
  const handleConnectionChanged = useCallback(
    (message: ConnectionChangedMessage): void => {
      const { profile } = message.payload;
      fetchSchema();
      setCurrentProfile(profile);
    },
    [fetchSchema, setCurrentProfile]
  );

  // Register all message handlers
  useEffect(() => {
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
    registerHandler(
      "ext.streamingQueryError",
      handleStreamingQueryErrorMessage
    );
    registerHandler(
      "ext.streamingQueryInfo",
      handleStreamingQueryInfoMessage
    );

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
      closeContextMenu();
    });

    return (): void => {
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
    };
  }, [
    registerHandler,
    unregisterHandler,
    executeQuery,
    handleStreamingQuerySchemaMessage,
    handleStreamingQueryDataMessage,
    handleStreamingQueryCompleteMessage,
    handleStreamingQueryErrorMessage,
    handleStreamingQueryInfoMessage,
    handleSmartDrillTablesFound,
    handleSmartDrillError,
    handleSmartDrillQueryGenerated,
    handleSchemaDataFoundMessage,
    handleSchemaDataErrorMessage,
    handleConnectionChanged,
    handleDocumentSyncStatus,
    handleDocumentDiagnostics,
    handleDocumentContent,
    closeContextMenu,
  ]);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  // Full editor view for the main editor
  return (
    <div
      className={styles.jSqlEditor}
      ref={containerRef}
      style={
        {
          "--editor-height": `${editorHeight}%`,
          "--tabs-height": `${100 - editorHeight}%`,
        } as React.CSSProperties
      }
    >
      {viewType.includes("editor") && <QueryEditor />}

      {viewType.includes("editor") && isResultTabOpen && (
        <button
          className={styles.resizeHandle}
          onMouseDown={handleMouseDown}
          aria-label="Resize panels"
          type="button"
        />
      )}

      {viewType.includes("results") && <QueryTabList />}

      {viewType.includes("results") && (
        <SmartDrillPanel
          isOpen={isSmartDrillOpen}
          onClose={() => setSmartDrillOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
