import { describe, expect, it } from "vitest";
import { formatCell } from "./formatUtils";

describe("formatCell", () => {
  it("preserves SQL date values without timezone conversion", () => {
    expect(formatCell("2025-02-20T00:00:00", "Date")).toBe("2025-02-20");
  });

  it("preserves SQL datetime wall-clock values", () => {
    expect(formatCell("2025-02-20T14:35:12.1234567", "DateTime")).toBe(
      "2025-02-20 14:35:12",
    );
  });

  it("returns unrecognized datetime values unchanged", () => {
    expect(formatCell("not-a-date", "DateTime")).toBe("not-a-date");
  });
});
