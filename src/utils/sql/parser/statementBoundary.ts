/**
 * Statement boundary detection for SQL parsing
 */

import { TRACKED_KEYWORDS } from "../constants";

/**
 * Context state for SQL parsing
 */
export interface SqlParsingContext {
  inCteDefinition: boolean;
  afterCteAs: boolean;
  cteParenDepth: number;
  caseDepth: number;
  currentStatementType:
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "MERGE"
    | null;
}

/**
 * Checks if the text at the given position matches a SQL keyword
 */
export function matchesKeyword(
  text: string,
  position: number,
  keyword: string
): boolean {
  // Check if there's a word boundary before
  const before = position === 0 || /[\s;(]/.test(text[position - 1]);
  if (!before) {
    return false;
  }

  // Check if the keyword matches (case-insensitive)
  const keywordLength = keyword.length;
  const textPart = text.substring(position, position + keywordLength);
  if (textPart.toUpperCase() !== keyword) {
    return false;
  }

  // Check if there's a word boundary after
  const after =
    position + keywordLength >= text.length ||
    /[\s;(]/.test(text[position + keywordLength]);

  return after;
}

/**
 * Checks if we're at a statement boundary (new top-level SQL command)
 */
export function isStatementBoundary(
  text: string,
  position: number,
  context: SqlParsingContext,
  parenDepth: number
): boolean {
  // Make sure we're at the top level (not in a subquery)
  if (parenDepth !== 0) {
    return false;
  }

  // Check if any statement keyword matches at this position
  for (const keyword of TRACKED_KEYWORDS) {
    if (matchesKeyword(text, position, keyword)) {

      // WITH is not a boundary if it's a table hint: WITH (NOLOCK)
      if (keyword === "WITH") {
        // Check if it's a table hint: WITH followed immediately by (
        const followingText = text.substring(
          position + keyword.length,
          Math.min(text.length, position + keyword.length + 10)
        );
        if (/^\s*\(/.test(followingText)) {
          return false; // It's a table hint like WITH (NOLOCK)
        }
      }

      // SELECT/INSERT/UPDATE/DELETE are not boundaries if they're part of a WITH (CTE) statement
      if (
        (keyword === "SELECT" ||
          keyword === "INSERT" ||
          keyword === "UPDATE" ||
          keyword === "DELETE") &&
        context.afterCteAs
      ) {
        return false;
      }

      // SELECT is not a boundary if it's part of a DML statement (e.g., INSERT ... SELECT)
      if (
        keyword === "SELECT" &&
        (context.currentStatementType === "INSERT" ||
          context.currentStatementType === "UPDATE" ||
          context.currentStatementType === "DELETE" ||
          context.currentStatementType === "MERGE")
      ) {
        return false;
      }

      // SELECT is not a boundary if it follows UNION keywords (UNION ALL SELECT, UNION SELECT, etc.)
      if (keyword === "SELECT") {
        const lookbackStart = Math.max(0, position - 20);
        const lookbackText = text
          .substring(lookbackStart, position)
          .toUpperCase();
        if (/\bUNION\s+(ALL|DISTINCT)?\s*$/.test(lookbackText)) {
          return false;
        }
      }

      // UPDATE/INSERT/DELETE are not boundaries if we're inside a MERGE statement
      // (MERGE statements contain UPDATE/INSERT clauses)
      if (
        (keyword === "UPDATE" ||
          keyword === "INSERT" ||
          keyword === "DELETE") &&
        context.currentStatementType === "MERGE"
      ) {
        return false;
      }

      return true;
    }
  }

  return false;
}
