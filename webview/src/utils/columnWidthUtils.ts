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
let measureCanvasContext: CanvasRenderingContext2D | null = null;

const getMeasureContext = (): CanvasRenderingContext2D | null => {
  if (typeof document === "undefined") {
    return null;
  }

  if (!measureCanvasContext) {
    const canvas = document.createElement("canvas");
    measureCanvasContext = canvas.getContext("2d");
  }

  return measureCanvasContext;
};

const measureTextWidth = (
  text: string,
  bold: boolean,
  fontSize: number,
  fontFamily: string,
): number => {
  const ctx = getMeasureContext();
  if (!ctx) {
    // Fallback heuristic when canvas measurement isn't available (e.g. tests).
    return text.length * fontSize * (bold ? 0.62 : 0.55);
  }
  ctx.font = `${bold ? "600 " : ""}${fontSize}px ${fontFamily}`;
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
  const cellStyle =
    typeof document === "undefined"
      ? undefined
      : getComputedStyle(document.body);
  const parsedFontSize = Number.parseFloat(cellStyle?.fontSize ?? "");
  const fontSize = Number.isNaN(parsedFontSize) ? 13 : parsedFontSize;
  const fontFamily = cellStyle?.fontFamily ?? "sans-serif";
  const headerWidth =
    measureTextWidth(header, true, fontSize, fontFamily) +
    HEADER_CELL_CHROME_PX +
    SAFETY_MARGIN_PX;

  let maxValueWidth = 0;
  for (const value of values) {
    const formatted = formatCell(value, dataType);
    const text = formatted ?? "null";
    const width = measureTextWidth(text, false, fontSize, fontFamily);
    if (width > maxValueWidth) {
      maxValueWidth = width;
    }
  }
  const dataWidth = maxValueWidth + DATA_CELL_CHROME_PX + SAFETY_MARGIN_PX;

  return Math.ceil(Math.max(headerWidth, dataWidth));
};
