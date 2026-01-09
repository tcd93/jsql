export interface AggregationResult {
  sum: number | null;
  avg: number | null;
  count: number;
  countDistinct: number;
  columnName: string;
  isNumeric: boolean;
}
