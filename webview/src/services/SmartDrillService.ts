import {
  FindMatchingTablesMessage,
  GenerateSmartDrillQueryMessage,
  SmartDrillTableRequest,
} from "@src/types";
import { useSmartDrillStore } from "../store/smartDrillStore";
import { getVSCodeAPI } from "../utils/vscode";

const vscode = getVSCodeAPI();

export const startSmartDrill = async (): Promise<void> => {
  const { selectedCells, setLoading, getUniqueColumnNames } =
    useSmartDrillStore.getState();

  if (selectedCells.length === 0) {
    return;
  }

  try {
    setLoading(true);

    const uniqueColumnNames = getUniqueColumnNames();

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
    useSmartDrillStore.getState().setLoading(false);
  }
};

export const generateSmartDrillQuery = async (
  selectedTable: SmartDrillTableRequest
): Promise<void> => {
  const selectedCells = useSmartDrillStore.getState().getSelectedCellsAsPlain();

  const message: GenerateSmartDrillQueryMessage = {
    type: "wv.generateSmartDrillQuery",
    payload: {
      selectedTable,
      selectedCells,
    },
  };
  vscode.postMessage(message);
};
