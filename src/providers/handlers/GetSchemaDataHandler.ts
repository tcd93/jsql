import * as vscode from "vscode";
import {
  ConnectionProfileService,
  ConnectionService,
  MessageService,
  OutputService,
  MetadataCacheService,
  getService,
} from "../../services";
import { AbstractDatabaseFactory } from "../../services/factories/AbstractDatabaseFactory";
import {
  SchemaData,
  SyncQueryResult,
  ConnectionProfile,
  SchemaDataErrorMessage,
  SchemaDataFoundMessage,
  DatabaseProvider,
} from "../../types";

export class GetSchemaDataHandler {
  private readonly connectionService: ConnectionService;
  private readonly profileService: ConnectionProfileService;
  private readonly messageService: MessageService;
  private readonly outputService: OutputService;
  private readonly metadataCacheService: MetadataCacheService;

  constructor(readonly context: vscode.ExtensionContext) {
    this.connectionService = getService(ConnectionService);
    this.profileService = getService(ConnectionProfileService);
    this.messageService = getService(MessageService);
    this.outputService = getService(OutputService);
    this.metadataCacheService = getService(MetadataCacheService);
  }

  async handle(context: vscode.TextDocument): Promise<void> {
    const profile = await this.profileService.getActiveConnection(context);
    if (!profile) {
      const message: SchemaDataErrorMessage = {
        type: "ext.schemaDataError",
        payload: {
          error: "No active connection profile found",
        },
      };
      this.messageService.invoke(message);
      this.outputService.showWarning("No active connection profile found");
      return;
    }

    try {
      const factory = await AbstractDatabaseFactory.getFactory(
        profile.provider
      );
      // Set longer timeout for schema retrieval
      if (profile.provider === DatabaseProvider.SqlServer) {
        profile.commandTimeout = 180;
      }
      const queryBuilder = factory.getSchemaQueryBuilder();
      // Get all schema data in a single query - tables and columns together
      const columnsQuery = queryBuilder.buildGetAllColumnsQuery();
      // Don't pass context so QueryExecutor can use a different session for this query
      const columnsResult = await this.connectionService.executeQuery(
        crypto.randomUUID(),
        columnsQuery,
        profile
      );

      // Check for empty results
      if (!columnsResult.data.rows || columnsResult.data.rows.length === 0) {
        const message: SchemaDataErrorMessage = {
          type: "ext.schemaDataError",
          payload: {
            error: "No tables found in the database",
            profile,
          },
        };
        this.messageService.invoke(message);
        this.outputService.showInfo("No tables found in the database");
        return;
      }

      // Transform to code-mirror compatible format
      const schemaData = this.transform(columnsResult, profile);

      // Update metadata cache if available
      this.metadataCacheService.updateCache(schemaData, profile);

      const message: SchemaDataFoundMessage = {
        type: "ext.schemaDataFound",
        payload: { schemaData },
      };
      this.messageService.invoke(message);
    } catch (error: unknown) {
      const message: SchemaDataErrorMessage = {
        type: "ext.schemaDataError",
        payload: {
          error: error instanceof Error ? error.message : String(error),
          profile,
        },
      };
      this.messageService.invoke(message);
      this.outputService.writeToOutput(
        `Failed to retrieve schema data: ${message.payload.error}`,
        "ERROR"
      );
    } finally {
      // Close the connection after done, we don't need to keep it open
      await this.connectionService.closeConnection(profile);
    }
  }

  private transform(
    columnsResult: SyncQueryResult,
    profile: ConnectionProfile
  ): SchemaData {
    const result: SchemaData = {
      [profile.name]: {},
    };
    const { schema: columnsSchema, data: columnsData } = columnsResult;
    const { rows: columnsRows } = columnsData;

    if (!columnsRows || columnsRows.length === 0) {
      return result;
    }

    // Create a mapping of column names to their indices for the columns query
    const columnsColumnMap = new Map<string, number>();
    columnsSchema.forEach((field, index) => {
      columnsColumnMap.set(field.name.toUpperCase(), index);
    });

    // Find the indices for the expected columns in columns query
    const catalogIndex = columnsColumnMap.get("TABLE_CATALOG") ?? 0;
    const schemaIndex = columnsColumnMap.get("TABLE_SCHEMA") ?? 1;
    const tableIndex = columnsColumnMap.get("TABLE_NAME") ?? 2;
    const nameIndex = columnsColumnMap.get("COLUMN_NAME") ?? 3;
    const typeIndex = columnsColumnMap.get("DATA_TYPE") ?? 4;
    const nullableIndex = columnsColumnMap.get("IS_NULLABLE");

    // Group tables and their columns in one pass
    const catalogMap = new Map<string, Map<string, Map<string, unknown[]>>>();

    columnsRows.forEach((row) => {
      const catalog = (row[catalogIndex] ?? "default") as string;
      const schemaName = (row[schemaIndex] ?? "default") as string;
      const tableName = row[tableIndex] as string;
      const columnName = row[nameIndex] as string;
      const dataType = row[typeIndex] as string;
      const isNullable =
        nullableIndex !== undefined ? row[nullableIndex] : null;

      // Initialize catalog if it doesn't exist
      if (!catalogMap.has(catalog)) {
        catalogMap.set(catalog, new Map());
      }

      // Initialize schema if it doesn't exist
      if (!catalogMap.get(catalog)?.has(schemaName)) {
        catalogMap.get(catalog)?.set(schemaName, new Map());
      }

      // Initialize table if it doesn't exist
      if (!catalogMap.get(catalog)?.get(schemaName)?.has(tableName)) {
        catalogMap.get(catalog)?.get(schemaName)?.set(tableName, []);
      }

      // Add column to table
      catalogMap
        .get(catalog)
        ?.get(schemaName)
        ?.get(tableName)
        ?.push({
          label: columnName,
          detail: isNullable ? `${dataType} (nullable)` : dataType,
          type: "column",
        });
    });

    // Build the final schema structure
    catalogMap.forEach((schemaMap, catalogName) => {
      result[profile.name][catalogName] = {
        self: {
          label: catalogName,
          detail: "catalog",
          type: "catalog",
        },
        children: {},
      };

      schemaMap.forEach((tableMap, schemaName) => {
        const catalogObj = result[profile.name][catalogName] as {
          children: Record<string, unknown>;
        };
        catalogObj.children[schemaName] = {
          self: {
            label: schemaName,
            detail: "schema",
            type: "schema",
          },
          children: {},
        };

        tableMap.forEach((tableColumns, tableName) => {
          const schemaObj = catalogObj.children[schemaName] as {
            children: Record<string, unknown>;
          };

          schemaObj.children[tableName] = {
            self: {
              label: tableName,
              detail: "table",
              type: "table",
            },
            children: tableColumns,
          };
        });
      });
    });

    return result;
  }
}
