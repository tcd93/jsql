import { SchemaField } from "@src/types";

export interface ColumnMapping {
  baseIndex: number;
  comparisonIndex: number;
  columnName: string;
}

export interface ComparisonResult {
  columnMappings: ColumnMapping[];
  differences: Set<string>; // Set of "rowIndex,columnIndex" strings for efficient lookup
}

/**
 * Maps columns between two schemas by matching column names (case-insensitive)
 * @param baseSchema Schema of the base tab
 * @param comparisonSchema Schema of the comparison tab
 * @returns Array of column mappings
 */
export function mapColumns(
  baseSchema: SchemaField[],
  comparisonSchema: SchemaField[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  baseSchema.forEach((baseField, baseIndex) => {
    const comparisonIndex = comparisonSchema.findIndex(
      (compField) =>
        compField.name.toLowerCase() === baseField.name.toLowerCase()
    );

    if (comparisonIndex !== -1) {
      mappings.push({
        baseIndex,
        comparisonIndex,
        columnName: baseField.name,
      });
    }
  });

  return mappings;
}

/**
 * Compares data between two tabs and identifies differing cells
 * @param baseData Data from the base tab
 * @param comparisonData Data from the comparison tab
 * @param columnMappings Mappings between columns
 * @returns Comparison result with differences
 */
export function compareTabData(
  baseData: unknown[][],
  comparisonData: unknown[][],
  columnMappings: ColumnMapping[]
): ComparisonResult {
  const differences = new Set<string>();

  // Compare each row up to the minimum length of both datasets
  const maxRows = Math.max(baseData.length, comparisonData.length);

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const baseRow = baseData[rowIndex];
    const comparisonRow = comparisonData[rowIndex];

    // If one dataset has fewer rows, mark missing rows as different
    if (!baseRow || !comparisonRow) {
      columnMappings.forEach((mapping) => {
        differences.add(`${rowIndex},${mapping.comparisonIndex}`);
      });
      continue;
    }

    // Compare each mapped column
    columnMappings.forEach((mapping) => {
      const baseValue = baseRow[mapping.baseIndex];
      const comparisonValue = comparisonRow[mapping.comparisonIndex];

      if (!valuesEqual(baseValue, comparisonValue)) {
        differences.add(`${rowIndex},${mapping.comparisonIndex}`);
      }
    });
  }

  return {
    columnMappings,
    differences,
  };
}

/**
 * Checks if two values are equal, handling null/undefined cases
 * @param value1 First value to compare
 * @param value2 Second value to compare
 * @returns True if values are considered equal
 */
function valuesEqual(value1: unknown, value2: unknown): boolean {
  // Handle null/undefined cases
  if (
    (value1 === null || value1 === undefined) &&
    (value2 === null || value2 === undefined)
  ) {
    return true;
  }
  if (
    value1 === null ||
    value1 === undefined ||
    value2 === null ||
    value2 === undefined
  ) {
    return false;
  }

  // Convert to strings for comparison to handle various data types
  return String(value1) === String(value2);
}
