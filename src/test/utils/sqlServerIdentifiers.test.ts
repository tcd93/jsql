import { describe, expect, it } from "vitest";
import {
  quoteSqlServerColumnCompletion,
  quoteSqlServerIdentifier,
  quoteSqlServerQualifiedIdentifier,
} from "../../utils";

describe("SQL Server completion identifiers", () => {
  it("leaves simple identifiers unquoted", () => {
    expect(quoteSqlServerIdentifier("Column1")).toBe("Column1");
  });

  it("brackets identifiers containing spaces and escapes closing brackets", () => {
    expect(quoteSqlServerIdentifier("column with ] space")).toBe(
      "[column with ]] space]"
    );
  });

  it("brackets each part of a qualified table name", () => {
    expect(quoteSqlServerQualifiedIdentifier("dbo.Table Name")).toBe(
      "dbo.[Table Name]"
    );
  });

  it("quotes a column name without quoting its table alias", () => {
    expect(quoteSqlServerColumnCompletion("t.column with space")).toBe(
      "t.[column with space]"
    );
  });
});
