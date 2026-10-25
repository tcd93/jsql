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

interface KeyComparisonState {
  duplicateComparisonRows: Set<number>;
  duplicateBaseRows: Set<number>;
  ambiguousComparisonRows: Set<number>;
  ambiguousBaseRows: Set<number>;
  unmatchedComparisonRows: Set<number>;
  unmatchedBaseRows: Set<number>;
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
  matchedRows: number;
}

/**
 * Maintains key indexes and updates comparison output only for keys whose rows
 * have arrived since the previous update.
 */
export class ComparisonAccumulator {
  readonly result: ComparisonResult;
  private readonly keyMappings: ColumnMapping[];
  private readonly baseRowsByKey = new Map<string, number[]>();
  private readonly comparisonRowsByKey = new Map<string, number[]>();
  private readonly keyResults = new Map<string, KeyComparisonState>();
  private indexedBaseRowCount: number;
  private indexedComparisonRowCount: number;

  constructor(
    private readonly baseRows: unknown[][],
    private readonly comparisonRows: unknown[][],
    columnMappings: ColumnMapping[],
    keyColumnNames: string[],
  ) {
    const keyNames = new Set(keyColumnNames.map((name) => name.toLowerCase()));
    this.keyMappings = columnMappings.filter((mapping) =>
      keyNames.has(mapping.columnName.toLowerCase()),
    );
    this.result = {
      columnMappings,
      differences: new Set(),
      baseDifferences: new Set(),
      comparisonDifferenceDetails: new Map(),
      baseDifferenceDetails: new Map(),
      comparisonRowKeys: new Map(),
      baseRowKeys: new Map(),
      duplicateComparisonRows: new Set(),
      duplicateBaseRows: new Set(),
      ambiguousComparisonRows: new Set(),
      ambiguousBaseRows: new Set(),
      unmatchableComparisonRows: new Set(),
      unmatchableBaseRows: new Set(),
      unmatchedComparisonRows: new Set(),
      unmatchedBaseRows: 0,
      unmatchedBaseRowIndexes: new Set(),
      matchedRows: 0,
    };

    this.indexedBaseRowCount = this.indexRows(
      this.baseRows,
      "base",
      0,
    );
    this.indexedComparisonRowCount = this.indexRows(
      this.comparisonRows,
      "comparison",
      0,
    );
    new Set([
      ...this.baseRowsByKey.keys(),
      ...this.comparisonRowsByKey.keys(),
    ]).forEach((key) => this.rebuildKeyResult(key));
    this.result.unmatchedBaseRows = this.result.unmatchedBaseRowIndexes.size;
  }

  getSnapshot(): ComparisonResult {
    return { ...this.result };
  }

  update(): boolean {
    const affectedKeys = new Set<string>();
    const previousRowCount =
      this.indexedBaseRowCount + this.indexedComparisonRowCount;
    this.indexedBaseRowCount = this.indexRows(
      this.baseRows,
      "base",
      this.indexedBaseRowCount,
      affectedKeys,
    );
    this.indexedComparisonRowCount = this.indexRows(
      this.comparisonRows,
      "comparison",
      this.indexedComparisonRowCount,
      affectedKeys,
    );

    const hasNewRows =
      previousRowCount !==
      this.indexedBaseRowCount + this.indexedComparisonRowCount;
    if (!hasNewRows) {
      return false;
    }

    affectedKeys.forEach((key) => this.rebuildKeyResult(key));
    this.result.unmatchedBaseRows = this.result.unmatchedBaseRowIndexes.size;
    return true;
  }

  private indexRows(
    rows: unknown[][],
    side: "base" | "comparison",
    startIndex: number,
    affectedKeys = new Set<string>(),
  ): number {
    const rowKeys =
      side === "base"
        ? this.result.baseRowKeys
        : this.result.comparisonRowKeys;
    const rowsByKey =
      side === "base" ? this.baseRowsByKey : this.comparisonRowsByKey;

    for (let rowIndex = startIndex; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const values = this.keyMappings.map((mapping) =>
        row[mapping[side === "base" ? "baseIndex" : "comparisonIndex"]],
      );
      rowKeys.set(
        rowIndex,
        this.keyMappings
          .map((mapping, index) => {
            const value = values[index];
            return `${mapping.columnName}=${
              value === null || value === undefined ? "NULL" : String(value)
            }`;
          })
          .join(", "),
      );

      if (
        values.length === 0 ||
        values.some((value) => value === null || value === undefined)
      ) {
        if (side === "base") {
          this.result.unmatchableBaseRows.add(rowIndex);
          this.result.ambiguousBaseRows.add(rowIndex);
        } else {
          this.result.unmatchableComparisonRows.add(rowIndex);
          this.result.ambiguousComparisonRows.add(rowIndex);
        }
        continue;
      }

      const key = JSON.stringify(values.map((value) => String(value)));
      const indexes = rowsByKey.get(key);
      if (indexes) {
        indexes.push(rowIndex);
      } else {
        rowsByKey.set(key, [rowIndex]);
      }
      affectedKeys.add(key);
    }

    return rows.length;
  }

