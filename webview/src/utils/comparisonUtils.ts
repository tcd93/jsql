import { SchemaField } from "@src/types";

export interface ColumnMapping {
  baseIndex: number;
  comparisonIndex: number;
  columnName: string;
}

export interface ComparisonResult {
  columnMappings: ColumnMapping[];
  differences: Set<string>;
  baseDifferences: Set<string>;
  comparisonDifferenceDetails: Map<
    string,
    { baseValue: unknown; comparisonValue: unknown; columnName: string }
  >;
  baseDifferenceDetails: Map<
    string,
    { baseValue: unknown; comparisonValue: unknown; columnName: string }
  >;
  comparisonRowKeys: Map<number, string>;
  baseRowKeys: Map<number, string>;
  duplicateComparisonRows: Set<number>;
  duplicateBaseRows: Set<number>;
  ambiguousComparisonRows: Set<number>;
  ambiguousBaseRows: Set<number>;
  unmatchableComparisonRows: Set<number>;
  unmatchableBaseRows: Set<number>;
  unmatchedComparisonRows: Set<number>;
  unmatchedBaseRows: number;
  unmatchedBaseRowIndexes: Set<number>;
  matchedRows: number;
}

/**
 * Maps unambiguous columns between two schemas by matching names
 * case-insensitively.
 */
export function mapColumns(
  baseSchema: SchemaField[],
  comparisonSchema: SchemaField[],
): ColumnMapping[] {
  const baseIndexes = uniqueColumnIndexes(baseSchema);
  const comparisonIndexes = uniqueColumnIndexes(comparisonSchema);
  const mappings: ColumnMapping[] = [];

  baseIndexes.forEach((baseIndex, normalizedName) => {
    const comparisonIndex = comparisonIndexes.get(normalizedName);
    if (comparisonIndex !== undefined) {
      mappings.push({
        baseIndex,
        comparisonIndex,
        columnName: baseSchema[baseIndex].name,
      });
    }
  });

  return mappings;
}

function uniqueColumnIndexes(schema: SchemaField[]): Map<string, number> {
  const indexes = new Map<string, number>();
  const duplicates = new Set<string>();

  schema.forEach((field, index) => {
    const name = field.name.toLowerCase();
    if (indexes.has(name)) {
      duplicates.add(name);
    } else {
      indexes.set(name, index);
    }
  });

  duplicates.forEach((name) => indexes.delete(name));
  return indexes;
}

/**
 * Matches rows by the selected shared key columns, then compares all shared
 * columns for keys that identify exactly one row in each result.
 */
