import * as vscode from "vscode";
import { BaseEditorProvider } from "../providers/editors";
import {
  ConnectionProfile,
  DatabaseProvider,
  ConnectionStatus,
} from "../types";
import { ConnectionService } from "./connection";
import { MssqlExtensionService } from "./extensions";
import { MessageService } from "./MessageService";
import { getService } from ".";

export class ConnectionProfileService extends vscode.Disposable {
  private connections: ConnectionProfile[] = [];
  private readonly connectionMap: Map<
    vscode.TextDocument,
    ConnectionProfile & {
      connectionStatus: ConnectionStatus;
    }
  > = new Map();

  private readonly mssqlExtensionService: MssqlExtensionService;
  private readonly messageService: MessageService;
  private readonly connectionService: ConnectionService;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor() {
    super(() => this.dispose());
    this.mssqlExtensionService = getService(MssqlExtensionService);
    this.messageService = getService(MessageService);
    this.connectionService = getService(ConnectionService);

    this.disposables.push(
      this.mssqlExtensionService.onDidChangeActiveConnection((connection) => {
        const focusedContext =
          getService(BaseEditorProvider)?.getFocusedContext();

        if (!focusedContext) {
          return;
        }

        void this.setActiveConnection(
          focusedContext,
          connection,
          connection?.name.trim() ? "Connected" : "Disconnected",
        ).catch((error) => {
          console.error("Failed to switch the active connection:", error);
        });
      }),
    );
  }

  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;
    this.connectionMap.clear();
    this.connections = [];
  }

  /**
   * Load our own extension's connection profiles from VS Code settings
   */
  public async loadProfiles(): Promise<ConnectionProfile[]> {
    this.connections = [];
    try {
      // Get connections from VS Code settings
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let config: vscode.WorkspaceConfiguration;

      if (workspaceFolders && workspaceFolders.length > 0) {
        config = vscode.workspace.getConfiguration(
          "jSql",
          workspaceFolders[0].uri,
        );
      } else {
        config = vscode.workspace.getConfiguration("jSql");
      }

      const providers = config.get("providers", {});

      if (
        !providers ||
        typeof providers !== "object" ||
        Object.keys(providers).length === 0
      ) {
        console.warn("No connection providers found in settings");
        return [];
      }

      for (const [providerName, providerConfig] of Object.entries(providers)) {
        if (providerConfig && Array.isArray(providerConfig)) {
          providerConfig.forEach((connection) => {
            this.connections.push({
              name: connection.name ?? `${providerName} Connection`,
              provider: providerName as DatabaseProvider,
              host: connection.host,
              port: connection.port,
              username: connection.username,
              password: connection.password,
            });
          });
        }
      }

      return this.connections;
    } catch (error) {
      console.error("Error loading connections:", error);
      return [];
    }
  }

  public async setActiveConnection(
    context: vscode.TextDocument,
    connection: ConnectionProfile | undefined,
    connectionStatus: ConnectionStatus,
  ): Promise<void> {
    const currentConnection = this.connectionMap.get(context);
    if (!currentConnection) {
      return;
    }
    const isDisconnected =
      !connection?.name.trim() ||
      connection?.provider === DatabaseProvider.None;
    const disconnectedConnection: ConnectionProfile = {
      name: "",
      provider: DatabaseProvider.None,
      host: "",
      port: 0,
    };
    const nextConnection =
      !isDisconnected && connection ? connection : disconnectedConnection;
    const connectionChanged = currentConnection.name !== nextConnection.name;
    if (
      connectionChanged &&
      currentConnection.provider !== DatabaseProvider.None
    ) {
      try {
        await this.connectionService.closeConnection(
          currentConnection,
          context,
        );
      } catch (error) {
        console.error("Failed to close the previous connection:", error);
      }
    }

    this.connectionMap.set(context, {
      ...nextConnection,
      connectionStatus: isDisconnected ? "Disconnected" : connectionStatus,
    });

    // Fire connection changed event when the active connection changes.
    // We separated MSSQL's autocomplete responsibilities from schema fetching
    // so always emit the event when the connection actually changes.
    if (connectionChanged) {
      this.messageService.invoke({
        type: "ext.connectionChanged",
        payload: {
          profile: isDisconnected ? undefined : nextConnection,
          status: isDisconnected ? "Disconnected" : connectionStatus,
        },
      });
    }
  }

  public async getActiveConnection(
    context: vscode.TextDocument,
  ): Promise<ConnectionProfile | undefined> {
    return this.connectionMap.get(context);
  }

  public getConnectionStatus(
    context: vscode.TextDocument,
  ): ConnectionStatus | undefined {
    return this.connectionMap.get(context)?.connectionStatus;
  }

  public registerContext(context: vscode.TextDocument): void {
    if (!this.connectionMap.has(context)) {
      // Initialize with no connection profile but with default status
      this.connectionMap.set(context, {
        name: "",
        provider: DatabaseProvider.None,
        host: "",
        port: 0,
        connectionStatus: "Disconnected",
      });
    }
  }

  public removeContext(context: vscode.TextDocument): void {
    this.connectionMap.delete(context);
  }

  public isMssqlExtensionAvailable(): Promise<boolean> {
    return this.mssqlExtensionService.isExtensionAvailable();
  }
}
