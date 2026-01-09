import * as vscode from "vscode";
import { ConnectionProfile, DatabaseProvider } from "../types";
import { ConnectionService } from "./connection/ConnectionService";
import { ConnectionProfileService } from "./ConnectionProfileService";
import { OutputService } from "./OutputService";
import { getService } from "./index";

export interface ConnectionWizardResult {
  profile: ConnectionProfile;
  saved: boolean;
}

export class ConnectionWizard extends vscode.Disposable {
  constructor(
    private readonly profileService: ConnectionProfileService,
    private readonly outputService: OutputService
  ) {
    super(() => this.dispose());
  }

  public dispose(): void {
    // Cleanup if needed
  }

  /**
   * Main entry point for the connection wizard
   */
  public async showWizard(): Promise<ConnectionWizardResult | undefined> {
    try {
      // Step 1: Choose Database Provider
      const provider = await this.selectDatabaseProvider();
      if (!provider) {
        return undefined; // User cancelled
      }

      // Step 2: Collect connection details
      const connectionDetails = await this.collectConnectionDetails(provider);
      if (!connectionDetails) {
        return undefined; // User cancelled
      }

      const profile: ConnectionProfile = {
        provider,
        ...connectionDetails,
      };

      // Step 3: Test connection (optional)
      const shouldTest = await this.askToTestConnection();
      if (shouldTest) {
        const testResult = await this.testConnection(profile);
        if (!testResult.success) {
          const retry = await vscode.window.showWarningMessage(
            `Connection test failed: ${testResult.error}`,
            "Save Anyway",
            "Retry",
            "Cancel"
          );

          if (retry === "Retry") {
            // Recursive call to restart wizard
            return this.showWizard();
          } else if (retry === "Cancel") {
            return undefined;
          }
          // "Save Anyway" continues to step 4
        } else {
          this.outputService.showInfo("Connection test successful!");
        }
      }

      // Check if this is an overwrite operation
      const existingConnections = await this.profileService.loadProfiles();
      const isOverwrite = existingConnections.some(
        (conn) => conn.name.toLowerCase() === profile.name.toLowerCase()
      );

      // Step 4: Save to settings
      const saved = await this.saveConnectionProfile(profile);

      if (saved) {
        const action = isOverwrite ? "updated" : "saved";
        this.outputService.showInfo(
          `Connection "${profile.name}" ${action} successfully!`
        );
        // Reload profiles to include the new/updated one
        this.profileService.loadProfiles();
      }

      return { profile, saved };
    } catch (error) {
      this.outputService.showError(
        `Connection wizard error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return undefined;
    }
  }

  /**
   * Step 1: Let user choose database provider
   */
  private async selectDatabaseProvider(): Promise<
    DatabaseProvider | undefined
  > {
    const items: (vscode.QuickPickItem & { provider: DatabaseProvider })[] = [
      {
        label: "SQL Server",
        description: "ODBC protocol",
        detail: "Microsoft SQL Server database",
        provider: DatabaseProvider.SqlServer,
      },
      {
        label: "PostgreSQL",
        description: "ODBC protocol",
        detail: "Open-source relational database",
        provider: DatabaseProvider.PostgreSQL,
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a database provider",
      title: "New Connection - Step 1: Choose Database Provider",
    });

    return selected?.provider;
  }

  /**
   * Step 2: Collect connection details from user
   */
  private async collectConnectionDetails(
    provider: DatabaseProvider
  ): Promise<Omit<ConnectionProfile, "provider"> | undefined> {
    // Get existing connections to check for duplicates
    const existingConnections = await this.profileService.loadProfiles();

    // Connection name
    const name = await vscode.window.showInputBox({
      title: `New Connection - Step 2: ${provider} Connection Details`,
      prompt: "Enter a name for this connection",
      placeHolder: `My ${provider} Connection`,
      validateInput: (value) => {
        if (!value?.trim()) {
          return "Connection name is required";
        }
        return null;
      },
    });

    if (!name) {
      return undefined;
    }

    // If connection name exists, ask for confirmation
    const existingConnection = existingConnections.find(
      (conn) => conn.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (existingConnection) {
      const overwrite = await vscode.window.showWarningMessage(
        `A connection named "${name.trim()}" already exists.\n\nDo you want to overwrite it?`,
        { modal: true },
        "Yes, Overwrite",
        "Cancel"
      );

      if (overwrite !== "Yes, Overwrite") {
        return undefined; // User cancelled
      }
    }

    // Host
    const defaultHost = this.getDefaultHost(provider);
    const host = await vscode.window.showInputBox({
      prompt: "Enter the server host/IP address",
      placeHolder: defaultHost,
      value: defaultHost,
      validateInput: (value) => {
        if (!value?.trim()) {
          return "Host is required";
        }
        return null;
      },
    });

    if (!host) {
      return undefined;
    }

    // Port
    const defaultPort = this.getDefaultPort(provider);
    const portInput = await vscode.window.showInputBox({
      prompt: "Enter the server port",
      placeHolder: defaultPort.toString(),
      value: defaultPort.toString(),
      validateInput: (value) => {
        if (!value?.trim()) {
          return "Port is required";
        }
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return "Please enter a valid port number (1-65535)";
        }
        return null;
      },
    });

    if (!portInput) {
      return undefined;
    }
    const port = parseInt(portInput, 10);

    // Username (optional for some providers)
    const username = await vscode.window.showInputBox({
      prompt: "Enter username (optional for integrated authentication)",
      placeHolder: "username",
    });

    // Password (only if username provided)
    let password: string | undefined;
    if (username?.trim()) {
      password = await vscode.window.showInputBox({
        prompt: "Enter password",
        placeHolder: "password",
        password: true,
      });
    }

    return {
      name: name.trim(),
      host: host.trim(),
      port,
      username: username?.trim() ?? undefined,
      password: password?.trim() ?? undefined,
    };
  }

  /**
   * Step 3: Ask user if they want to test the connection
   */
  private async askToTestConnection(): Promise<boolean> {
    const result = await vscode.window.showQuickPick(
      [
        { label: "Yes", description: "Test the connection before saving" },
        { label: "No", description: "Save without testing" },
      ],
      {
        placeHolder: "Would you like to test the connection?",
        title: "New Connection - Step 3: Test Connection",
      }
    );

    return result?.label === "Yes";
  }

  /**
   * Test connection using ConnectionServiceRegistry's testConnection method
   */
  private async testConnection(
    profile: ConnectionProfile
  ): Promise<{ success: boolean; error?: string }> {
    // Show progress
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Testing connection to ${profile.name}...`,
        cancellable: false,
      },
      async () => {
        let connectionService: ConnectionService | undefined;

        try {
          connectionService = getService(ConnectionService);

          // Use the new testConnection method which returns a boolean
          const connectionSuccessful = await connectionService.testConnection(
            profile,
            undefined
          );

          if (connectionSuccessful) {
            return { success: true };
          } else {
            return { success: false, error: "Test query returned no results" };
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown connection error";

          // Clean up specific error messages for better user experience
          let userFriendlyError = errorMessage;

          if (errorMessage.includes("timeout")) {
            userFriendlyError =
              "Connection timeout - check host and port settings";
          } else if (
            errorMessage.includes("login failed") ||
            errorMessage.includes("authentication")
          ) {
            userFriendlyError =
              "Authentication failed - check username and password";
          } else if (
            errorMessage.includes("network") ||
            errorMessage.includes("host")
          ) {
            userFriendlyError =
              "Cannot reach server - check host and network connectivity";
          } else if (errorMessage.includes("port")) {
            userFriendlyError =
              "Cannot connect to port - check port number and firewall settings";
          }

          return {
            success: false,
            error: userFriendlyError,
          };
        } finally {
          // Clean up connection service
          if (connectionService) {
            try {
              connectionService.dispose();
            } catch (cleanupError) {
              console.warn("Error during connection cleanup:", cleanupError);
            }
          }
        }
      }
    );
  }

  /**
   * Step 4: Save connection profile to VS Code settings
   */
  private async saveConnectionProfile(
    profile: ConnectionProfile
  ): Promise<boolean> {
    try {
      // Determine configuration target based on workspace context
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let config: vscode.WorkspaceConfiguration;
      let configTarget: vscode.ConfigurationTarget;

      if (workspaceFolders && workspaceFolders.length > 0) {
        // Use workspace settings if we have a workspace
        config = vscode.workspace.getConfiguration(
          "jSql",
          workspaceFolders[0].uri
        );
        configTarget = vscode.ConfigurationTarget.Workspace;
      } else {
        // Use global settings if no workspace
        config = vscode.workspace.getConfiguration("jSql");
        configTarget = vscode.ConfigurationTarget.Global;
      }

      const currentProviders = config.get("providers", {}) as Record<
        string,
        unknown
      >;

      // Create a deep copy to avoid mutation issues
      const providers = JSON.parse(JSON.stringify(currentProviders));

      if (!Array.isArray(providers[profile.provider])) {
        providers[profile.provider] = [];
      }

      // Create the connection entry
      const connectionEntry: Record<string, string | number> = {
        name: profile.name,
        host: profile.host,
        port: profile.port,
      };

      if (profile.username) {
        connectionEntry.username = profile.username;
      }
      if (profile.password) {
        connectionEntry.password = profile.password;
      }

      // Check if a connection with the same name already exists
      const providerConnections = providers[profile.provider] as unknown[];
      const existingIndex = providerConnections.findIndex(
        (connection: unknown) =>
          typeof connection === "object" &&
          connection !== null &&
          "name" in connection &&
          connection.name === profile.name
      );

      if (existingIndex !== -1) {
        // Overwrite existing connection with same name
        providerConnections[existingIndex] = connectionEntry;
      } else {
        // Add new connection
        providerConnections.push(connectionEntry);
      }

      // Update settings
      await config.update("providers", providers, configTarget);

      return true;
    } catch (error) {
      console.error("Error saving connection profile:", error);
      this.outputService.showError(
        `Failed to save connection: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return false;
    }
  }

  /**
   * Get default host for each provider
   */
  private getDefaultHost(provider: DatabaseProvider): string {
    switch (provider) {
      case DatabaseProvider.SqlServer:
        return "localhost";
      case DatabaseProvider.PostgreSQL:
        return "localhost";
      default:
        return "localhost";
    }
  }

  /**
   * Get default port for each provider
   */
  private getDefaultPort(provider: DatabaseProvider): number {
    switch (provider) {
      case DatabaseProvider.SqlServer:
        return 1433; // Standard SQL Server port
      case DatabaseProvider.PostgreSQL:
        return 5432; // Standard PostgreSQL port
      default:
        return 1433;
    }
  }
}
