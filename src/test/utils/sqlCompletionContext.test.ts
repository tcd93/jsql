import { describe, expect, it } from "vitest";
import { detectSqlContextAction, splitSqlQueries } from "../../utils";

describe("SQL completion context with bracketed identifiers", () => {
  it("does not split a query on WITH inside a bracketed column name", () => {
    const query =
      "SELECT t.[column with space] FROM dbo.test_table1 AS t;";

    expect(splitSqlQueries(query)).toHaveLength(1);
  });

  it("retains table context for column suggestions after a comma", () => {
    const query = "SELECT t.[column with space], t.Id FROM dbo.test_table1 AS t";
    const cursor = query.indexOf("t.Id") + "t.".length;
    const context = detectSqlContextAction(query, cursor);

    expect(context?.actionType).toBe("list_column");
    if (context?.actionType === "list_column") {
      expect(context.tablesInContext).toContainEqual(
        expect.objectContaining({
          name: "dbo.test_table1",
          alias: "t",
        })
      );
    }
  });

  it("does not split on WITH inside a double-quoted identifier", () => {
    const query = 'SELECT t."column with space" FROM dbo.test_table1 AS t;';

    expect(splitSqlQueries(query)).toHaveLength(1);
  });

  it("retains table context after a double-quoted column and comma", () => {
    const query =
      'SELECT t."column with space", t.Id FROM dbo.test_table1 AS t';
    const cursor = query.indexOf("t.Id") + "t.".length;
    const context = detectSqlContextAction(query, cursor);

    expect(context?.actionType).toBe("list_column");
    if (context?.actionType === "list_column") {
      expect(context.tablesInContext).toContainEqual(
        expect.objectContaining({
          name: "dbo.test_table1",
          alias: "t",
        })
      );
    }
  });
});
