import * as vscode from "vscode";
import { getService, MessageService, OutputService } from "../../services";
import {
  SmartDrillErrorMessage,
  SmartDrillQueryGeneratedMessage,
  SmartDrillCellSelection,
  SmartDrillTableRequest,
} from "../../types";

export interface GenerateSmartDrillQueryHandler {
  generateSmartDrillQueryForTable(
    selectedTable: SmartDrillTableRequest,
    selectedCells: SmartDrillCellSelection[]
  ): Promise<void>;
}

interface Cell {
  value: unknown;
  type: string;
}

export class GenerateSmartDrillQueryHandlerImpl
  implements GenerateSmartDrillQueryHandler
{
  private readonly messageService: MessageService;
  private readonly outputService: OutputService;

  constructor(readonly context: vscode.ExtensionContext) {
    this.messageService = getService(MessageService);
    this.outputService = getService(OutputService);
  }

  private generateSmartDrillQuery(
    selectedTable: SmartDrillTableRequest,
    selectedCellsData: SmartDrillCellSelection[]
  ): string {
    const tableName = `[${selectedTable.tableCatalog}].[${selectedTable.tableSchema}].[${selectedTable.tableName}]`;

    // Group values by column name
    const columnGroups = new Map<string, Cell[]>();

    selectedCellsData.forEach((cell) => {
      const columnName = cell.columnName;
      if (!columnGroups.has(columnName)) {
        columnGroups.set(columnName, []);
      }
      const currentCells = columnGroups.get(columnName);
      const isDuplicate = currentCells?.some(
        (c) => c.value === cell.value && c.type === cell.type
      );
      if (!isDuplicate) {
        columnGroups.get(columnName)?.push({
          value: cell.value,
          type: cell.type,
        });
      }
    });

    const whereConditions: string[] = [];

    columnGroups.forEach((cells, columnName) => {
      const quotedColumnName = `"${columnName}"`;

      // Separate NULL values from non-NULL values
      const nullValues = cells.filter(
        (v) => v.value === null || v.value === undefined
      );
      const nonNullValues = cells.filter(
        (v) => v.value !== null && v.value !== undefined
      );

      const conditions: string[] = [];

      // Handle non-NULL values
      if (nonNullValues.length > 0) {
        if (nonNullValues.length === 1) {
          // Single value: use = operator
          const value = nonNullValues[0];
          conditions.push(`${quotedColumnName} = ${this.formatValue(value)}`);
        } else {
          // Multiple values: use IN operator
          const formattedValues = nonNullValues.map((value) =>
            this.formatValue(value)
          );
          conditions.push(
            `${quotedColumnName} IN (${formattedValues.join(", ")})`
          );
        }
      }

      // Handle NULL values
      if (nullValues.length > 0) {
        conditions.push(`${quotedColumnName} IS NULL`);
      }

      // Combine conditions for this column with OR if both NULL and non-NULL exist
      if (conditions.length > 1) {
        whereConditions.push(`(${conditions.join(" OR ")})`);
      } else if (conditions.length === 1) {
        whereConditions.push(conditions[0]);
      }
    });

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    return `SELECT * FROM ${tableName} ${whereClause};`;
  }

  private formatValue(cell: Cell): string {
    if (typeof cell.value === "number") {
      return String(cell.value);
    }

    if (cell.type === "bit" || typeof cell.value === "boolean") {
      return cell.value ? "1" : "0";
    }

    const stringValue = String(cell.value).replace(/'/g, "''");
    return `'${stringValue}'`;
  }

  async generateSmartDrillQueryForTable(
    selectedTable: SmartDrillTableRequest,
    selectedCells: SmartDrillCellSelection[]
  ): Promise<void> {
    try {
      const generatedQuery = this.generateSmartDrillQuery(
        selectedTable,
        selectedCells
      );
      this.outputService.writeToOutput(
        `[Smart Drill] Generated query for table ${selectedTable.tableName}:\n${generatedQuery}\n`
      );

      const message: SmartDrillQueryGeneratedMessage = {
        type: "ext.smartDrillQueryGenerated",
        payload: {
          query: generatedQuery,
        },
      };
      this.messageService.invoke(message);
    } catch (error) {
      const errorMessage: SmartDrillErrorMessage = {
        type: "ext.smartDrillError",
        payload: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate smart drill query",
        },
      };
      this.messageService.invoke(errorMessage);
    }
  }
}
