import { Pool, PoolClient, PoolConfig, QueryResult } from "pg";
import QueryStream from "pg-query-stream";
import * as vscode from "vscode";
import {
  SyncQueryResult,
  StreamingCallbacks,
  PostgreSqlConnectionProfile,
} from "../../../types";
import { ConnectionService } from "../index";

interface PostgresColumnMetadata {
  name: string;
  dataTypeID: number;
  dataTypeSize: number;
  dataTypeModifier: number;
  format: string;
}

export class PostgresService extends ConnectionService {
  private readonly pools: Map<string, Pool> = new Map();

  dispose(): void {
    this.pools.forEach((pool) => pool.end());
    this.pools.clear();
  }

  async closeConnection(
    profile: PostgreSqlConnectionProfile,
    context: vscode.TextDocument
  ): Promise<void> {
    const connectionName = this.getConnectionName(profile, context);
    const pool = this.pools.get(connectionName);
    if (pool) {
      await pool.end();
      this.pools.delete(connectionName);
    }
  }

  async createConnectionPool(
    profile: PostgreSqlConnectionProfile,
    context?: vscode.TextDocument
  ): Promise<void> {
    const connectionName = this.getConnectionName(profile, context);
    if (this.pools.has(connectionName)) {
      return;
    }

    try {
      const pool = new Pool(this.getConnectionConfig(profile));

      // Test the connection
      const client = await pool.connect();
      client.release();

      this.pools.set(connectionName, pool);

      // Override the end method to clean up cache
      const originalEnd = pool.end.bind(pool);
      pool.end = (async () => {
        console.debug(
          `------------ Removing cache for connection: ${connectionName} ------------`
        );
        this.pools.delete(connectionName);
        return originalEnd();
      }) as typeof pool.end;
    } catch (err) {
      console.error(
        `Error creating connection pool for ${connectionName}:`,
        err
      );
      throw err;
    }
  }

  private getConnectionConfig(params: PostgreSqlConnectionProfile): PoolConfig {
    // If a connection string is provided, use it directly
    if (params.connectionString) {
      return {
        connectionString: params.connectionString,
        connectionTimeoutMillis: (params.connectTimeout ?? 60) * 1000,
        statement_timeout:
          (params.statementTimeout ?? params.commandTimeout ?? 0) * 1000,
        query_timeout: params.queryTimeout ?? 0,
        max: params.maxPoolSize ?? 10,
        min: params.minPoolSize ?? 1,
        idleTimeoutMillis: params.idleTimeoutMillis ?? 60000,
        application_name: params.applicationName ?? "jsql-extension",
        keepAlive: params.keepAlive ?? true,
        keepAliveInitialDelayMillis: params.keepAliveInitialDelayMillis ?? 0,
      };
    }

    const config: PoolConfig = {
      host: params.host,
      port: params.port,
      database: params.database,
      user: params.username,
      password: params.password,
      connectionTimeoutMillis: (params.connectTimeout ?? 60) * 1000,
      statement_timeout:
        (params.statementTimeout ?? params.commandTimeout ?? 0) * 1000,
      query_timeout: params.queryTimeout ?? 0,
      max: params.maxPoolSize ?? 10,
      min: params.minPoolSize ?? 1,
      idleTimeoutMillis: params.idleTimeoutMillis ?? 60000,
      application_name: params.applicationName ?? "jsql-extension",
      keepAlive: params.keepAlive ?? true,
      keepAliveInitialDelayMillis: params.keepAliveInitialDelayMillis ?? 0,
    };

    // Handle SSL configuration
    if (params.ssl) {
      config.ssl =
        params.rejectUnauthorized === false
          ? { rejectUnauthorized: false }
          : true;
    }

    return config;
  }

  async executeQuery(
    queryId: string,
    query: string,
    profile: PostgreSqlConnectionProfile
  ): Promise<SyncQueryResult> {
    const connectionName = this.getConnectionName(profile);
    await this.createConnectionPool(profile);
    const pool = this.pools.get(connectionName);
    if (!pool) {
      throw new Error(`No pool found for connection: ${connectionName}`);
    }

    const result: QueryResult = await pool.query(query);

    return {
      schema: this.extractPostgresSchema(result),
      data: {
        rows: result.rows.map((row) => Object.values(row)),
        totalRowsSoFar: result.rowCount ?? 0,
      },
    };
  }

