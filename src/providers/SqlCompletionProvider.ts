import * as vscode from "vscode";
import { ConnectionProfileService, MetadataCacheService } from "../services";
import {
  ColumnInfo,
  flattenSchema,
  TableInfo,
  detectSqlContextAction,
} from "../utils";

export class SqlCompletionProvider implements vscode.CompletionItemProvider {
  private readonly metadataCacheService: MetadataCacheService;
  private readonly profileService: ConnectionProfileService;

  constructor(
    metadataCacheService: MetadataCacheService,
    profileService: ConnectionProfileService
  ) {
    this.metadataCacheService = metadataCacheService;
    this.profileService = profileService;
  }

  /**
   * Provide completion items for the given position
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
    // Get active profile for this document
    const activeProfile = await this.profileService.getActiveConnection(
      document
    );
    if (!activeProfile) {
      return [];
    }

    // Get schema data from cache
    const schemaData = this.metadataCacheService.getSchemaData(activeProfile);
    if (!schemaData) {
      return [];
    }

    const profileSchemaData = schemaData[activeProfile.name];
    if (!profileSchemaData) {
      return [];
    }

    // Flatten schema to get all tables
    const allTables = flattenSchema(profileSchemaData);
    if (allTables.length === 0) {
      return [];
    }

    const offset = document.offsetAt(position);
    const sqlContext = detectSqlContextAction(document.getText(), offset);

    if (!sqlContext) {
      return [];
    }

    // Detect the "range" to replace, for SQL, we should look before the cursor until first whitespace, comma, or semicolon (not dot)
    const wordRange = document.getWordRangeAtPosition(
      position,
      /[^\s,;]+(?:\.[^\s,;]+)*/
    );
    // const currentWord = wordRange ? document.getText(wordRange) : "";
    // console.debug("wordRange: ", wordRange, " -  currentWord:", currentWord);

    // Table suggestions
    if (sqlContext.actionType === "list_table") {
      return this.createTableCompletions(allTables, wordRange);
    }

    // Column suggestions
    if (sqlContext.actionType === "list_column") {
      return this.createColumnCompletions(
        sqlContext.tablesInContext,
        allTables,
        wordRange
      );
    }

    return [];
  }

  /**
   * Create completion items for tables
   */
  private createTableCompletions(
    allTables: TableInfo[],
    wordRange?: vscode.Range
  ): vscode.CompletionItem[] {
    return allTables.map((table) => {
      const item = new vscode.CompletionItem(
        table.fqName ?? table.name,
        table.type === "table"
          ? vscode.CompletionItemKind.Reference
          : vscode.CompletionItemKind.Interface
      );

      item.label = table.fqName ?? table.name;
      item.detail = table.detail;
      item.documentation = `${table.type}: ${table.fqName ?? table.name}`;

      // Set range for proper text replacement
      if (wordRange) {
        item.range = wordRange;
      }

      return item;
    });
  }

  /**
   * Create completion items for columns
   */
  private createColumnCompletions(
    tablesInContext: TableInfo[],
    allTables: TableInfo[],
    wordRange?: vscode.Range
  ): vscode.CompletionItem[] {
    // Update tablesInContext with columns
    tablesInContext.forEach((table) => {
      table.columns = this.getColumns(table.fqName ?? table.name, allTables);
    });

    const completions: vscode.CompletionItem[] = [];

    tablesInContext.forEach((table) => {
      if (table.columns) {
        table.columns.forEach((column) => {
          const label = table.alias
            ? `${table.alias}.${column.label}`
            : column.label;
          const item = new vscode.CompletionItem(
            label,
            vscode.CompletionItemKind.Field
          );

          item.label = label;
          item.detail = column.detail;
          item.documentation = `${column.label}${
            column.type ? ` (${column.type})` : ""
          }`;

          // Set range for proper text replacement
          if (wordRange) {
            item.range = wordRange;
          }

          completions.push(item);
        });
      }
    });

    return completions;
  }

  /**
   * Get columns for a specific table
   */
  private getColumns(tableName: string, allTables: TableInfo[]): ColumnInfo[] {
    const table = allTables.find((t) => t.fqName?.includes(tableName));
    return table?.columns ?? [];
  }
}
