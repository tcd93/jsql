import { AggregationResult, SmartDrillCellSelection } from "@src/types";
import { isNumericType } from "./formatUtils";

/**
 * Calculates aggregation metrics for selected cells
 * @param selectedCells Array of selected cell data
 * @param columnName Name of the selected column
 */
export const calculateAggregationMetrics = (
  selectedCells: SmartDrillCellSelection[],
  columnName: string
): AggregationResult => {
  if (selectedCells.length === 0) {
    return {
      sum: null,
      avg: null,
      count: 0,
      countDistinct: 0,
      columnName,
      isNumeric: false,
    };
  }

  const cellType = selectedCells[0]?.type;
  const isNumeric = isNumericType(cellType);

  const values = selectedCells.map((cell) => cell.value);
  const countDistinct = new Set(
    values.filter((v) => v !== null && v !== undefined)
  ).size;

  if (!isNumeric) {
    return {
      sum: null,
      avg: null,
      count: values.length,
      countDistinct,
      columnName,
      isNumeric: false,
    };
  }

  const numericValues = values.map((val) => Number(val));

  const sum = numericValues.reduce((acc, val) => acc + val, 0);
  const avg = numericValues.length > 0 ? sum / numericValues.length : 0;

  return {
    sum,
    avg,
    count: values.length,
    countDistinct,
    columnName,
    isNumeric: true,
  };
};

/**
 * Formats aggregation metrics for display
 */
export const formatAggregationMetrics = (
  metrics: AggregationResult
): string => {
  if (!metrics.isNumeric) {
    return `Column: ${metrics.columnName} | Count: ${metrics.count}`;
  }

  const sum = metrics.sum?.toFixed(2) ?? "0";
  const avg = metrics.avg?.toFixed(2) ?? "0";

  return `Column: ${metrics.columnName} | Count: ${metrics.count} | SUM: ${sum} | AVG: ${avg}`;
};
