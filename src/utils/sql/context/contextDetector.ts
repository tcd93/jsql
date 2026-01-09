/**
 * SQL context detection and table parsing
 */

import { findQueryRangeAtCursor } from "../parser/queryFinder";
import { SQLContext, TableInfo, SQLNamespace } from "../types";

/**
 * Parse table aliases from the SQL text
 */
function parseText(sqlText: string): TableInfo[] {
  const tables: TableInfo[] = [];

  // Normalize whitespace (flatten line breaks)
  const normalizedSql = sqlText.trim();

  // Match FROM clause, stopping at JOIN/WHERE/GROUP/ORDER or end
  const fromMatch = normalizedSql.match(
    /\bFROM\s+(.+?)(?=\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b|\bWHERE\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|$)/is
  );

  if (fromMatch) {
    const fromClause = fromMatch[1];
    const cleanedFrom = fromClause
      .replace(/\/\*[\s\S]*?\*\//g, "") // strip /* ... */
      .replace(/--.*$/gm, "") // strip -- ...
      .trim();

    cleanedFrom.split(",").forEach((tableExpr, idx) => {
      const match = tableExpr.match(
        /\b([\w.]+)(?:\s*(?:\/\*.*?\*\/\s*)*(?:AS\s*(?:\/\*.*?\*\/\s*)*)?(\w+))?/i
      );
      if (match) {
        const tableName = match[1];
        const alias = match[2] ?? tableName.split(".").pop();
        tables.push({
          name: tableName,
          alias,
          type: "table",
        });
      } else {
        console.warn(`Could not parse tableExpr[${idx}]:`, tableExpr);
      }
    });
  }

  // Now parse JOINs, this regexp accounts for comments in between the JOIN keyword and the table name
  const joinRegex =
    /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+(?:\/\*.*?\*\/\s*)*([\w.]+)(?:\s*(?:\/\*.*?\*\/\s*)*(?:AS\s+)?(\w+))?/gi;
  let joinMatch;
  while ((joinMatch = joinRegex.exec(normalizedSql))) {
    const tableName = joinMatch[1];
    const alias = joinMatch[2] ?? tableName.split(".").pop();
    tables.push({ name: tableName, alias, type: "table" });
  }

  // console.debug("parseText", tables);

  return tables;
}

/**
 * Recursively flatten schema to get all tables/views with their columns
 */
export function flattenSchema(schemaData: SQLNamespace): TableInfo[] {
  const result: TableInfo[] = [];

  const walk = (
    node: {
      self: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      children: SQLNamespace;
    },
    path: string[]
  ): void => {
    if (!node) {
      return;
    }

    if (
      node.self &&
      (node.self.type === "table" || node.self.type === "view")
    ) {
      result.push({
        fqName: path.join("."),
        name: node.self.label,
        type: node.self.type,
        detail: node.self.detail,
        columns: Array.isArray(node.children) ? node.children : [],
      });
    } else if (
      node.children &&
      typeof node.children === "object" &&
      !Array.isArray(node.children)
    ) {
      for (const key in node.children) {
        walk(node.children[key as keyof SQLNamespace], [...path, key]);
      }
    }
  };

  for (const catalog in schemaData) {
    walk(schemaData[catalog as keyof SQLNamespace], [catalog]);
  }

  return result;
}

/**
 * Detect SQL context at cursor position for completion suggestions
 */
export function detectSqlContextAction(
  documentText: string,
  cursorOffset: number
): SQLContext | null {
  const queryRange = findQueryRangeAtCursor(documentText, cursorOffset);
  if (!queryRange) {
    return null;
  }

  // Get the text before cursor and normalize into one line
  const before = documentText
    .slice(queryRange.from, cursorOffset)
    .replace(/\n/g, " ");

  // Check for table context (FROM, JOIN, etc.)
  const tableMatch =
    /\b(?:FROM|JOIN|INTO|UPDATE)\b\s+([\w.]*)(?!.*(\b(WHERE|ON)\b|;|\s+))/i.exec(
      before
    );
  if (tableMatch) {
    return { actionType: "list_table" };
  }

  // Don't return context after semicolon
  if (before.endsWith(";")) {
    return null;
  }

  // Otherwise, return column context
  const tablesInContext = parseText(queryRange.query);
  return { actionType: "list_column", tablesInContext };
}
