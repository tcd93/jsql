import { describe, expect, it } from "vitest";
import { getMssqlConnectionAuthMetadata } from "../../services/MssqlConnectionMetadata";

describe("MSSQL saved connection auth metadata", () => {
  it("returns only account and tenant hints for an exact connection ID match", () => {
    const metadata = getMssqlConnectionAuthMetadata(
      [
        {
          id: "connection-id",
          user: "sql-user@example.com",
          email: "account@example.com",
          tenantId: "tenant-id",
          azureAccountToken: "must-not-be-returned",
        },
      ],
      "connection-id",
    );

    expect(metadata).toEqual({
      username: "account@example.com",
      tenantId: "tenant-id",
    });
  });

  it("uses the saved user when email is unavailable", () => {
    expect(
      getMssqlConnectionAuthMetadata(
        [{ id: "connection-id", user: "sql-user@example.com" }],
        "connection-id",
      ),
    ).toEqual({ username: "sql-user@example.com", tenantId: undefined });
  });

  it("does not select a profile if the ID is missing or ambiguous", () => {
    const connection = { id: "connection-id", email: "account@example.com" };

    expect(getMssqlConnectionAuthMetadata([connection], "other-id")).toBe(
      undefined,
    );
    expect(
      getMssqlConnectionAuthMetadata(
        [connection, { ...connection, tenantId: "other-tenant" }],
        "connection-id",
      ),
    ).toBe(undefined);
  });

  it("returns empty hints for a matched profile with no metadata", () => {
    expect(
      getMssqlConnectionAuthMetadata(
        [{ id: "connection-id", email: " ", tenantId: "" }],
        "connection-id",
      ),
    ).toEqual({ username: undefined, tenantId: undefined });
  });

  it("ignores malformed settings", () => {
    expect(getMssqlConnectionAuthMetadata(undefined, "connection-id")).toBe(
      undefined,
    );
  });
});
