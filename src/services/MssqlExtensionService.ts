import * as vscode from "vscode";
import { DatabaseProvider, SqlServerConnectionProfile } from "../types";
import { OutputService } from "./OutputService";
import { getService } from ".";

// Uses the public MSSQL shared-connections API (version 1).

interface MssqlSharedConnectionsApi {
  authenticationProviderId: string;
  getActiveEditorConnectionId(accessToken: string): Promise<string | undefined>;
  getConnectionString(
    accessToken: string,
    connectionId: string,
  ): Promise<string | undefined>;
  onDidChangeActiveEditorConnection: vscode.Event<void>;
}

interface MssqlExtensionApi {
  getSharedConnectionsApi(version: 1): MssqlSharedConnectionsApi;
}

interface MssqlConnectionSession {
  api: MssqlSharedConnectionsApi;
  accessToken: string;
}

export class MssqlExtensionService extends vscode.Disposable {
  private readonly mssqlApi: Promise<MssqlSharedConnectionsApi | undefined>;
  private readonly outputService: OutputService;
  private readonly activeConnectionChangedEmitter =
    new vscode.EventEmitter<SqlServerConnectionProfile>();
  private readonly connectionChangeSubscription: vscode.Disposable[] = [];
  private isDisposed = false;

  public readonly onDidChangeActiveConnection =
    this.activeConnectionChangedEmitter.event;

  constructor() {
    super(() => this.dispose());
    this.outputService = getService(OutputService);
    this.mssqlApi = this.initialize();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.connectionChangeSubscription.forEach((subscription) =>
      subscription.dispose(),
    );
    this.connectionChangeSubscription.length = 0;
    this.activeConnectionChangedEmitter.dispose();
  }

  private async initialize(): Promise<MssqlSharedConnectionsApi | undefined> {
    try {
      const mssqlExtension =
        vscode.extensions.getExtension<MssqlExtensionApi>("ms-mssql.mssql");

      if (mssqlExtension) {
        const extensionApi = mssqlExtension.isActive
          ? mssqlExtension.exports
          : await mssqlExtension.activate();
        const sharedConnectionsApi = extensionApi.getSharedConnectionsApi(1);
        if (this.isDisposed) {
          return undefined;
        }
        this.connectionChangeSubscription.push(
          sharedConnectionsApi.onDidChangeActiveEditorConnection(async () => {
            const profile = await this.getCurrentConnection();
            if (profile) {
              this.activeConnectionChangedEmitter.fire(profile);
            }
          }),
        );
        this.outputService.writeToOutput("MSSQL extension is active.", "INFO");
        return sharedConnectionsApi;
      } else {
        this.outputService.writeToOutput(
          "MSSQL extension is not installed.",
          "INFO",
        );
        return undefined;
      }
    } catch (error) {
      this.outputService.writeToOutput(
        `MSSQL extension not found or failed to initialize: ${error}`,
        "INFO",
      );
      return undefined;
    }
  }

  public async isExtensionAvailable(): Promise<boolean> {
    return (await this.mssqlApi) !== undefined;
  }

  public async getActiveMssqlConnection(): Promise<
    SqlServerConnectionProfile | undefined
  > {
    if (!(await this.isExtensionAvailable())) {
      return undefined;
    }
    return this.getCurrentConnection();
  }

