import * as vscode from "vscode";
import { ConnectionProfile, AggregationResult, QueryStatus } from "../types";
import {
  MessageService,
  OutputService,
  ConnectionWizard,
  ConnectionProfileService,
  MssqlExtensionService,
  getService,
} from "./index";

export class StatusBarService extends vscode.Disposable {
  private connectionStatusItem?: vscode.StatusBarItem;
  private readonly queryStatusItem: vscode.StatusBarItem;
  private readonly aggregationStatusItem: vscode.StatusBarItem;
  private readonly connectionWizard: ConnectionWizard;

  private readonly profileService: ConnectionProfileService;
  private readonly outputService: OutputService;
  private readonly mssqlExtensionService: MssqlExtensionService;
  private readonly messageService: MessageService;

  constructor() {
    super(() => {
      this.connectionStatusItem?.dispose();
      this.queryStatusItem.dispose();
      this.aggregationStatusItem.dispose();
      this.connectionWizard.dispose();
    });

    this.profileService = getService(ConnectionProfileService);
    this.outputService = getService(OutputService);
    this.mssqlExtensionService = getService(MssqlExtensionService);
    this.messageService = getService(MessageService);

    // Initialize connection wizard
    this.connectionWizard = new ConnectionWizard(
      this.profileService,
      this.outputService
    );

    // Create status bar items if MSSQL extension is NOT available
    // We'll use MSSQL extension's connection if it is available
    this.profileService.isMssqlExtensionAvailable().then((available) => {
      if (available) {
        return;
      }
      console.warn("[StatusBarService] MSSQL extension is not available.");
      this.connectionStatusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
      );
      this.displayConnectionStatus("Disconnected");
    });

