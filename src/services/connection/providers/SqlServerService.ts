import * as vscode from "vscode";
import {
  ConnectionProfile,
  SqlServerConnectionProfile,
  SyncQueryResult,
  StreamingCallbacks,
  SchemaField,
  StreamingDataResult,
  StreamingCompleteResult,
  CloseConnectionParams,
  StreamingMessage,
} from "../../../types";
import { getContext, getService, OutputService } from "../../index";
import { SqlServerBridgeClient } from "../bridge/SqlServerBridgeClient";
import { ConnectionService } from "../index";

type QueryResult = SyncQueryResult;

export class SqlServerService extends ConnectionService {
  private readonly bridgeClient: SqlServerBridgeClient;
  private readonly streamingCallbacks = new Map<string, StreamingCallbacks>();

  constructor() {
    super();
    this.bridgeClient = new SqlServerBridgeClient({
      extensionPath: getContext().extensionPath,
      outputLogger: getService(OutputService),
    });
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.bridgeClient.on("streaming", (message: StreamingMessage) => {
      this.handleStreamingMessage(message);
    });
  }

  private handleStreamingMessage(message: StreamingMessage): void {
    if (!message.queryId) {
      return;
    }

    const callbacks = this.streamingCallbacks.get(message.queryId);
    if (!callbacks) {
      return;
    }

    try {
      switch (message.event) {
        case "schema":
          if (
            message.data &&
            typeof message.data === "object" &&
            "schema" in message.data
          ) {
            callbacks.onSchema(
              (message.data as { schema: SchemaField[] }).schema
            );
          }
          break;
        case "data":
          if (
            message.data &&
            typeof message.data === "object" &&
            "rows" in message.data
          ) {
            const data = message.data as StreamingDataResult;
            callbacks.onData(data);
          }
          break;
        case "complete":
          if (message.data && typeof message.data === "object") {
            const summary = message.data as StreamingCompleteResult;
            callbacks.onComplete(summary);
          }
          this.streamingCallbacks.delete(message.queryId);
          break;
        case "error":
          if (
            message.data &&
            typeof message.data === "object" &&
            "error" in message.data
          ) {
            const error = message.data as { error: string };
            callbacks.onError(error.error);
          }
          this.streamingCallbacks.delete(message.queryId);
          break;
        case "info":
          if (typeof message.data === "string") {
            callbacks.onInfo(message.data);
          } else if (
            message.data &&
            typeof message.data === "object" &&
            "message" in message.data
          ) {
            callbacks.onInfo(
              String((message.data as { message: unknown }).message)
            );
          }
          break;
      }
    } catch (error) {
      console.error(
        `[SqlServerService] Error handling streaming message: ${error}`
      );
    }
  }

  public dispose(): void {
    this.bridgeClient.removeAllListeners();
    this.streamingCallbacks.clear();
    this.bridgeClient.dispose();
  }

  cancelQuery(queryId: string): void {
    this.streamingCallbacks.delete(queryId);

    this.bridgeClient
      .sendRequest("cancelQuery", {
        queryId,
      })
      .catch((error) => {
        console.error(`Failed to cancel query ${queryId}:`, error);
      });
  }

  public async closeConnection(
    profile: ConnectionProfile,
    context: vscode.TextDocument
  ): Promise<void> {
    const connectionName = this.getConnectionName(profile, context);

    const response = await this.bridgeClient.sendRequest("closeConnection", {
      connectionName,
    } as CloseConnectionParams);
    if (!response) {
      throw new Error("No response from bridge");
    }
    if (response.$type === "closeConnection" && response.error) {
      console.error(
        `Failed to close connection ${connectionName}: ${response.error.message}`
      );
      throw new Error(response.error.message);
    }
  }

  async createConnectionPool(
    profile: SqlServerConnectionProfile,
    context?: vscode.TextDocument
  ): Promise<void> {
    const connectionName = this.getConnectionName(profile, context);

    try {
      const response = await this.bridgeClient.sendRequest("createConnection", {
        connectionName,
        ...profile,
      });
      if (!response) {
        throw new Error("No response from bridge");
      }
      if (response.$type === "createConnection" && response.error) {
        throw new Error(response.error.message);
      }
    } catch (err) {
      console.error(
        `Error creating connection pool for ${connectionName}:`,
        err
      );
      throw err;
    }
  }

  async executeQuery(
    queryId: string,
    query: string,
    profile: SqlServerConnectionProfile,
    context?: vscode.TextDocument
  ): Promise<SyncQueryResult> {
    await this.createConnectionPool(profile, context);
    const connectionName = this.getConnectionName(profile, context);
    const response = await this.bridgeClient.sendRequest("executeQuery", {
      connectionName,
      query,
      queryId,
    });
    if (!response) {
      throw new Error("No response from bridge");
    }
    if (response.error) {
      throw new Error(response.error.message);
    }
    if (response.$type !== "executeQuery") {
      throw new Error("Unexpected response type from bridge");
    }
    return {
      schema: response.schema,
      data: response.data,
    } as QueryResult;
  }

  async executeStreamingQuery(
    queryId: string,
    query: string,
    profile: SqlServerConnectionProfile,
    callbacks: StreamingCallbacks,
    context?: vscode.TextDocument
  ): Promise<CallableFunction> {
    const connectionName = this.getConnectionName(profile, context);
    await this.createConnectionPool(profile, context);

    this.streamingCallbacks.set(queryId, callbacks);

    // `sendRequest` is blocking, we don't want to await it here
    this.bridgeClient
      .sendRequest("executeStreamingQuery", {
        connectionName,
        query,
        queryId,
      })
      .catch((error) => {
        this.streamingCallbacks.delete(queryId);
        console.error(`Failed to execute streaming query ${queryId}: ${error}`);
      });

    return async () => {
      this.cancelQuery(queryId);
    };
  }
}
