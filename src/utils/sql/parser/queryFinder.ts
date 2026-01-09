/**
 * Query finding utilities
 */

import { splitSqlQueries } from "./splitQueries";

/**
 * Finds the query that contains the given cursor position
 */
export function findQueryAtCursor(
  text: string,
  cursorPosition: number
): string | undefined {
  const queries = splitSqlQueries(text);

  for (const queryInfo of queries) {
    if (
      cursorPosition >= queryInfo.startPosition &&
      cursorPosition <= queryInfo.endPosition
    ) {
      return queryInfo.query;
    }
  }

  return;
}

/**
 * Finds the SQL query range at the given cursor position
 */
export function findQueryRangeAtCursor(
  text: string,
  cursorPos: number
): { from: number; to: number; query: string } | null {
  const queryAtCursor = findQueryAtCursor(text, cursorPos);
  if (!queryAtCursor) {
    return null;
  }

  const queries = splitSqlQueries(text);

  for (const queryInfo of queries) {
    if (
      cursorPos >= queryInfo.startPosition &&
      cursorPos <= queryInfo.endPosition
    ) {
      return {
        from: queryInfo.startPosition,
        to: queryInfo.endPosition,
        query: queryInfo.query,
      };
    }
  }

  return null;
}
