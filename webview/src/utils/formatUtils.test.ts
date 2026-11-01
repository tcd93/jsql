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

  it("displays timezone-qualified timestamps in local time", () => {
    const instant = new Date("2026-11-01T17:12:38.942Z");
    const pad = (part: number): string => String(part).padStart(2, "0");
    const expected = `${String(instant.getFullYear()).padStart(4, "0")}-${pad(
      instant.getMonth() + 1,
    )}-${pad(instant.getDate())} ${pad(instant.getHours())}:${pad(
      instant.getMinutes(),
    )}:${pad(instant.getSeconds())}`;

    expect(
      formatCell("2026-11-01T17:12:38.942Z", "TIMESTAMP"),
    ).toBe(expected);
  });

  it("returns unrecognized datetime values unchanged", () => {
    expect(formatCell("not-a-date", "DateTime")).toBe("not-a-date");
  });
});
