import * as vscode from "vscode";
import {
  StatusBarService,
  ConnectionProfileService,
  QueryStateManager,
  ConnectionService,
  MessageService,
  OutputService,
  getService,
} from "../../services";
import { ExtensionToWebviewMessage, ConnectionProfile } from "../../types";
import {
  ExecuteStreamingQueryHandler,
  ExecuteStreamingQueryHandlerImpl,
  ExportHandler,
  ExportHandlerImpl,
  FindMatchingTablesHandler,
  FindMatchingTablesHandlerImpl,
  GenerateSmartDrillQueryHandler,
  GenerateSmartDrillQueryHandlerImpl,
  GetSchemaDataHandler,
  SetActiveTabHandler,
  SetActiveTabHandlerImpl,
} from "../handlers";
import { IVscodeCommand } from "./ICommand";

/**Base class to extend from */
export abstract class BaseEditorProvider
  extends vscode.Disposable
  implements IVscodeCommand
{
  protected readonly connectionService: ConnectionService;
  protected readonly profileService: ConnectionProfileService;
  protected readonly statusBarService: StatusBarService;
  protected readonly messageService: MessageService;
  protected readonly outputService: OutputService;

  protected readonly queryStateManager: QueryStateManager;
  protected readonly executeStreamingQueryHandler: ExecuteStreamingQueryHandler;
  protected readonly findMatchingTablesHandler: FindMatchingTablesHandler;
  protected readonly generateSmartDrillQueryHandler: GenerateSmartDrillQueryHandler;
  protected readonly getSchemaDataHandler: GetSchemaDataHandler;
  protected readonly setActiveTabHandler: SetActiveTabHandler;
  protected readonly exportHandler: ExportHandler;

  abstract dispose(): void;

  public constructor(private readonly context: vscode.ExtensionContext) {
    super(() => {
      this.dispose();
    });

    this.connectionService = getService(ConnectionService);
    this.profileService = getService(ConnectionProfileService);
    this.statusBarService = getService(StatusBarService);
    this.queryStateManager = getService(QueryStateManager);
    this.messageService = getService(MessageService);
    this.outputService = getService(OutputService);

    this.executeStreamingQueryHandler = new ExecuteStreamingQueryHandlerImpl(
      context
    );
    this.findMatchingTablesHandler = new FindMatchingTablesHandlerImpl(context);
    this.generateSmartDrillQueryHandler =
      new GenerateSmartDrillQueryHandlerImpl(context);
    this.getSchemaDataHandler = new GetSchemaDataHandler(context);
    this.setActiveTabHandler = new SetActiveTabHandlerImpl(context);
    this.exportHandler = new ExportHandlerImpl(
      this.messageService,
      this.outputService
    );

    // Register handlers globally for all editor providers
    this.messageService.registerHandler("wv.setActiveTab", (message) => {
      this.setActiveTabHandler.handleSetActiveTab(message.payload);
    });

    this.messageService.registerHandler("wv.exportData", (message) => {
      this.exportHandler.handleExportData(message);
    });
  }

  registerContext(document: vscode.TextDocument): void {
    this.profileService.registerContext(document);
  }

  /**
   * If extension use a custom text editor (registerCustomEditorProvider), we need
   * to notify the custom editor about the connection change by calling `webview.postMessage`
   */
  abstract notifyCustomEditor(
    message: ExtensionToWebviewMessage
  ): Thenable<void>;

  abstract openEditor(): Thenable<void>;

  abstract executeAllQueries(): Thenable<void>;

  abstract executeQueryAtCursor(
    connectionProfile?: ConnectionProfile
  ): Thenable<void>;

  cancelAllQueries(): void {
    this.queryStateManager.cancelAllQueries();
  }

  async chooseConnection(): Promise<void> {
    const focusedContext = this.getFocusedContext();
    if (!focusedContext) {
      this.outputService.showWarning("No active SQL editor found.");
      return;
    }

    const selectedProfile = await this.statusBarService.showConnectionPopup();
    if (!selectedProfile) {
      return;
    }

    try {
      await this.connectionService.createConnectionPool(
        selectedProfile,
        focusedContext
      );

      const connectionSuccessful = await this.connectionService.testConnection(
        selectedProfile,
        focusedContext
      );

      if (!connectionSuccessful) {
        throw new Error("Connection test failed - no valid response received");
      }

      this.profileService.setActiveConnection(
        focusedContext,
        selectedProfile,
        "Connected"
      );
    } catch (error) {
      console.error("Connection failed:", error);
      this.outputService.showError(
        `Failed to connect to ${selectedProfile.name}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.profileService.setActiveConnection(
        focusedContext,
        selectedProfile,
        "Error"
      );
    }
  }

  /**
   * Show or hide the status bar for the currently focused context.
   */
  protected async updateStatusBarForFocusedContext(): Promise<void> {
    const focusedContext = this.getFocusedContext();
    if (focusedContext) {
      const connectionStatus =
        this.profileService.getConnectionStatus(focusedContext);
      const profile = await this.profileService.getActiveConnection(
        focusedContext
      );
      if (connectionStatus) {
        this.statusBarService.displayConnectionStatus(
          connectionStatus,
          profile
        );
      }
    } else {
      this.statusBarService.hideConnectionStatus();
      this.statusBarService.hideQueryStatus();
    }
  }

  /**
   * `vscode.window.activeTextEditor` returns null for custom editor
   * so it's best we leave this to subclasses
   */
  public abstract getFocusedContext(): vscode.TextDocument | undefined;
}
