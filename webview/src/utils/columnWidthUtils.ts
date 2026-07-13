import { formatCell } from "./formatUtils";

/**
 * Utilities for estimating a "natural" column width based on its content
 */

// Horizontal padding + border budget for a data cell
const DATA_CELL_CHROME_PX = 26;
// Header cells reserve extra space for the sort/aggregation icons and resizer handle
const HEADER_CELL_CHROME_PX = 48;
// Canvas measureText vs. actual DOM text layout can differ slightly (font hinting,
// kerning, sub-pixel rounding), so pad estimates a bit to avoid clipping into ellipsis.
const SAFETY_MARGIN_PX = 10;
// Assumed font size for table cells, which is used to set the canvas context font for measuring text width.
const FONT_SIZE_PX = 11;

let measureCanvasContext: CanvasRenderingContext2D | null = null;
let cachedFontFamily: string | null = null;

const getMeasureContext = (): CanvasRenderingContext2D | null => {
  if (typeof document === "undefined") {
    return null;
  }

  if (!measureCanvasContext) {
    const canvas = document.createElement("canvas");
    measureCanvasContext = canvas.getContext("2d");
  }

  cachedFontFamily ??=
    getComputedStyle(document.body)
      .getPropertyValue("--vscode-font-family")
      .trim() || "sans-serif";

  return measureCanvasContext;
};

const measureTextWidth = (text: string, bold: boolean): number => {
  const ctx = getMeasureContext();
  if (!ctx || !cachedFontFamily) {
    // Fallback heuristic when canvas measurement isn't available (e.g. tests).
    return text.length * (bold ? 8 : 7);
  }
  ctx.font = `${bold ? "600 " : ""}${FONT_SIZE_PX}px ${cachedFontFamily}`;
  return ctx.measureText(text).width;
};

/**
 * Estimates a column's pixel width based on its header text and a sample of
 * its values, so columns are sized to fit their content rather than 
 * always defaulting to the same fixed width.
 */
export const estimateColumnWidth = (
  header: string,
  values: unknown[],
  dataType?: string,
): number => {
  const headerWidth =
    measureTextWidth(header, true) + HEADER_CELL_CHROME_PX + SAFETY_MARGIN_PX;

  let maxValueWidth = 0;
  for (const value of values) {
    const formatted = formatCell(value, dataType);
    const text = formatted ?? "null";
    const width = measureTextWidth(text, false);
    if (width > maxValueWidth) {
      maxValueWidth = width;
    }
  }
  const dataWidth = maxValueWidth + DATA_CELL_CHROME_PX + SAFETY_MARGIN_PX;

  return Math.ceil(Math.max(headerWidth, dataWidth));
};