  private rebuildKeyResult(key: string): void {
    const previous = this.keyResults.get(key);
    if (previous) {
      this.removeKeyResult(previous);
    }

    const baseIndexes = this.baseRowsByKey.get(key) ?? [];
    const comparisonIndexes = this.comparisonRowsByKey.get(key) ?? [];
    const next: KeyComparisonState = {
      duplicateComparisonRows: new Set(),
      duplicateBaseRows: new Set(),
      ambiguousComparisonRows: new Set(),
      ambiguousBaseRows: new Set(),
      unmatchedComparisonRows: new Set(),
      unmatchedBaseRows: new Set(),
      differences: new Set(),
      baseDifferences: new Set(),
      comparisonDifferenceDetails: new Map(),
      baseDifferenceDetails: new Map(),
      matchedRows: 0,
    };

    if (baseIndexes.length > 1 || comparisonIndexes.length > 1) {
      if (baseIndexes.length > 1) {
        baseIndexes.forEach((index) => next.duplicateBaseRows.add(index));
      }
      baseIndexes.forEach((index) => next.ambiguousBaseRows.add(index));
      if (comparisonIndexes.length > 1) {
        comparisonIndexes.forEach((index) =>
          next.duplicateComparisonRows.add(index),
        );
      }
      comparisonIndexes.forEach((index) =>
        next.ambiguousComparisonRows.add(index),
      );
    } else if (baseIndexes.length === 0) {
      comparisonIndexes.forEach((index) =>
        next.unmatchedComparisonRows.add(index),
      );
    } else if (comparisonIndexes.length === 0) {
      baseIndexes.forEach((index) => next.unmatchedBaseRows.add(index));
    } else {
      next.matchedRows = 1;
      const baseRow = this.baseRows[baseIndexes[0]];
      const comparisonRow = this.comparisonRows[comparisonIndexes[0]];
      this.result.columnMappings.forEach((mapping) => {
        const baseValue = baseRow[mapping.baseIndex];
        const comparisonValue = comparisonRow[mapping.comparisonIndex];
        if (!valuesEqual(baseValue, comparisonValue)) {
          const comparisonCellKey = `${comparisonIndexes[0]},${mapping.comparisonIndex}`;
          const baseCellKey = `${baseIndexes[0]},${mapping.baseIndex}`;
          const detail = {
            baseValue,
            comparisonValue,
            columnName: mapping.columnName,
          };
          next.differences.add(comparisonCellKey);
          next.baseDifferences.add(baseCellKey);
          next.comparisonDifferenceDetails.set(comparisonCellKey, detail);
          next.baseDifferenceDetails.set(baseCellKey, detail);
        }
      });
    }

    this.addKeyResult(next);
    this.keyResults.set(key, next);
  }

  private addKeyResult(state: KeyComparisonState): void {
    this.mergeSet(this.result.duplicateComparisonRows, state.duplicateComparisonRows);
    this.mergeSet(this.result.duplicateBaseRows, state.duplicateBaseRows);
    this.mergeSet(this.result.ambiguousComparisonRows, state.ambiguousComparisonRows);
    this.mergeSet(this.result.ambiguousBaseRows, state.ambiguousBaseRows);
    this.mergeSet(this.result.unmatchedComparisonRows, state.unmatchedComparisonRows);
    this.mergeSet(this.result.unmatchedBaseRowIndexes, state.unmatchedBaseRows);
    this.mergeSet(this.result.differences, state.differences);
    this.mergeSet(this.result.baseDifferences, state.baseDifferences);
    this.mergeMap(
      this.result.comparisonDifferenceDetails,
      state.comparisonDifferenceDetails,
    );
    this.mergeMap(this.result.baseDifferenceDetails, state.baseDifferenceDetails);
    this.result.matchedRows += state.matchedRows;
  }

  private removeKeyResult(state: KeyComparisonState): void {
    this.removeSet(this.result.duplicateComparisonRows, state.duplicateComparisonRows);
    this.removeSet(this.result.duplicateBaseRows, state.duplicateBaseRows);
    this.removeSet(this.result.ambiguousComparisonRows, state.ambiguousComparisonRows);
    this.removeSet(this.result.ambiguousBaseRows, state.ambiguousBaseRows);
    this.removeSet(this.result.unmatchedComparisonRows, state.unmatchedComparisonRows);
    this.removeSet(this.result.unmatchedBaseRowIndexes, state.unmatchedBaseRows);
    this.removeSet(this.result.differences, state.differences);
    this.removeSet(this.result.baseDifferences, state.baseDifferences);
    this.removeMap(
      this.result.comparisonDifferenceDetails,
      state.comparisonDifferenceDetails,
    );
    this.removeMap(this.result.baseDifferenceDetails, state.baseDifferenceDetails);
    this.result.matchedRows -= state.matchedRows;
  }

  private mergeSet<T>(target: Set<T>, source: Set<T>): void {
    source.forEach((value) => target.add(value));
  }

  private removeSet<T>(target: Set<T>, source: Set<T>): void {
    source.forEach((value) => target.delete(value));
  }

  private mergeMap<K, V>(target: Map<K, V>, source: Map<K, V>): void {
    source.forEach((value, key) => target.set(key, value));
  }

  private removeMap<K, V>(target: Map<K, V>, source: Map<K, V>): void {
    source.forEach((_value, key) => target.delete(key));
  }
}

/**
 * Matches rows by selected shared keys and compares all shared columns.
 */
export function compareTabData(
  baseData: unknown[][],
  comparisonData: unknown[][],
  columnMappings: ColumnMapping[],
  keyColumnNames: string[],
): ComparisonResult {
  return new ComparisonAccumulator(
    baseData,
    comparisonData,
    columnMappings,
    keyColumnNames,
  ).getSnapshot();
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
