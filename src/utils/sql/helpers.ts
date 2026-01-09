/**
 * Helper utilities for SQL parsing
 */

/**
 * Checks if a query contains only comments and whitespace
 */
export function isOnlyComments(query: string): boolean {
  // Remove all comments and check if only whitespace/semicolons remain
  const withoutComments = query
    .replace(/--.*$/gm, "") // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
    .replace(/;/g, "") // Remove semicolons
    .trim();

  return withoutComments === "";
}

/**
 * Generates a meaningful title for a query based on its content
 */
export function generateQueryTitle(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return "Empty Query";
  }

  // Remove comments and extra whitespace
  const cleanQuery = trimmed
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Extract the first significant part (usually the operation)
  const firstLine = cleanQuery.split("\n")[0] || cleanQuery;
  const words = firstLine.split(" ").filter((w) => w.length > 0);

  if (words.length === 0) {
    return "Query";
  }

  // Take first few words for the title
  const titleWords = words.slice(0, 4);
  let title = titleWords.join(" ");

  // Truncate if too long
  if (title.length > 30) {
    title = `${title.substring(0, 27)}...`;
  }

  return title;
}
