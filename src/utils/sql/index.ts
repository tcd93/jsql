/**
 * SQL utilities - Main entry point
 * 
 * This module provides SQL parsing, context detection, and utility functions.
 */

// Re-export types
export type {
  QueryPosition,
  ColumnInfo,
  TableInfo,
  SQLContext,
  SQLNamespace,
} from "./types";

export { TRACKED_KEYWORDS as STATEMENT_KEYWORDS } from "./constants";

export { isOnlyComments, generateQueryTitle } from "./helpers";

export { splitSqlQueries } from "./parser/splitQueries";
export { findQueryAtCursor, findQueryRangeAtCursor } from "./parser/queryFinder";

export {
  flattenSchema,
  detectSqlContextAction,
} from "./context/contextDetector";
