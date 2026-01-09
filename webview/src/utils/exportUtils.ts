import { SchemaField } from "@src/types";
import { getVSCodeAPI } from "./vscode";

export type ExportFormat = "csv" | "excel" | "markdown" | "data-wrangler";

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  maxRows?: number; // For markdown format: number of rows to copy
  tabId?: string; // For markdown format: tab ID to include in success event
}

/**
 * Escapes a CSV cell value by wrapping in quotes and escaping internal quotes
 */
const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    // Escape internal quotes by doubling them
    const escapedValue = stringValue.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }

  return stringValue;
};

/**
 * Converts table data to CSV format
 */
export const convertToCSV = (
  data: unknown[][],
  schema: SchemaField[],
  includeHeaders = true
): string => {
  const rows: string[] = [];

  // Add headers if requested
  if (includeHeaders && schema.length > 0) {
    const headers = schema.map((field) => escapeCsvValue(field.name));
    rows.push(headers.join(","));
  }

  // Add data rows
  data.forEach((row) => {
    const csvRow = row.map((cell) => escapeCsvValue(cell));
    rows.push(csvRow.join(","));
  });

  return rows.join("\n");
};

/**
 * Escapes markdown table cell value by escaping pipes and newlines
 */
const escapeMarkdownValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  // Escape pipes and newlines
  return stringValue
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
};

/**
 * Converts table data to markdown table format
 */
export const convertToMarkdown = (
  data: unknown[][],
  schema: SchemaField[],
  maxRows?: number,
  includeHeaders = true
): string => {
  const rows: string[] = [];
  const limit =
    maxRows !== undefined ? Math.min(maxRows, data.length) : data.length;
  const dataToConvert = data.slice(0, limit);

  // Add headers if requested
  if (includeHeaders && schema.length > 0) {
    const headers = schema.map((field) => escapeMarkdownValue(field.name));
    rows.push(`| ${headers.join(" | ")} |`);

    // Add separator row
    const separators = schema.map(() => "---");
    rows.push(`| ${separators.join(" | ")} |`);
  }

  // Add data rows
  dataToConvert.forEach((row) => {
    const markdownRow = row.map((cell) => escapeMarkdownValue(cell));
    rows.push(`| ${markdownRow.join(" | ")} |`);
  });

  return rows.join("\n");
};

/**
 * Generates a filename with timestamp
 */
export const generateExportFilename = (
  baseFilename: string,
  format: ExportFormat,
  includeTimestamp = true
): string => {
  // Clean the base filename (remove special characters)
  const cleanName = baseFilename.replace(/[^a-zA-Z0-9\-_]/g, "_");

  const timestamp = includeTimestamp
    ? `_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}`
    : "";

  const extension =
    format === "csv" || format === "data-wrangler" ? "csv" : "xlsx";

  return `${cleanName}${timestamp}.${extension}`;
};

/**
 * Sends export request to VS Code extension to write file to disk
 */
export const requestFileExport = (
  data: unknown[][],
  schema: SchemaField[],
  options: ExportOptions
): void => {
  const vscode = getVSCodeAPI();
  vscode.postMessage({
    type: "wv.exportData",
    payload: {
      data,
      schema: schema.map((field) => ({ name: field.name, type: field.type })),
      format: options.format,
      filename: options.filename,
      includeHeaders: options.includeHeaders,
    },
  });
};

/**
 * Main export function that handles different formats
 * For file-based exports (csv, excel, data-wrangler): sends request to VS Code extension
 * For markdown: copies to clipboard directly in webview and dispatches success event
 */
export const exportTableData = async (
  data: unknown[][],
  schema: SchemaField[],
  options: ExportOptions
): Promise<void> => {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  if (!schema || schema.length === 0) {
    throw new Error("No schema information available");
  }

  const { format, filename, includeHeaders = true, maxRows, tabId } = options;

  // Handle markdown format separately (copy to clipboard in webview)
  if (format === "markdown") {
    const markdown = convertToMarkdown(data, schema, maxRows, includeHeaders);
    await navigator.clipboard.writeText(markdown);

    // Dispatch custom event to notify ExportButton that markdown copy succeeded
    if (tabId) {
      window.dispatchEvent(
        new CustomEvent("markdownCopySuccess", { detail: { tabId } })
      );
    }
    return;
  }

  // Send export request to VS Code extension for file-based formats
  requestFileExport(data, schema, {
    format,
    filename: filename ?? generateExportFilename("export", format),
    includeHeaders,
  });
};
