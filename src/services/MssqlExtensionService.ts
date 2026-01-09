import * as vscode from "vscode";
import {
  DatabaseProvider,
  SqlServerConnectionProfile,
} from "../types";
import { OutputService } from "./OutputService";
import { getService } from ".";

// works with MSSQL extension API (1.36)

interface MssqlExtensionApi {
  /**
   * Get the connection string for the provided connection Uri or ConnectionDetails.
   * https://github.com/microsoft/vscode-mssql/blob/main/src/controllers/connectionManager.ts#L433
   * @param connectionUriOrDetails Either the connection Uri for the connection or the connection details for the connection is required.
   * @param includePassword (optional) if password should be included in connection string; default is false
   * @param includeApplicationName (optional) if application name should be included in connection string; default is true
   * @returns connection string for the connection
   */
  getConnectionString(
    uriString: string | Record<string, string> | undefined,
    includePassword: boolean,
    includeApplicationName: boolean
  ): Promise<string>;

  /**
   * Prompt the user to select or create a connection profile (of MSSQL extension - not this current extension).
   * https://github.com/microsoft/vscode-mssql/blob/main/src/extension.ts
   * https://github.com/microsoft/vscode-mssql/blob/86d0f270d7e82a54a46e9b43994ad963a990bc7c/src/views/connectionUI.ts#L74C18-L74C27
   * @param ignoreFocusOut (optional) if true, the prompt will not close when focus is lost
   * @returns The selected or created record is [IConnectionInfo](https://github.com/microsoft/vscode-mssql/blob/main/typings/vscode-mssql.d.ts#L215)
   */
  promptForConnection(
    ignoreFocusOut?: boolean
  ): Promise<Record<string, string> | undefined>;

  /**
   * https://github.com/microsoft/vscode-mssql/blob/main/src/extension.ts
   * @param connectionInfo [IConnectionInfo](https://github.com/microsoft/vscode-mssql/blob/main/typings/vscode-mssql.d.ts#L215)
   * @param saveConnection
   */
  connect(
    connectionInfo: Record<string, string>,
    saveConnection?: boolean
  ): Promise<string>;
}

export class MssqlExtensionService extends vscode.Disposable {
  private readonly mssqlApi: Promise<MssqlExtensionApi | undefined>;
  private readonly outputService: OutputService;

  constructor() {
    super(() => this.dispose());
    this.outputService = getService(OutputService);
    this.mssqlApi = this.initialize();
  }

  private async initialize(): Promise<MssqlExtensionApi | undefined> {
    try {
      const mssqlExtension =
        vscode.extensions.getExtension<MssqlExtensionApi>("ms-mssql.mssql");

      if (mssqlExtension) {
        if (!mssqlExtension.isActive) {
          await mssqlExtension.activate();
        }
        this.outputService.writeToOutput("MSSQL extension is active.", "INFO");
        return mssqlExtension.exports;
      } else {
        this.outputService.writeToOutput(
          "MSSQL extension is not installed.",
          "INFO"
        );
        return undefined;
      }
    } catch (error) {
      this.outputService.writeToOutput(
        `MSSQL extension not found or failed to initialize: ${error}`,
        "INFO"
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
    // get connection string from extension API, not from ConnectionSharing service
    // so no need to get connectionId or ask for permission
    return this.getCurrentConnection();
  }

  /**
   * Show MSSQL extension connection profile picker popup
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
        "INFO"
      );
      return undefined;
    }
    const connectionInfo = await api.promptForConnection(false);
    if (!connectionInfo) {
      return;
    }

    let uri: string | undefined;
    try {
      uri = await api.connect(connectionInfo, false);

      if (!uri) {
        console.warn("No connection uri returned from MSSQL API");
        return undefined;
      }

      const connectionString = await api.getConnectionString(
        uri,
        true, // includePassword
        true
      );
      if (!connectionString) {
        return undefined;
      }

      return this.parse(connectionString);
    } catch (error) {
      this.outputService.writeToOutput(
        `Error obtaining connection from MSSQL extension: ${error}`,
        "ERROR"
      );
      return undefined;
    }
  }

  /**
   * Get connection profile from current active editor mssql extension connection
   */
  private async getCurrentConnection(): Promise<
    SqlServerConnectionProfile | undefined
  > {
    const api = await this.mssqlApi;
    if (!api) {
      console.warn("MSSQL extension API not available");
      return undefined;
    }

    try {
      const connectionString = await api.getConnectionString(
        vscode.window.activeTextEditor?.document.uri.toString(true),
        true, // includePassword
        true
      );

      if (!connectionString) {
        console.warn("No connection string returned from MSSQL API");
        return undefined;
      }

      // console.debug("[MSSQL connection string]");
      // console.debug(connectionString);
      // console.debug("[/MSSQL connection string]");

      return this.parse(connectionString);
    } catch {
      // this.outputService.writeToOutput(
      //   `Error getting connection string from MSSQL API: ${error}`,
      //   "ERROR"
      // );
      return undefined;
    }
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
      params.get("data source") ?? params.get("server") ?? "localhost";
    const database = params.get("initial catalog") ?? params.get("database");
    const username = params.get("user id") ?? params.get("uid");
    const password = params.get("password") ?? params.get("pwd");

    // Parse server and port from data source
    const serverParts = dataSource.split(/[,:]/);
    const host = serverParts[0].trim();
    const port = serverParts.length > 1 ? parseInt(serverParts[1], 10) : 1433;

    // Extract advanced connection options
    const connectTimeoutParam = params.get("connect timeout");
    const connectTimeout = connectTimeoutParam
      ? parseInt(connectTimeoutParam, 10)
      : undefined;
    const commandTimeoutParam = params.get("command timeout");
    const commandTimeout = commandTimeoutParam
      ? parseInt(commandTimeoutParam, 10)
      : undefined;
    const encrypt =
      params.get("encrypt") === "true" || params.get("encrypt") === "True";
    const trustServerCertificate =
      params.get("trust server certificate") === "true" ||
      params.get("trust server certificate") === "True";
    const pooling =
      params.get("pooling") !== "false" && params.get("pooling") !== "False";
    const minPoolSizeParam = params.get("min pool size");
    const minPoolSize = minPoolSizeParam
      ? parseInt(minPoolSizeParam, 10)
      : undefined;
    const maxPoolSizeParam = params.get("max pool size");
    const maxPoolSize = maxPoolSizeParam
      ? parseInt(maxPoolSizeParam, 10)
      : undefined;
    const applicationName = params.get("application name");
    const applicationIntent = params.get("application intent") as
      | "ReadWrite"
      | "ReadOnly"
      | undefined;
    const accessToken = params.get("token"); // Azure AD access token
    const serverSPN = params.get("serverspn") ?? params.get("server spn");

    // Parse authentication method
    const authenticationParam = params.get("authentication");
    const integratedSecurity = params.get("integrated security");
    const trustedConnection = params.get("trusted connection");

    let authentication: SqlServerConnectionProfile["authentication"] =
      "Sql Password"; // Default

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
            `Unsupported authentication method: ${authenticationParam}`
          );
      }
    } else if (
      integratedSecurity === "true" ||
      integratedSecurity === "True" ||
      trustedConnection === "true" ||
      trustedConnection === "True"
    ) {
      // Check for Windows authentication indicators
      authentication = "Integrated Security";
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
      port: isNaN(port) ? 1433 : port,
      database,
      username,
      password,
      connectionString,
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
      accessToken,
      serverSPN,
    } as SqlServerConnectionProfile;
  }
}
