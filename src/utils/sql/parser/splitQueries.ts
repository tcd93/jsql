/**
 * SQL query splitting - main parsing logic
 */

import { NON_TRACKED_KEYWORDS, CONTEXT_DEPENDENT_KEYWORDS } from "../constants";
import { isOnlyComments } from "../helpers";
import { QueryPosition } from "../types";
import {
  isStatementBoundary,
  matchesKeyword,
  type SqlParsingContext,
} from "./statementBoundary";

/**
 * Creates initial parsing context
 */
function createParsingContext(): SqlParsingContext {
  return {
    inCteDefinition: false,
    afterCteAs: false,
    cteParenDepth: 0,
    caseDepth: 0,
    currentStatementType: null,
  };
}

/**
 * Resets parsing context to initial state
 */
function resetParsingContext(context: SqlParsingContext): void {
  context.inCteDefinition = false;
  context.afterCteAs = false;
  context.cteParenDepth = 0;
  context.caseDepth = 0;
  context.currentStatementType = null;
}

/**
 * Checks if current position matches a keyword that should be skipped
 */
function isSkippableKeyword(
  text: string,
  position: number,
  context: SqlParsingContext,
  parenDepth: number
): boolean {
  if (parenDepth !== 0) {
    return false;
  }

  for (const keyword of NON_TRACKED_KEYWORDS) {
    if (matchesKeyword(text, position, keyword)) {
      // SET is part of UPDATE statements, so don't skip it when inside an UPDATE
      if (keyword === "SET" && context.currentStatementType === "UPDATE") {
        return false;
      }
      return true;
    }
  }

  for (const keyword of CONTEXT_DEPENDENT_KEYWORDS) {
    if (matchesKeyword(text, position, keyword)) {
      if (context.caseDepth > 0) {
        return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * Updates parsing context based on current character and keywords
 */
function updateParsingContext(
  context: SqlParsingContext,
  text: string,
  position: number,
  char: string,
  parenDepth: number
): void {
  if (matchesKeyword(text, position, "CASE")) {
    context.caseDepth++;
  }

  if (matchesKeyword(text, position, "END")) {
    if (context.caseDepth > 0) {
      context.caseDepth--;
    }
  }

  if (parenDepth === 0) {
    if (matchesKeyword(text, position, "SELECT")) {
      context.currentStatementType = "SELECT";
    } else if (matchesKeyword(text, position, "INSERT")) {
      context.currentStatementType = "INSERT";
    } else if (matchesKeyword(text, position, "UPDATE")) {
      context.currentStatementType = "UPDATE";
    } else if (matchesKeyword(text, position, "DELETE")) {
      context.currentStatementType = "DELETE";
    } else if (matchesKeyword(text, position, "MERGE")) {
      context.currentStatementType = "MERGE";
    }
  }

  if (matchesKeyword(text, position, "WITH")) {
    const followingText = text.substring(
      position + 4,
      Math.min(text.length, position + 10)
    );
    if (parenDepth === 0 && !/^\s*\(/.test(followingText)) {
      context.inCteDefinition = true;
      context.afterCteAs = false;
      context.cteParenDepth = 0;
    }
  }

  if (context.inCteDefinition && matchesKeyword(text, position, "AS")) {
    context.afterCteAs = true;
  }

  if (context.afterCteAs) {
    if (char === "(") {
      context.cteParenDepth++;
    } else if (char === ")") {
      context.cteParenDepth--;
    }
  }

  if (
    context.afterCteAs &&
    context.cteParenDepth === 0 &&
    (matchesKeyword(text, position, "SELECT") ||
      matchesKeyword(text, position, "INSERT") ||
      matchesKeyword(text, position, "UPDATE") ||
      matchesKeyword(text, position, "DELETE"))
  ) {
    context.afterCteAs = false;
    context.inCteDefinition = false;
  }
}

/**
 * Final check for a valid query and trim it
 */
function finalizeQuery(
  currentQuery: string,
  startPosition: number,
  endPosition: number,
  commentPositions: Set<number>
): QueryPosition | null {
  const trimmedQuery = currentQuery.trim();

  // Filter out queries that are only comments/whitespace/semicolons or just "GO"
  if (
    !trimmedQuery ||
    isOnlyComments(trimmedQuery) ||
    trimmedQuery.toUpperCase() === "GO"
  ) {
    return null;
  }

  // Accept SELECT, WITH (CTE), INSERT, UPDATE, DELETE, and MERGE statements
  const upperQuery = trimmedQuery.toUpperCase();
  const startsWithSelect = upperQuery.startsWith("SELECT");
  const startsWithWith = upperQuery.startsWith("WITH");
  const startsWithInsert = upperQuery.startsWith("INSERT");
  const startsWithUpdate = upperQuery.startsWith("UPDATE");
  const startsWithDelete = upperQuery.startsWith("DELETE");
  const startsWithMerge = upperQuery.startsWith("MERGE");

  if (
    !startsWithSelect &&
    !startsWithWith &&
    !startsWithInsert &&
    !startsWithUpdate &&
    !startsWithDelete &&
    !startsWithMerge
  ) {
    return null; // Ignore unsupported statements
  }

  // Calculate the actual end position excluding trailing whitespace
  // Find the last non-whitespace character, excluding trailing comments and strings, in the original query
  let actualEndPosition = endPosition;
  for (let i = currentQuery.length - 1; i >= 0; i--) {
    if (
      !/\s/.test(currentQuery[i]) &&
      !commentPositions.has(startPosition + i)
    ) {
      actualEndPosition = startPosition + i + 1;
      break;
    }
  }

  return {
    query: trimmedQuery,
    startPosition,
    endPosition: actualEndPosition,
  };
}

/**
 * Pre-computes positions of characters inside strings and comments in the text.
 * This is used for efficient boundary detection during parsing.
 */
function computeStringAndCommentBoundaries(text: string): {
  stringPositions: Set<number>;
  commentPositions: Set<number>;
} {
  const stringPositions = new Set<number>();
  const commentPositions = new Set<number>();

  let inString = false;
  let stringChar = "";
  let inComment = false;
  let inlineComment = false;

  for (let j = 0; j < text.length; j++) {
    const char = text[j];
    const nextChar = text[j + 1];

    if (!inString && !inComment && char === "-" && nextChar === "-") {
      inlineComment = true;
      j++;
      continue;
    }

    if (inlineComment && char === "\n") {
      inlineComment = false;
      continue;
    }

    if (!inString && !inlineComment && char === "/" && nextChar === "*") {
      inComment = true;
      j++;
      continue;
    }

    if (inComment && char === "*" && nextChar === "/") {
      inComment = false;
      commentPositions.add(j);
      commentPositions.add(j + 1);
      j++;
      continue;
    }

    if (inlineComment || inComment) {
      commentPositions.add(j);
      continue;
    }

    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (inString && char === "\\" && nextChar === stringChar) {
      j++;
      continue;
    }

    if (inString && char === stringChar && nextChar === stringChar) {
      j++;
      continue;
    }

    if (inString && char === stringChar) {
      inString = false;
      stringPositions.add(j);
      stringChar = "";
      continue;
    }

    if (inString) {
      stringPositions.add(j);
    }
  }

  return { stringPositions, commentPositions };
}

/**
 * Parses SQL text and splits it into individual executable queries with position information
 * Handles semicolons in strings and comments properly
 * Also detects statement boundaries by SQL keywords (works without semicolons)
 */
export function splitSqlQueries(text: string): QueryPosition[] {
  if (!text.trim()) {
    return [];
  }

  const queries: QueryPosition[] = [];
  // Use array instead of string concatenation for better performance
  const workingText: string[] = [];
  let startPos = 0,
    currPos = 0;

  const context = createParsingContext();

  const { stringPositions, commentPositions } =
    computeStringAndCommentBoundaries(text);

  // Track parenthesis depth
  let parenDepth = 0;

  // Skip leading whitespace for the first query
  while (currPos < text.length && /\s/.test(text[currPos])) {
    currPos++;
  }
  startPos = currPos;

  while (currPos < text.length) {
    const char = text[currPos];

    const inString = stringPositions.has(currPos);
    const inComment = commentPositions.has(currPos);

    if (!inString && !inComment) {
      if (char === "(") {
        parenDepth++;
      } else if (char === ")") {
        parenDepth--;
      }
    }

    const semicolon = !inString && !inComment && char === ";";

    let nonKeywordReached = false;
    let boundaryReached = false;

    if (
      !semicolon &&
      !inString &&
      !inComment &&
      workingText.length > 0 &&
      parenDepth === 0
    ) {
      nonKeywordReached = isSkippableKeyword(
        text,
        currPos,
        context,
        parenDepth
      );

      // Check for statement boundary keyword
      if (!nonKeywordReached) {
        boundaryReached = isStatementBoundary(
          text,
          currPos,
          context,
          parenDepth
        );
      }
    }

    if (semicolon || boundaryReached || nonKeywordReached) {
      if (semicolon) {
        workingText.push(char);
        currPos++;
      }

      // Join array to string only when needed
      const queryText = workingText.join("");
      const query = finalizeQuery(
        queryText,
        startPos,
        currPos,
        commentPositions
      );

      if (query) {
        queries.push(query);
      }

      // Clear array efficiently
      workingText.length = 0;
      resetParsingContext(context);
      parenDepth = 0; // Reset depth

      // Skip whitespace after boundary to find next query start
      if (semicolon) {
        while (currPos < text.length && /\s/.test(text[currPos])) {
          currPos++;
        }
      }

      // If we hit a skipped keyword, skip the entire statement
      if (nonKeywordReached) {
        // Skip to the next semicolon or statement boundary keyword
        while (currPos < text.length) {
          const skipChar = text[currPos];
          const skipInString = stringPositions.has(currPos);
          const skipInComment = commentPositions.has(currPos);

          // Update depth while skipping
          if (!skipInString && !skipInComment) {
            if (skipChar === "(") {
              parenDepth++;
            } else if (skipChar === ")") {
              parenDepth--;
            }
          }

          // Check if we hit a semicolon
          if (!skipInString && !skipInComment && skipChar === ";") {
            currPos++; // Move past the semicolon
            // Skip trailing whitespace
            while (currPos < text.length && /\s/.test(text[currPos])) {
              currPos++;
            }
            parenDepth = 0; // Reset depth after semicolon
            break;
          }

          // Check if we hit a new statement boundary (SELECT, WITH, INSERT, UPDATE, DELETE, MERGE)
          if (
            !skipInString &&
            !skipInComment &&
            parenDepth === 0 &&
            isStatementBoundary(text, currPos, context, parenDepth)
          ) {
            parenDepth = 0; // Reset depth
            break; // Don't advance i, let the next iteration handle it
          }

          currPos++;
        }
      }

      startPos = currPos;
      continue;
    }

    // Track context for MERGE statements and other keywords (only outside strings/comments)
    if (!inString && !inComment) {
      updateParsingContext(
        context,
        text,
        currPos,
        char,
        parenDepth
      );
    }

    workingText.push(char);
    currPos++;
  }

  // Add the last query if it exists and is not empty
  const queryText = workingText.join("");
  const query = finalizeQuery(queryText, startPos, currPos, commentPositions);

  if (query) {
    queries.push(query);
  }

  return queries;
}