    this.queryStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );

    this.aggregationStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98
    );

    this.messageService.registerHandler("ext.connectionChanged", (message) => {
      const { status } = message.payload;
      this.outputService.writeToOutput(
        `Connection status changed: ${status}`,
        "INFO"
      );
      this.displayConnectionStatus(status, message.payload.profile);
    });
  }

  /**
   * Choose connection command called from status bar click.
   * If `prioritizeMssqlExtension` is true, it will first try to use MSSQL extension's connection picker.
   * If no connection is selected there, it will fallback to built-in connection picker.
   */
  public async showConnectionPopup(
    prioritizeMssqlExtension = true
  ): Promise<ConnectionProfile | undefined> {
    if (prioritizeMssqlExtension) {
      const mssqlConnections =
        await this.mssqlExtensionService.showConnectionPopup();
      if (mssqlConnections) {
        return mssqlConnections;
      }
      if (await this.mssqlExtensionService.isExtensionAvailable()) {
        return undefined;
      }
    }

    // Fallback to built-in connection picker
    const connections = await this.profileService.loadProfiles();

    // Create quick pick items for existing connections
    const items: (vscode.QuickPickItem & {
      connection?: ConnectionProfile;
      isNewConnection?: boolean;
    })[] = [];

    // Add "Create new connection" option at the top
    items.push({
      label: "$(plus) Create new connection...",
      description: "Set up a new database connection",
      detail: "Launch connection wizard",
      isNewConnection: true,
    });

    // Add separator if there are existing connections
    if (connections.length > 0) {
      items.push({
        label: "",
        kind: vscode.QuickPickItemKind.Separator,
      });

      // Add existing connections
      connections.forEach((conn) => {
        items.push({
          label: conn.name,
          description: `${conn.provider} - ${conn.host}:${conn.port}`,
          detail: `User: ${conn.username ?? "Not specified"}`,
          connection: conn,
        });
      });
    }

    // Show connection picker
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a connection or create new one",
      title: "Choose SQL Connection",
    });

    if (!selected) {
      return undefined; // User cancelled
    }

    // Handle "Create new connection" selection
    if (selected.isNewConnection) {
      const wizardResult = await this.connectionWizard.showWizard();
      if (wizardResult?.saved) {
        return wizardResult.profile;
      }
      return undefined;
    }

    // Return selected existing connection
    return selected.connection;
  }

  public displayConnectionStatus(
    connectionStatus: "Disconnected" | "Connected" | "Connecting" | "Error",
    profile?: ConnectionProfile
  ): void {
    if (!this.connectionStatusItem) {
      return;
    }

    let icon = "$(debug-disconnect)";
    switch (connectionStatus) {
      case "Connected":
        icon = "$(check)";
        break;
      case "Connecting":
        icon = "$(loading~spin)";
        break;
      case "Error":
        icon = "$(error)";
        break;
      case "Disconnected":
        icon = "$(debug-disconnect)";
        break;
      default:
        icon = "$(debug-disconnect)";
        break;
    }

    // Show only icon and status
    this.connectionStatusItem.text = `${icon} ${connectionStatus}`;

    let tooltip = `SQL Connection: ${connectionStatus}`;
    if (profile) {
      tooltip += `\nConnected to: ${profile.name}`;
      tooltip += `\nHost: ${profile.host}:${profile.port}`;
      if (profile.username) {
        tooltip += `\nUser: ${profile.username}`;
      }
    }
    tooltip += "\n\nClick to choose connection";

    this.connectionStatusItem.tooltip = tooltip;
    this.connectionStatusItem.command = "jSql.chooseConnection";
    this.connectionStatusItem.show();
  }

  public hideQueryStatus(): void {
    this.queryStatusItem.hide();
  }

  public displayQueryStatus(
    queryStatus: QueryStatus,
    options?: {
      duration?: number;
      startTime?: Date;
      totalRows?: number;
      affectedRows?: number[];
      tabCount?: number;
    }
  ): void {
    let icon = "$(clock)";
    let text = "";
    let tooltip = "";

    const formatDuration = (ms: number): string => {
      if (ms < 1000) {
        return `${ms}ms`;
      } else {
        return `${(ms / 1000).toFixed(1)}s`;
      }
    };

    const formatRowCount = (
      totalRows?: number,
      affectedRows?: number[]
    ): string => {
      if (affectedRows && affectedRows.length > 0) {
        const totalAffected = affectedRows.reduce(
          (sum, count) => sum + count,
          0
        );
        return `${totalAffected.toLocaleString()} rows affected`;
      } else if (totalRows !== undefined) {
        return `${totalRows.toLocaleString()} rows`;
      }
      return "";
    };

    switch (queryStatus) {
      case "Executing":
        icon = "$(loading~spin)";
        text = "Executing";
        tooltip = "Query Status: Executing";
        if (options?.startTime) {
          const currentDuration = Date.now() - options.startTime.getTime();
          tooltip += `\nDuration: ${formatDuration(currentDuration)}`;
        }
        if (options?.tabCount && options.tabCount > 1) {
          tooltip += `\nTabs: ${options.tabCount}`;
        }
        break;
      case "Completed": {
        icon = "$(check)";
        text = "Completed";
        tooltip = "Query Status: Completed";
        if (options?.duration) {
          tooltip += `\nDuration: ${formatDuration(options.duration)}`;
        }
        const rowInfo = formatRowCount(
          options?.totalRows,
          options?.affectedRows
        );
        if (rowInfo) {
          tooltip += `\nResult: ${rowInfo}`;
        }
        if (options?.tabCount && options.tabCount > 1) {
          tooltip += `\nTabs: ${options.tabCount}`;
        }
        break;
      }
      case "Error": {
        icon = "$(error)";
        text = "Error";
        tooltip = "Query Status: Error";
        if (options?.duration) {
          tooltip += `\nDuration: ${formatDuration(options.duration)}`;
        }
        const errorRowInfo = formatRowCount(
          options?.totalRows,
          options?.affectedRows
        );
        if (errorRowInfo) {
          tooltip += `\nPartial result: ${errorRowInfo}`;
        }
        if (options?.tabCount && options.tabCount > 1) {
          tooltip += `\nTabs: ${options.tabCount}`;
        }
        break;
      }
      case "Idle":
      default:
        icon = "$(clock)";
        text = "Idle";
        tooltip = "Query Status: Idle";
        break;
    }

    this.queryStatusItem.text = `${icon} ${text}`;
    this.queryStatusItem.tooltip = tooltip;
    this.queryStatusItem.show();
  }

  public hideConnectionStatus(): void {
    this.connectionStatusItem?.hide();
  }

  public displayAggregationMetrics(metrics: AggregationResult): void {
    const { columnName, sum, avg, count, countDistinct, isNumeric } = metrics;

    let statusText: string;
    let tooltip: string;

    if (!isNumeric) {
      statusText = `$(table) ${countDistinct}`;
      tooltip = `Column: ${columnName}\nCells selected: ${count}\nDistinct values: ${countDistinct}`;
    } else {
      const sumText = sum !== null ? sum.toFixed(2) : "0";
      const avgText = avg !== null ? avg.toFixed(2) : "0";

      statusText = `$(table) ${countDistinct}`;
      tooltip = `Column: ${columnName}\nCells selected: ${count}\nDistinct values: ${countDistinct}\nSum: ${sumText}\nAverage: ${avgText}`;
    }

    this.aggregationStatusItem.text = statusText;
    this.aggregationStatusItem.tooltip = tooltip;
    this.aggregationStatusItem.show();
  }

  public hideAggregationMetrics(): void {
    this.aggregationStatusItem.hide();
  }

  /**
   * Clean up status bar items
   */
  public dispose(): void {
    this.connectionStatusItem?.dispose();
    this.queryStatusItem.dispose();
    this.aggregationStatusItem.dispose();
    this.connectionWizard.dispose();
  }
}
