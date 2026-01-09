/**
 * SQL statement keywords and constants
 */

/**
 * SQL statement keywords that typically start a new query
 * Includes SELECT (with CTEs using WITH), INSERT, UPDATE, DELETE, and MERGE
 */
export const TRACKED_KEYWORDS = [
  "SELECT",
  "WITH",
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
] as const;

/**
 * Keywords that start statements to be ignored/skipped
 */
export const NON_TRACKED_KEYWORDS = [
  "CREATE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "DECLARE",
  "SET",
  "EXECUTE",
  "EXEC",
  "USE",
  "BEGIN",
  "IF",
  "TRY",
  "CATCH",
  "WHILE",
  "PRINT",
] as const;

/**
 * Keywords that should be skipped only when not inside a CASE expression
 */
export const CONTEXT_DEPENDENT_KEYWORDS = [
  "ELSE",
  "END",
] as const;

