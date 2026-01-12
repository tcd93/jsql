import { useEffect } from "react";
import { useSmartDrillStore } from "../store/smartDrillStore";
import { useTabStore } from "../store/tabStore";
import { calculateAggregationMetrics } from "../utils/aggregationUtils";
import { getVSCodeAPI } from "../utils/vscode";

/**
 * Hook that monitors column selections and sends aggregation metrics to the extension
 */
export const useColumnAggregation = (tabId: string): void => {
  const selectedCells = useSmartDrillStore((state) => state.selectedCells);
  const schema = useTabStore((state) => state.getTab(tabId)?.schema);
  const vscode = getVSCodeAPI();

  useEffect(() => {
    // Clear aggregation if no cells selected
    if (selectedCells.size === 0) {
      vscode.postMessage({
        type: "wv.clearStatusBarAggregation",
        payload: undefined,
      });
      return;
    }

    // Check if all selected cells are from the same column (column selection)
    const cellsArray = Array.from(selectedCells.values());
    const firstColumnId = cellsArray[0]?.column.id;
    const isColumnSelection = cellsArray.every(
      (cell) => cell.column.id === firstColumnId
    );

    if (!isColumnSelection || !firstColumnId || !schema) {
      vscode.postMessage({
        type: "wv.clearStatusBarAggregation",
        payload: undefined,
      });
      return;
    }

    const columnInfo = schema.find((field) => field.name === firstColumnId);
    const columnName = columnInfo?.name ?? firstColumnId;

    const plainCells = useSmartDrillStore.getState().getSelectedCellsAsPlain();
    const metrics = calculateAggregationMetrics(plainCells, columnName);

    vscode.postMessage({
      type: "wv.updateStatusBarAggregation",
      payload: {
        columnName: metrics.columnName,
        sum: metrics.sum,
        avg: metrics.avg,
        count: metrics.count,
        countDistinct: metrics.countDistinct,
        isNumeric: metrics.isNumeric,
      },
    });
  }, [selectedCells, schema, tabId, vscode]);
};
