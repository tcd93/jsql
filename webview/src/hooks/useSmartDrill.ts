import {
  FindMatchingTablesMessage,
  GenerateSmartDrillQueryMessage,
  SmartDrillTableRequest,
} from "@src/types";
import { useCallback } from "react";
import { useEditorStore } from "../store/editorStore";
import { useSmartDrillStore } from "../store/smartDrillStore";
import { getVSCodeAPI } from "../utils/vscode";

export interface SmartDrillHandlers {
  startSmartDrill: () => Promise<void>;
  generateSmartDrillQuery: (selectedTable: SmartDrillTableRequest) => void;
  handleSmartDrillTablesFound: (tables: SmartDrillTableRequest[]) => void;
  handleSmartDrillQueryGenerated: (query: string) => void;
  handleSmartDrillError: (error: string) => void;
}

export const useSmartDrill = (): SmartDrillHandlers => {
  const vscode = getVSCodeAPI();
  const setLoading = useSmartDrillStore((state) => state.setLoading);
  const setSmartDrillOpen = useSmartDrillStore(
    (state) => state.setSmartDrillOpen
  );
  const startSmartDrill = useCallback(async () => {
    const selectedCells = useSmartDrillStore.getState().selectedCells;

    if (selectedCells.length === 0) {
      return;
    }

    try {
      setLoading(true);

      const uniqueColumnNames = useSmartDrillStore
        .getState()
        .getUniqueColumnNames();

      console.debug("Starting smart drill with columns:", uniqueColumnNames);

      const findTablesMessage: FindMatchingTablesMessage = {
        type: "wv.findMatchingTables",
        payload: {
          uniqueColumnNames,
        },
      };
      vscode.postMessage(findTablesMessage);
    } catch (error) {
      console.error("Smart Drill error:", error);
      setLoading(false);
    }
  }, [vscode, setLoading]);

  const generateSmartDrillQuery = useCallback(
    async (selectedTable: SmartDrillTableRequest) => {
      const selectedCells = useSmartDrillStore
        .getState()
        .getSelectedCellsAsPlain();

      const message: GenerateSmartDrillQueryMessage = {
        type: "wv.generateSmartDrillQuery",
        payload: {
          selectedTable,
          selectedCells,
        },
      };
      vscode.postMessage(message);
    },
    [vscode]
  );

  const handleSmartDrillTablesFound = useCallback(
    (tables: SmartDrillTableRequest[]) => {
      if (tables.length === 0) {
        setLoading(false);
        setSmartDrillOpen(false);
        console.warn("No tables found containing all selected columns.");
        return;
      }

      if (tables.length === 1) {
        generateSmartDrillQuery(tables[0]);
      } else {
        setLoading(false);
        setSmartDrillOpen(true);
        const { setMatchedTables } = useSmartDrillStore.getState();
        setMatchedTables(tables);
      }
    },
    [generateSmartDrillQuery, setSmartDrillOpen, setLoading]
  );

  const handleSmartDrillQueryGenerated = useCallback(
    (query: string) => {
      const { content, updateContent, setEditorContent } =
        useEditorStore.getState();
      const newContent = `${content}\n\n${query}`;
      updateContent(newContent);
      if (setEditorContent) {
        setEditorContent(newContent);
      } else {
        console.warn("setEditorContent is not yet defined in editor store");
      }

      setLoading(false);
      setSmartDrillOpen(false);
    },
    [setLoading, setSmartDrillOpen]
  );

  const handleSmartDrillError = useCallback((error: string) => {
    const { setLoading, setSmartDrillOpen } = useSmartDrillStore.getState();
    setLoading(false);
    setSmartDrillOpen(false);
    console.error("Smart Drill error:", error);
  }, []);

  return {
    startSmartDrill,
    generateSmartDrillQuery,
    handleSmartDrillTablesFound,
    handleSmartDrillQueryGenerated,
    handleSmartDrillError,
  };
};
