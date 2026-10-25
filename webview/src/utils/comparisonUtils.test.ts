import { SchemaField } from "@src/types";
import { describe, expect, it } from "vitest";
import {
  ComparisonAccumulator,
  compareTabData,
  mapColumns,
} from "./comparisonUtils";

const schema = (names: string[]): SchemaField[] =>
  names.map((name) => ({ name, type: "nvarchar" }));

describe("comparisonUtils", () => {
  it("matches rows by key when result order differs", () => {
    const mappings = mapColumns(schema(["id", "name"]), schema(["name", "id"]));
    const result = compareTabData(
      [
        [1, "Alice"],
        [2, "Bob"],
      ],
      [
        ["Bobby", 2],
        ["Alice", 1],
      ],
      mappings,
      ["id"],
    );

    expect(result.matchedRows).toBe(2);
    expect(result.differences).toEqual(new Set(["0,0"]));
    expect(result.baseDifferences).toEqual(new Set(["1,1"]));
    expect(result.comparisonDifferenceDetails.get("0,0")).toEqual({
      baseValue: "Bob",
      comparisonValue: "Bobby",
      columnName: "name",
    });
    expect(result.baseDifferenceDetails.get("1,1")).toEqual({
      baseValue: "Bob",
      comparisonValue: "Bobby",
      columnName: "name",
    });
  });

  it("marks duplicate keys ambiguous instead of matching by position", () => {
    const mappings = mapColumns(schema(["id", "name"]), schema(["id", "name"]));
    const result = compareTabData(
      [
        [1, "Alice"],
        [2, "Bob"],
      ],
      [
        [1, "Alice"],
        [2, "Bob"],
        [2, "Robert"],
      ],
      mappings,
      ["id"],
    );

    expect(result.duplicateBaseRows.size).toBe(0);
    expect(result.duplicateComparisonRows).toEqual(new Set([1, 2]));
    expect(result.ambiguousComparisonRows).toEqual(new Set([1, 2]));
    expect(result.differences.size).toBe(0);
  });

  it("flags ambiguous rows on both sides when only the base has duplicate keys", () => {
    const mappings = mapColumns(schema(["id", "name"]), schema(["id", "name"]));
    const result = compareTabData(
      [
        [1, "Alice"],
        [1, "Alicia"],
      ],
      [[1, "Alice"]],
      mappings,
      ["id"],
    );

    expect(result.duplicateBaseRows).toEqual(new Set([0, 1]));
    expect(result.ambiguousBaseRows).toEqual(new Set([0, 1]));
    expect(result.ambiguousComparisonRows).toEqual(new Set([0]));
    expect(result.duplicateComparisonRows.size).toBe(0);
    expect(result.differences.size).toBe(0);
  });

  it("counts added and removed rows by key", () => {
    const mappings = mapColumns(schema(["id", "name"]), schema(["id", "name"]));
    const result = compareTabData(
      [
        [1, "Alice"],
        [2, "Bob"],
      ],
      [
        [1, "Alice"],
        [3, "Carol"],
      ],
      mappings,
      ["id"],
    );

    expect(result.unmatchedComparisonRows).toEqual(new Set([1]));
    expect(result.unmatchedBaseRows).toBe(1);
  });

  it("supports composite keys and treats null keys as unmatched", () => {
    const mappings = mapColumns(
      schema(["tenantId", "itemId", "value"]),
      schema(["tenantId", "itemId", "value"]),
    );
    const result = compareTabData(
      [
        [1, 7, "same"],
        [1, null, "no key"],
      ],
      [
        [1, 7, "same"],
        [1, null, "no key"],
      ],
      mappings,
      ["tenantId", "itemId"],
    );

    expect(result.matchedRows).toBe(1);
    expect(result.unmatchedBaseRows).toBe(0);
    expect(result.unmatchedComparisonRows).toEqual(new Set());
    expect(result.unmatchableBaseRows).toEqual(new Set([1]));
    expect(result.unmatchableComparisonRows).toEqual(new Set([1]));
    expect(result.ambiguousBaseRows).toEqual(new Set([1]));
    expect(result.ambiguousComparisonRows).toEqual(new Set([1]));
  });

  it("does not report NULL-key rows as added or removed", () => {
    const mappings = mapColumns(schema(["id", "value"]), schema(["id", "value"]));
    const result = compareTabData(
      [[null, "base"]],
      [[null, "comparison"]],
      mappings,
      ["id"],
    );

    expect(result.unmatchableBaseRows).toEqual(new Set([0]));
    expect(result.unmatchableComparisonRows).toEqual(new Set([0]));
    expect(result.unmatchedBaseRows).toBe(0);
    expect(result.unmatchedBaseRowIndexes.size).toBe(0);
    expect(result.unmatchedComparisonRows.size).toBe(0);
  });

  it("excludes duplicate column names because their mapping is ambiguous", () => {
    expect(
      mapColumns(schema(["id", "value", "value"]), schema(["id", "value"])).map(
        (mapping) => mapping.columnName,
      ),
    ).toEqual(["id"]);
  });

  it("updates only newly streamed rows and matches full comparison output", () => {
    const mappings = mapColumns(schema(["id", "value"]), schema(["id", "value"]));
    const baseRows: unknown[][] = [
      [1, "base"],
      [2, "base only"],
    ];
    const comparisonRows: unknown[][] = [[1, "old"]];
    const accumulator = new ComparisonAccumulator(
      baseRows,
      comparisonRows,
      mappings,
      ["id"],
    );

    expect(accumulator.result).toEqual(
      compareTabData(baseRows, comparisonRows, mappings, ["id"]),
    );

    comparisonRows.push([1, "duplicate"], [2, "now matched"]);
    expect(accumulator.update()).toBe(true);
    expect(accumulator.result).toEqual(
      compareTabData(baseRows, comparisonRows, mappings, ["id"]),
    );
    expect(accumulator.result.duplicateComparisonRows).toEqual(new Set([0, 1]));
    expect(accumulator.result.unmatchedBaseRows).toBe(0);

    baseRows.push([null, "unmatchable"]);
    expect(accumulator.update()).toBe(true);
    expect(accumulator.result).toEqual(
      compareTabData(baseRows, comparisonRows, mappings, ["id"]),
    );
    expect(accumulator.update()).toBe(false);
  });
});
