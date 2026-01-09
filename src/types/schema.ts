import { SQLNamespace } from "@codemirror/lang-sql";

export const AggregationOptions = [
  "auto",
  "sum",
  "min",
  "max",
  "extent",
  "mean",
  "median",
  "count",
  "unique",
  "uniqueCount",
] as const;

export interface SchemaField {
  name: string;
  type: string;
  // Tanstack lacks API for dynamically setting aggregation function in runtime
  // so we track it manually
  aggregationFn?: (typeof AggregationOptions)[number];
}

/// Schema data for auto completion
export type SchemaData = SQLNamespace;
