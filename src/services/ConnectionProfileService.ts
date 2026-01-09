import * as vscode from "vscode";
import { BaseEditorProvider } from "../providers/editors";
import {
  ConnectionProfile,
  DatabaseProvider,
  ConnectionStatus,
} from "../types";
import { MessageService } from "./MessageService";
import { MssqlExtensionService } from "./MssqlExtensionService";
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

  public constructor() {
    super(() => {
      this.dispose();
      clearInterval(interval);
    });
    this.mssqlExtensionService = getService(MssqlExtensionService);
    this.messageService = getService(MessageService);

    // Call `setActiveMssqlConnection` every 500ms on active document
    const interval = setInterval(async () => {
      const editorProvider = getService(BaseEditorProvider);
      const focusedContext = editorProvider?.getFocusedContext();
      if (focusedContext) {
        await this.setActiveMssqlConnection(focusedContext);
      }
    }, 500);
  }

  public dispose(): void {
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
          workspaceFolders[0].uri
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

  public setActiveConnection(
    context: vscode.TextDocument,
    connection: ConnectionProfile,
    connectionStatus: ConnectionStatus
  ): void {
    const currentConnection = this.connectionMap.get(context);
    if (!currentConnection) {
      return;
    }
    // Fire connection changed event when the active connection changes.
    // We separated MSSQL's autocomplete responsibilities from schema fetching
    // so always emit the event when the connection actually changes.
    if (currentConnection.name !== connection.name) {
      this.messageService.invoke({
        type: "ext.connectionChanged",
        payload: {
          profile: connection,
          status: connectionStatus,
        },
      });
    }
    this.connectionMap.set(context, {
      ...connection,
      connectionStatus,
    });
  }

  public async getActiveConnection(
    context: vscode.TextDocument
  ): Promise<ConnectionProfile | undefined> {
    await this.setActiveMssqlConnection(context);
    return this.connectionMap.get(context);
  }

  /**
   * Since MSSQL extension does not emit events on connection change,
   * we need to periodically check and sync the active connection here
   */
  private async setActiveMssqlConnection(
    context: vscode.TextDocument
  ): Promise<void> {
    const mssqlConnection =
      await this.mssqlExtensionService.getActiveMssqlConnection();
    if (mssqlConnection) {
      this.setActiveConnection(context, mssqlConnection, "Connected");
    }
  }

  public getConnectionStatus(
    context: vscode.TextDocument
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
