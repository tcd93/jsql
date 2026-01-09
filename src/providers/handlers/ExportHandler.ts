import * as os from "os";
import * as path from "path";
import * as ExcelJS from "exceljs";
import * as vscode from "vscode";
import { MessageService } from "../../services/MessageService";
import { OutputService } from "../../services/OutputService";
import {
  ExportDataSuccessMessage,
  ExportDataErrorMessage,
  ExportDataMessage,
} from "../../types";

export interface ExportHandler {
  handleExportData(message: ExportDataMessage): Promise<void>;
}

export class ExportHandlerImpl implements ExportHandler {
  constructor(
    private readonly messageService: MessageService,
    private readonly outputService: OutputService
  ) {}

  async handleExportData(message: ExportDataMessage): Promise<void> {
    let exportResult: { filepath: string; format: string } | null = null;

    try {
      const {
        data,
        schema,
        format,
        filename,
        includeHeaders = true,
      } = message.payload;

      if (!data || data.length === 0) {
        throw new Error("No data to export");
      }

      if (!schema || schema.length === 0) {
        throw new Error("No schema information available");
      }

      // Handle different export formats
      switch (format) {
        case "csv": {
          const fileContent = this.convertToCSV(data, schema, includeHeaders);
          const saveUri = await this.getSaveLocation(filename, "csv");
          if (!saveUri) {
            // User cancelled the save dialog
            return;
          }
          // Write the file
          const encoder = new TextEncoder();
          await vscode.workspace.fs.writeFile(
            saveUri,
            encoder.encode(fileContent)
          );
          exportResult = { filepath: saveUri.fsPath, format };
          break;
        }

        case "data-wrangler": {
          exportResult = await this.openInDataWrangler(
            data,
            schema,
            includeHeaders,
            filename
          );
          break;
        }

        case "excel": {
          exportResult = await this.convertToExcelTable(
            data,
            schema,
            includeHeaders,
            filename
          );
          break;
        }

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Centralized success handling
      if (exportResult) {
        // Notify success
        const successMessage: ExportDataSuccessMessage = {
          type: "ext.exportDataSuccess",
          payload: exportResult,
        };
        this.messageService.invoke(successMessage);

        // Show success notification to user
        const relativePath = vscode.workspace.asRelativePath(
          exportResult.filepath
        );
        const formatName =
          format === "data-wrangler" ? "Data Wrangler" : format.toUpperCase();
        this.outputService.showInfo(
          `Data exported successfully to ${relativePath} (${formatName})`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.outputService.writeToOutput(`Export failed: ${errorMsg}`, "ERROR");

      const errorMessage: ExportDataErrorMessage = {
        type: "ext.exportDataError",
        payload: {
          error: errorMsg,
        },
      };
      this.messageService.invoke(errorMessage);

      // Show error notification to user
      this.outputService.showError(`Export failed: ${errorMsg}`);
    }
  }

  private async getSaveLocation(
    suggestedFilename?: string,
    defaultExtension?: string
  ): Promise<vscode.Uri | undefined> {
    const options: vscode.SaveDialogOptions = {
      defaultUri: suggestedFilename
        ? vscode.Uri.file(
            path.join(
              vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
              suggestedFilename
            )
          )
        : undefined,
      filters: {},
    };

    // Set up file filters based on extension
    if (defaultExtension === "csv") {
      options.filters = {
        "CSV Files": ["csv"],
        "All Files": ["*"],
      };
    } else if (defaultExtension === "xlsx") {
      options.filters = {
        "Excel Files": ["xlsx"],
        "All Files": ["*"],
      };
    }

    return await vscode.window.showSaveDialog(options);
  }

  private async openInDataWrangler(
    data: unknown[][],
    schema: { name: string; type?: string }[],
    includeHeaders: boolean,
    suggestedFilename?: string
  ): Promise<{ filepath: string; format: string }> {
    try {
      // Generate CSV content
      const csvContent = this.convertToCSV(data, schema, includeHeaders);

      // Create a temporary file name
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = suggestedFilename
        ? `${suggestedFilename.replace(/\.[^/.]+$/, "")}_${timestamp}.csv`
        : `export_${timestamp}.csv`;

      const tempDir = vscode.Uri.file(os.tmpdir());

      // Ensure temp directory exists
      try {
        await vscode.workspace.fs.createDirectory(tempDir);
      } catch {
        // Directory might already exist, ignore error
      }

      const tempFileUri = vscode.Uri.joinPath(tempDir, filename);

      // Write the CSV file
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(
        tempFileUri,
        encoder.encode(csvContent)
      );

      // Check if Data Wrangler extension is installed
      const dataWranglerExtension = vscode.extensions.getExtension(
        "ms-toolsai.datawrangler"
      );
      if (!dataWranglerExtension) {
        // Prompt to install Data Wrangler
        const installChoice = await vscode.window.showInformationMessage(
          "Data Wrangler extension is required to open data for analysis. Would you like to install it?",
          "Install Data Wrangler",
          "Cancel"
        );

        if (installChoice === "Install Data Wrangler") {
          await vscode.commands.executeCommand(
            "workbench.extensions.search",
            "ms-toolsai.datawrangler"
          );
        }
        throw new Error(
          "Data Wrangler extension is required but not installed"
        );
      }

      // Ensure Data Wrangler is activated
      if (!dataWranglerExtension.isActive) {
        await dataWranglerExtension.activate();
      }

      // Try to open the file in Data Wrangler using the context menu command
      // This mimics right-clicking on a CSV file and selecting "Open in Data Wrangler"
      try {
        await vscode.commands.executeCommand("vscode.open", tempFileUri);
        // Small delay to ensure the file is opened first
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Try the Data Wrangler command
        await vscode.commands.executeCommand(
          "data-wrangler.openDataWrangler",
          tempFileUri
        );
      } catch (commandError) {
        this.outputService.writeToOutput(
          `Data Wrangler command failed: ${commandError}`,
          "DEBUG"
        );
      }

      // Return export result for centralized success handling
      return {
        filepath: tempFileUri.fsPath,
        format: "data-wrangler",
      };
    } catch (error) {
      throw new Error(
        `Failed to open in Data Wrangler: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private convertToCSV(
    data: unknown[][],
    schema: { name: string; type?: string }[],
    includeHeaders: boolean
  ): string {
    const rows: string[] = [];

    if (includeHeaders && schema.length > 0) {
      const headers = schema.map((field) => this.escapeCsvValue(field.name));
      rows.push(headers.join(","));
    }

    data.forEach((row) => {
      const csvRow = row.map((cell) => this.escapeCsvValue(cell));
      rows.push(csvRow.join(","));
    });

    return rows.join("\n");
  }

  private escapeCsvValue(value: unknown): string {
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
  }

  private async convertToExcelTable(
    data: unknown[][],
    schema: { name: string; type?: string }[],
    includeHeaders: boolean,
    suggestedFilename?: string
  ): Promise<{ filepath: string; format: string }> {
    try {
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "JSQL Extension";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Data", {
        properties: { tabColor: { argb: "FF0066CC" } },
      });

      if (data.length > 0) {
        const startCell = includeHeaders ? "A1" : "A1";
        const endCol = this.numberToColumnLetter(schema.length);
        const endRow = data.length + (includeHeaders ? 1 : 0);
        const tableRange = `${startCell}:${endCol}${endRow}`;

        worksheet.addTable({
          name: "DataTable",
          ref: tableRange,
          headerRow: includeHeaders,
          totalsRow: false,
          style: {
            theme: "TableStyleLight1",
            showRowStripes: true,
            showColumnStripes: false,
          },
          columns: schema.map((field) => ({
            name: field.name,
            filterButton: true,
          })),
          rows: data,
        });

        worksheet.columns.forEach((column, index) => {
          // Set width based on content from first 100 rows
          column.width = this.calculateOptimalColumnWidth(
            data,
            index,
            schema[index].name,
            100
          );

          // Apply formatting
          column.style = {
            // must set font property to avoid defaulting font color to black (use automatic)
            font: {
              bold: false,
            },
            numFmt: this.mapDataFormat(schema[index].type),
          };
        });

        // Freeze header row if present
        if (includeHeaders) {
          worksheet.views = [{ state: "frozen", ySplit: 1 }];
        }
      }

      // Save the Excel file
      const result = await this.saveExcelFile(workbook, suggestedFilename);
      if (!result) {
        throw new Error("Excel export was cancelled by user");
      }
      return result;
    } catch (error) {
      throw new Error(
        `Failed to create Excel table: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private numberToColumnLetter(columnNumber: number): string {
    let result = "";
    while (columnNumber > 0) {
      columnNumber--;
      result = String.fromCharCode(65 + (columnNumber % 26)) + result;
      columnNumber = Math.floor(columnNumber / 26);
    }
    return result;
  }

  private mapDataFormat(dataType?: string): string {
    if (!dataType) {
      return "@";
    }

    const normalizedType = dataType.toLowerCase();

    switch (normalizedType) {
      // Integer types
      case "int":
      case "integer":
      case "bigint":
      case "tinyint":
      case "smallint":
        return "0";

      // Decimal/Numeric types
      case "decimal":
      case "numeric":
      case "money":
      case "smallmoney":
        return "#,##0.00";

      // Floating point types
      case "float":
      case "real":
      case "double":
        return "#,##0.0000";

      // Date and time types
      case "date":
        return "yyyy-mm-dd";

      case "datetime":
      case "datetime2":
      case "smalldatetime":
        return "yyyy-mm-dd hh:mm:ss";
      case "time":
        return "hh:mm:ss";
      case "datetimeoffset":
        return "yyyy-mm-dd hh:mm:ss";

      // Boolean type
      case "bit":
        return "0"; // Show as 0/1

      case "currency":
        return "$#,##0.00";
      case "percentage":
        return "0.00%";
      case "number":
        return "#,##0.00";
      case "timestamp":
        return "yyyy-mm-dd hh:mm:ss";

      default:
        // Text format for unknown types
        return "@";
    }
  }

  private async saveExcelFile(
    workbook: ExcelJS.Workbook,
    fileName?: string
  ): Promise<{ filepath: string; format: string } | null> {
    // Determine the save location
    const saveUri = await this.getSaveLocation(fileName, "xlsx");
    if (!saveUri) {
      // User cancelled the save dialog
      return null;
    }

    // Write the Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    await vscode.workspace.fs.writeFile(saveUri, new Uint8Array(buffer));

    // Return export result for centralized success handling
    return {
      filepath: saveUri.fsPath,
      format: "excel",
    };
  }

  private calculateOptimalColumnWidth(
    data: unknown[][],
    columnIndex: number,
    headerName: string,
    maxRowsToSample = 100,
    padding = 4,
    minWidth = 10
  ): number {
    let maxWidth = headerName.length; // Start with header width

    const rowsToSample = Math.min(maxRowsToSample, data.length);

    for (let i = 0; i < rowsToSample; i++) {
      const cellValue = data[i][columnIndex];
      if (cellValue !== null && cellValue !== undefined) {
        const stringValue = String(cellValue);
        maxWidth = Math.max(maxWidth, stringValue.length);
      }
    }

    // Add some padding and set reasonable bounds
    const paddedWidth = maxWidth + padding;
    return Math.min(Math.max(paddedWidth, minWidth), 50);
  }
}