  async executeStreamingQuery(
    queryId: string,
    query: string,
    profile: PostgreSqlConnectionProfile,
    callbacks: StreamingCallbacks,
    context?: vscode.TextDocument
  ): Promise<CallableFunction> {
    const connectionName = this.getConnectionName(profile, context);
    await this.createConnectionPool(profile, context);
    const pool = this.pools.get(connectionName);
    if (!pool) {
      console.error(`No pool found for connection: ${connectionName}`);
      throw new Error(`No pool found for connection: ${connectionName}`);
    }

    let client: PoolClient | null = null;
    let stream: QueryStream | null = null;
    let totalRowsSoFar = 0;
    let schemaEmitted = false;

    try {
      client = await pool.connect();

      // Create a QueryStream for streaming results
      const queryStream = new QueryStream(query, [], {
        rowMode: "array",
      });

      stream = client.query(queryStream);

      // Listen for data (rows)
      stream.on("data", (row: unknown[]) => {
        // Emit schema on first row if not already emitted
        if (!schemaEmitted && stream?._result?.fields) {
          const schema = this.extractPostgresSchemaFromFields(
            stream._result.fields
          );
          callbacks.onSchema(schema);
          schemaEmitted = true;
        }

        totalRowsSoFar++;

        callbacks.onData({
          rows: [row],
          batchNumber: 0,
          totalRowsSoFar,
        });
      });

      // Listen for end
      stream.on("end", () => {
        // If no rows were returned, we need to emit schema from the result
        if (!schemaEmitted && stream?._result?.fields) {
          const schema = this.extractPostgresSchemaFromFields(
            stream._result.fields
          );
          callbacks.onSchema(schema);
        }

        callbacks.onComplete({
          totalRows: totalRowsSoFar,
          totalBatches: 1,
          affectedRows: stream?._result?.rowCount
            ? [stream._result.rowCount]
            : undefined,
        });
        if (client) {
          client.release();
        }
      });

      // Listen for errors
      stream.on("error", (err: Error) => {
        console.error(err);
        const errorMessage = this.formatPostgresError(err);
        callbacks.onError(errorMessage);
        if (client) {
          client.release();
        }
      });

      // Return cancel function
      return () => {
        if (stream) {
          stream.destroy();
          stream = null;
        }
        if (client) {
          client.release();
          client = null;
        }
      };
    } catch (err) {
      console.error(err);
      const errorMessage = this.formatPostgresError(err);
      callbacks.onError(errorMessage);
      if (client) {
        client.release();
      }

      return () => {
        // no-op
      };
    }
  }

  private extractPostgresSchema(
    result: QueryResult
  ): { name: string; type: string }[] {
    if (!result.fields || result.fields.length === 0) {
      return [];
    }

    return this.extractPostgresSchemaFromFields(result.fields);
  }

  private extractPostgresSchemaFromFields(
    fields: PostgresColumnMetadata[]
  ): { name: string; type: string }[] {
    return fields.map((field, index) => ({
      name: field.name || `column_${index}`,
      type: this.mapPostgresTypeId(field.dataTypeID),
    }));
  }

  /**
   * Maps PostgreSQL type OIDs to human-readable type names
   * See: https://github.com/postgres/postgres/blob/master/src/include/catalog/pg_type.dat
   */
  private mapPostgresTypeId(typeId: number): string {
    const typeMap: Record<number, string> = {
      16: "bool",
      17: "bytea",
      18: "char",
      19: "name",
      20: "int8",
      21: "int2",
      22: "int2vector",
      23: "int4",
      24: "regproc",
      25: "text",
      26: "oid",
      27: "tid",
      28: "xid",
      29: "cid",
      114: "json",
      142: "xml",
      194: "pg_node_tree",
      600: "point",
      601: "lseg",
      602: "path",
      603: "box",
      604: "polygon",
      628: "line",
      700: "float4",
      701: "float8",
      702: "abstime",
      703: "reltime",
      704: "tinterval",
      705: "unknown",
      790: "money",
      829: "macaddr",
      869: "inet",
      650: "cidr",
      1000: "_bool",
      1001: "_bytea",
      1002: "_char",
      1003: "_name",
      1005: "_int2",
      1006: "_int2vector",
      1007: "_int4",
      1008: "_regproc",
      1009: "_text",
      1028: "_oid",
      1010: "_tid",
      1011: "_xid",
      1012: "_cid",
      1013: "_oidvector",
      1014: "_bpchar",
      1015: "_varchar",
      1016: "_int8",
      1017: "_point",
      1018: "_lseg",
      1019: "_path",
      1020: "_box",
      1021: "_float4",
      1022: "_float8",
      1023: "_abstime",
      1024: "_reltime",
      1025: "_tinterval",
      1027: "_polygon",
      1033: "aclitem",
      1034: "_aclitem",
      1040: "_macaddr",
      1041: "_inet",
      1042: "bpchar",
      1043: "varchar",
      1082: "date",
      1083: "time",
      1114: "timestamp",
      1115: "_timestamp",
      1182: "_date",
      1183: "_time",
      1184: "timestamptz",
      1185: "_timestamptz",
      1186: "interval",
      1187: "_interval",
      1231: "_numeric",
      1266: "timetz",
      1270: "_timetz",
      1560: "bit",
      1561: "_bit",
      1562: "varbit",
      1563: "_varbit",
      1700: "numeric",
      2950: "uuid",
      3802: "jsonb",
    };

    return typeMap[typeId] ?? `unknown(${typeId})`;
  }

  private formatPostgresError(error: unknown): string {
    if (error instanceof Error) {
      // Handle pg specific errors
      if ("code" in error && typeof error.code === "string") {
        return `PostgreSQL Error ${error.code}: ${error.message}`;
      }
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (error && typeof error === "object") {
      // Try to extract meaningful information from error object
      const errorObj = error as Record<string, unknown>;

      if (errorObj.message && typeof errorObj.message === "string") {
        return errorObj.message;
      }

      if (errorObj.code && typeof errorObj.code === "string") {
        return `PostgreSQL Error ${errorObj.code}`;
      }

      // Fallback: stringify the object but limit length
      const errorString = JSON.stringify(errorObj);
      return errorString.length > 200
        ? `${errorString.substring(0, 200)}...`
        : errorString;
    }

    return "Unknown PostgreSQL error";
  }
}