  /**
   * Use the MSSQL connection picker and return the selected active-editor profile.
   * @returns Selected connection profile or undefined if none selected or MSSQL extension not available
   */
  public async showConnectionPopup(): Promise<
    SqlServerConnectionProfile | undefined
  > {
    if (!(await this.isExtensionAvailable())) {
      return undefined;
    }
    const api = await this.mssqlApi;
    if (!api) {
      this.outputService.writeToOutput(
        "MSSQL extension API not available",
        "INFO",
      );
      return undefined;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId !== "sql") {
      this.outputService.writeToOutput(
        "Open a SQL editor to choose an MSSQL connection.",
        "INFO",
      );
      return undefined;
    }

    const session = await this.getConnectionSession(api, true);
    if (!session) {
      return undefined;
    }

    let connectionChanged: vscode.Disposable | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const selectedConnection = new Promise<
      SqlServerConnectionProfile | undefined
    >((resolve) => {
      connectionChanged = this.onDidChangeActiveConnection(resolve);
      timeout = setTimeout(() => resolve(undefined), 120_000);
    });

    try {
      await vscode.commands.executeCommand("mssql.connect");
      const profile = await selectedConnection;
      if (!profile) {
        this.outputService.writeToOutput(
          "No MSSQL connection was selected.",
          "INFO",
        );
        return undefined;
      }

      return profile;
    } catch (error) {
      this.outputService.writeToOutput(
        `Error obtaining connection from MSSQL extension: ${error}`,
        "ERROR",
      );
      return undefined;
    } finally {
      connectionChanged?.dispose();
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  /**
   * Get connection profile from current active editor mssql extension connection
   */
  private async getCurrentConnection(): Promise<
    SqlServerConnectionProfile | undefined
  > {
    const session = await this.getConnectionSession();
    if (!session) {
      return undefined;
    }

    const connectionId = await session.api.getActiveEditorConnectionId(
      session.accessToken,
    );
    if (!connectionId) {
      return undefined;
    }

    // Sample
    // Data Source=jsql-extension-test.database.windows.net;Initial Catalog=jsql;
    // Pooling=False;Connect Timeout=30;Encrypt=True;Trust Server Certificate=True;
    // Application Name=vscode-mssql;Application Intent=ReadWrite;Command Timeout=30
    const connectionString = await session.api.getConnectionString(
      session.accessToken,
      connectionId,
    );
    if (!connectionString) {
      this.outputService.writeToOutput(
        "MSSQL did not return a connection string for the active connection.",
        "WARNING",
      );
      return undefined;
    }

    return this.parse(connectionString);
  }

  private async getConnectionSession(
    api?: MssqlSharedConnectionsApi,
    promptForConsent = false,
  ): Promise<MssqlConnectionSession | undefined> {
    const sharedConnectionsApi = api ?? (await this.mssqlApi);
    if (!sharedConnectionsApi) {
      return undefined;
    }

    const session = await vscode.authentication.getSession(
      sharedConnectionsApi.authenticationProviderId,
      [],
      promptForConsent ? { createIfNone: true } : { silent: true },
    );
    return session
      ? { api: sharedConnectionsApi, accessToken: session.accessToken }
      : undefined;
  }

  private splitConnectionString(connectionString: string): Map<string, string> {
    const params: Map<string, string> = new Map<string, string>();

    connectionString.split(";").forEach((param) => {
      const trimmed = param.trim();
      if (trimmed) {
        const equalIndex = trimmed.indexOf("=");
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim().toLowerCase();
          const value = trimmed.substring(equalIndex + 1).trim();
          // Remove quotes from value if present
          const cleanValue = value.replace(/^["']|["']$/g, "");
          params.set(key, cleanValue);
        }
      }
    });

    return params;
  }

  private parse(connectionString: string): SqlServerConnectionProfile {
    const params = this.splitConnectionString(connectionString);

    // Extract basic connection details
    const dataSource =
      params.get("data source") ??
      params.get("server") ??
      params.get("address") ??
      params.get("addr") ??
      params.get("network address") ??
      "localhost";
    const database =
      params.get("initial catalog") ??
      params.get("database") ??
      params.get("initial database");
    const username = params.get("user id") ?? params.get("uid");
    const password = params.get("password") ?? params.get("pwd");

    const normalizedDataSource = dataSource.trim().replace(/^tcp:/i, "");
    const commaSeparator = normalizedDataSource.lastIndexOf(",");
    const colonSeparator = normalizedDataSource.lastIndexOf(":");
    const portSeparator =
      commaSeparator > 0
        ? commaSeparator
        : colonSeparator > 0 &&
            normalizedDataSource.indexOf(":") === colonSeparator &&
            !normalizedDataSource.startsWith("[")
          ? colonSeparator
          : -1;
    const explicitPort = Number.parseInt(
      normalizedDataSource.slice(portSeparator + 1),
      10,
    );
    const host =
      portSeparator > 0 && !Number.isNaN(explicitPort)
        ? normalizedDataSource.slice(0, portSeparator).trim()
        : normalizedDataSource;
    const port =
      portSeparator > 0 && !Number.isNaN(explicitPort) ? explicitPort : 1433;

    // Extract advanced connection options
    const connectTimeoutParam =
      params.get("connect timeout") ?? params.get("connection timeout");
    const connectTimeout = connectTimeoutParam
      ? parseInt(connectTimeoutParam, 10)
      : undefined;
    const commandTimeoutParam = params.get("command timeout");
    const commandTimeout = commandTimeoutParam
      ? parseInt(commandTimeoutParam, 10)
      : undefined;
    const encrypt = this.parseBoolean(params.get("encrypt"));
    const trustServerCertificate = this.parseBoolean(
      params.get("trust server certificate"),
    );
    const pooling = params.has("pooling")
      ? this.parseBoolean(params.get("pooling"))
      : true;
    const minPoolSizeParam = params.get("min pool size");
    const minPoolSize = minPoolSizeParam
      ? parseInt(minPoolSizeParam, 10)
      : undefined;
    const maxPoolSizeParam = params.get("max pool size");
    const maxPoolSize = maxPoolSizeParam
      ? parseInt(maxPoolSizeParam, 10)
      : undefined;
    const applicationName = params.get("application name");
    const applicationIntentValue = params
      .get("application intent")
      ?.toLowerCase();
    const applicationIntent =
      applicationIntentValue === "readonly"
        ? "ReadOnly"
        : applicationIntentValue === "readwrite"
          ? "ReadWrite"
          : undefined;
    const serverSPN = params.get("serverspn") ?? params.get("server spn");

    // Parse authentication method
    const authenticationParam = params.get("authentication");
    const integratedSecurity = params.get("integrated security");
    const trustedConnection = params.get("trusted connection");

    let authentication:
      | SqlServerConnectionProfile["authentication"]
      | undefined;

    // https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication?view=sql-server-ver17
    if (authenticationParam) {
      switch (authenticationParam.toLowerCase()) {
        case "activedirectoryinteractive":
        case "active directory interactive":
          authentication = "Active Directory Interactive";
          break;
        case "sqlpassword":
        case "sql password":
          authentication = "Sql Password";
          break;
        default:
          throw new Error(
            `Unsupported authentication method: ${authenticationParam}`,
          );
      }
    } else if (
      this.isEnabled(integratedSecurity) ||
      this.isEnabled(trustedConnection)
    ) {
      // Check for Windows authentication indicators
      authentication = "Integrated Security";
    } else if (!username && !password) {
      // Newer versions of vscode-mssql (>=1.40) can omit authentication/user fields for Azure MFA flows.
      authentication = vscode.workspace
        .getConfiguration("jSql")
        .get<
          "Active Directory Interactive" | "Active Directory Default"
        >("azureSqlAuthentication", "Active Directory Interactive");
    } else {
      authentication = "Sql Password";
    }

    // Create a meaningful connection name
    const authSuffix =
      authentication !== "Sql Password" ? ` (${authentication})` : "";
    const profileName = `${host}${
      database ? ` (${database})` : ""
    }${authSuffix} [MSSQL]`;

    return {
      name: profileName,
      provider: DatabaseProvider.SqlServer,
      host,
      port,
      database,
      username,
      password,
      connectTimeout,
      commandTimeout,
      encrypt,
      trustServerCertificate,
      pooling,
      minPoolSize,
      maxPoolSize,
      authentication,
      applicationName,
      applicationIntent,
      serverSPN,
    };
  }

  private parseBoolean(value: string | undefined): boolean {
    return value !== undefined && /^(true|yes|sspi|1)$/i.test(value);
  }

  private isEnabled(value: string | undefined): boolean {
    return this.parseBoolean(value);
  }
}
