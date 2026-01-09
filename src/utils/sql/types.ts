/**
 * Type definitions for SQL parsing
 */

import { SQLNamespace } from "@codemirror/lang-sql";

/**
 * Represents a SQL query with its position in the original text
 */
export interface QueryPosition {
  query: string;
  startPosition: number;
  endPosition: number;
}

export interface ColumnInfo {
  label: string;
  detail?: string;
  type?: "column" | "function";
}

export interface TableInfo {
  fqName?: string; // fully qualified name: catalog.schema.table
  name: string;
  type: "table" | "view";
  detail?: string;
  columns?: ColumnInfo[];
  alias?: string; // alias of the table from parsed sql
}

export type SQLContext =
  | { actionType: "list_table" }
  | { actionType: "list_column"; tablesInContext: TableInfo[] };

// Re-export for compatibility
export type { SQLNamespace };