export function compareTabData(
  baseData: unknown[][],
  comparisonData: unknown[][],
  columnMappings: ColumnMapping[],
  keyColumnNames: string[],
): ComparisonResult {
  const differences = new Set<string>();
  const baseDifferences = new Set<string>();
  const comparisonDifferenceDetails = new Map<
    string,
    { baseValue: unknown; comparisonValue: unknown; columnName: string }
  >();
  const baseDifferenceDetails = new Map<
    string,
    { baseValue: unknown; comparisonValue: unknown; columnName: string }
  >();
  const duplicateComparisonRows = new Set<number>();
  const duplicateBaseRows = new Set<number>();
  const ambiguousComparisonRows = new Set<number>();
  const ambiguousBaseRows = new Set<number>();
  const unmatchableComparisonRows = new Set<number>();
  const unmatchableBaseRows = new Set<number>();
  const unmatchedComparisonRows = new Set<number>();
  const unmatchedBaseRowIndexes = new Set<number>();
  const keyNames = new Set(keyColumnNames.map((name) => name.toLowerCase()));
  const keyMappings = columnMappings.filter((mapping) =>
    keyNames.has(mapping.columnName.toLowerCase()),
  );
  const indexedBaseRows = indexRows(baseData, keyMappings, "baseIndex");
  const indexedComparisonRows = indexRows(
    comparisonData,
    keyMappings,
    "comparisonIndex",
  );
  const baseRowsByKey = indexedBaseRows.rowsByKey;
  const comparisonRowsByKey = indexedComparisonRows.rowsByKey;
  const baseRowKeys = getRowKeyLabels(baseData, keyMappings, "baseIndex");
  const comparisonRowKeys = getRowKeyLabels(
    comparisonData,
    keyMappings,
    "comparisonIndex",
  );
  indexedBaseRows.unmatchableRows.forEach((index) => {
    unmatchableBaseRows.add(index);
    ambiguousBaseRows.add(index);
  });
  indexedComparisonRows.unmatchableRows.forEach((index) => {
    unmatchableComparisonRows.add(index);
    ambiguousComparisonRows.add(index);
  });
  let unmatchedBaseRows = 0;
  let matchedRows = 0;

  const allKeys = new Set([
    ...baseRowsByKey.keys(),
    ...comparisonRowsByKey.keys(),
  ]);

  allKeys.forEach((key) => {
    const baseIndexes = baseRowsByKey.get(key) ?? [];
    const comparisonIndexes = comparisonRowsByKey.get(key) ?? [];

    if (baseIndexes.length > 1 || comparisonIndexes.length > 1) {
      if (baseIndexes.length > 1) {
        baseIndexes.forEach((index) => duplicateBaseRows.add(index));
      }
      baseIndexes.forEach((index) => ambiguousBaseRows.add(index));
      if (comparisonIndexes.length > 1) {
        comparisonIndexes.forEach((index) =>
          duplicateComparisonRows.add(index),
        );
      }
      comparisonIndexes.forEach((index) => ambiguousComparisonRows.add(index));
      return;
    }

    if (baseIndexes.length === 0) {
      comparisonIndexes.forEach((index) => unmatchedComparisonRows.add(index));
      return;
    }

    if (comparisonIndexes.length === 0) {
      unmatchedBaseRows += baseIndexes.length;
      baseIndexes.forEach((index) => unmatchedBaseRowIndexes.add(index));
      return;
    }

    matchedRows++;
    const baseRow = baseData[baseIndexes[0]];
    const comparisonRow = comparisonData[comparisonIndexes[0]];
    columnMappings.forEach((mapping) => {
      if (
        !valuesEqual(
          baseRow[mapping.baseIndex],
          comparisonRow[mapping.comparisonIndex],
        )
      ) {
        differences.add(`${comparisonIndexes[0]},${mapping.comparisonIndex}`);
        baseDifferences.add(`${baseIndexes[0]},${mapping.baseIndex}`);
        const detail = {
          baseValue: baseRow[mapping.baseIndex],
          comparisonValue: comparisonRow[mapping.comparisonIndex],
          columnName: mapping.columnName,
        };
        comparisonDifferenceDetails.set(
          `${comparisonIndexes[0]},${mapping.comparisonIndex}`,
          detail,
        );
        baseDifferenceDetails.set(
          `${baseIndexes[0]},${mapping.baseIndex}`,
          detail,
        );
      }
    });
  });

  return {
    columnMappings,
    differences,
    baseDifferences,
    comparisonDifferenceDetails,
    baseDifferenceDetails,
    comparisonRowKeys,
    baseRowKeys,
    duplicateComparisonRows,
    duplicateBaseRows,
    ambiguousComparisonRows,
    ambiguousBaseRows,
    unmatchableComparisonRows,
    unmatchableBaseRows,
    unmatchedComparisonRows,
    unmatchedBaseRows,
    unmatchedBaseRowIndexes,
    matchedRows,
  };
}

function getRowKeyLabels(
  rows: unknown[][],
  keyMappings: ColumnMapping[],
  indexProperty: "baseIndex" | "comparisonIndex",
): Map<number, string> {
  return new Map(
    rows.map((row, rowIndex) => [
      rowIndex,
      keyMappings
        .map((mapping) => {
          const value = row[mapping[indexProperty]];
          return `${mapping.columnName}=${value === null || value === undefined ? "NULL" : String(value)}`;
        })
        .join(", "),
    ]),
  );
}

interface IndexedRows {
  rowsByKey: Map<string, number[]>;
  unmatchableRows: Set<number>;
}

function indexRows(
  rows: unknown[][],
  keyMappings: ColumnMapping[],
  indexProperty: "baseIndex" | "comparisonIndex",
): IndexedRows {
  const rowsByKey = new Map<string, number[]>();
  const unmatchableRows = new Set<number>();

  rows.forEach((row, rowIndex) => {
    const keyValues = keyMappings.map((mapping) => row[mapping[indexProperty]]);
    if (
      keyValues.length === 0 ||
      keyValues.some((value) => value === null || value === undefined)
    ) {
      unmatchableRows.add(rowIndex);
      return;
    }

    const key = JSON.stringify(keyValues.map((value) => String(value)));
    const indexes = rowsByKey.get(key);
    if (indexes) {
      indexes.push(rowIndex);
    } else {
      rowsByKey.set(key, [rowIndex]);
    }
  });

  return { rowsByKey, unmatchableRows };
}

function valuesEqual(value1: unknown, value2: unknown): boolean {
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

  return String(value1) === String(value2);
}
