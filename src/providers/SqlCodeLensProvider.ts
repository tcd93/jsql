import * as vscode from "vscode";
import {
  StatusBarService,
  ConnectionService,
  ConnectionProfileService,
  OutputService,
  getService,
  QueryStateManager,
} from "../services";
import { ConnectionProfile } from "../types";
import { splitSqlQueries, isOnlyComments } from "../utils";

export type ExecuteQueryCallback = (
  queryId: string,
  queryText: string,
  document: vscode.TextDocument,
  selection?: vscode.Selection,
  connectionProfile?: ConnectionProfile
) => Promise<void>;

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private readonly statusBarService: StatusBarService;
  private readonly connectionService: ConnectionService;
  private readonly connectionProfileService: ConnectionProfileService;
  private readonly outputService: OutputService;
  private readonly queryStateManager: QueryStateManager;

  private mssqlAvailable = false;

  constructor(
    private readonly executeQuery: ExecuteQueryCallback,
    context: vscode.ExtensionContext
  ) {
    this.statusBarService = getService(StatusBarService);
    this.connectionProfileService = getService(ConnectionProfileService);
    this.connectionService = getService(ConnectionService);
    this.outputService = getService(OutputService);
    this.queryStateManager = getService(QueryStateManager);

    this.connectionProfileService
      .isMssqlExtensionAvailable()
      .then((available) => {
        this.mssqlAvailable = available;
      });

    // Register command for running queries from CodeLens
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "jSql.executeQueryFromCodeLens",
        (
          queryText: string,
          documentUri: string,
          startPosition: number,
          endPosition: number
        ) => {
          const document = vscode.workspace.textDocuments.find(
            (doc) => doc.uri.toString() === documentUri
          );
          if (!document) {
            return;
          }
          const selection = new vscode.Selection(
            document.positionAt(startPosition),
            document.positionAt(endPosition)
          );

          this.executeQueryFromCodeLens(queryText, documentUri, selection);
        }
      )
    );

    // Register command for selecting connection and running query from CodeLens
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "jSql.selectConnectionAndRunQuery",
        (
          queryText: string,
          documentUri: string,
          prioritizeMssqlExtension = true,
          startPosition: number,
          endPosition: number
        ) => {
          this.selectConnectionAndRunQuery(
            queryText,
            documentUri,
            prioritizeMssqlExtension,
            startPosition,
            endPosition
          );
        }
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("jSql.cancelQuery", (queryId: string) =>
        this.cancelQuery(queryId)
      )
    );
  }

  /**
   * Trigger a refresh of CodeLenses on this provider
   */
  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Execute query with the active connection
   */
  private async executeQueryFromCodeLens(
    queryText: string,
    documentUri: string,
    selection: vscode.Selection,
    connectionProfile?: ConnectionProfile
  ): Promise<void> {
    // Find the document by URI
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === documentUri
    );

    if (!document) {
      this.outputService.showWarning("Document not found");
      return;
    }

    if (!queryText.trim()) {
      this.outputService.showWarning("No query to execute");
      return;
    }

    await this.executeQuery(
      crypto.randomUUID(),
      queryText.trim(),
      document,
      selection,
      connectionProfile
    );
  }

  /**
   * Select a connection and run the query
   */
  private async selectConnectionAndRunQuery(
    queryText: string,
    documentUri: string,
    prioritizeMssqlExtension = true,
    startPosition: number,
    endPosition: number
  ): Promise<void> {
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === documentUri
    );

    if (!document) {
      this.outputService.showWarning(
        "Document not found in selectConnectionAndRunQuery, aborting."
      );
      return;
    }

    // Show connection selection popup
    const selectedProfile = await this.statusBarService.showConnectionPopup(
      prioritizeMssqlExtension
    );
    if (!selectedProfile) {
      return; // User cancelled the selection
    }

    // Test the connection before using it
    try {
      const connectionSuccessful = await this.connectionService.testConnection(
        selectedProfile,
        document
      );

      if (!connectionSuccessful) {
        throw new Error("Connection test failed - no valid response received");
      }
    } catch (error) {
      this.outputService.showError(
        `Failed to connect to ${selectedProfile.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return;
    }

    const selection = new vscode.Selection(
      document.positionAt(startPosition),
      document.positionAt(endPosition)
    );

    // Execute the query with the selected connection profile
    this.executeQueryFromCodeLens(
      queryText,
      documentUri,
      selection,
      selectedProfile
    );
  }

  private cancelQuery(queryId: string): void {
    this.queryStateManager.cancelQuery(queryId);
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    // Check if CodeLens is enabled in settings
    const codeLensEnabled = vscode.workspace
      .getConfiguration("jSql.codeLens")
      .get<boolean>("enabled", true);

    if (!codeLensEnabled || document.languageId !== "sql") {
      return [];
    }

    // Check cancellation token early
    if (token.isCancellationRequested) {
      return [];
    }

    const text = document.getText();
    if (!text.trim()) {
      return [];
    }

    if (token.isCancellationRequested) {
      return [];
    }

    // Parse queries - this is the expensive synchronous operation
    // This must be fast - under 20ms even for large file - otherwise VSCode will lag
    const queries = splitSqlQueries(text);

    if (token.isCancellationRequested) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    for (const queryInfo of queries) {
      // Check cancellation token periodically
      if (token.isCancellationRequested) {
        return [];
      }

      // Skip empty queries or queries that are only comments
      if (!queryInfo.query.trim() || isOnlyComments(queryInfo.query)) {
        continue;
      }

      const startPosition = document.positionAt(queryInfo.startPosition);
      const endPosition = document.positionAt(queryInfo.endPosition);
      const range = new vscode.Range(startPosition, endPosition);

      // Do not create the CodeLens command here; otherwise `resolveCodeLens` won't be called later
      // It is to optimize performance by deferring command creation until necessary
      const codeLens1 = new vscode.CodeLens(range);
      // Attach the metadata as an argument for later use (hacky method - weird that VSCode doesn't provide a better way)
      codeLens1["__title__"] = "▶ Run (Shift+↵)";
      codeLens1["__command__"] = "jSql.executeQueryFromCodeLens";
      codeLens1["__tooltip__"] =
        'Execute this query with the active connection (if MSSQL extension is installed and connected, this will "borrow" its setting)';
      codeLens1["__aguments__"] = [
        queryInfo.query,
        document.uri.toString(),
        queryInfo.startPosition,
        queryInfo.endPosition,
      ];

      const codeLens2 = new vscode.CodeLens(range);
      codeLens2["__title__"] = "🔗 Run@DB";
      codeLens2["__command__"] = "jSql.selectConnectionAndRunQuery";
      codeLens2["__tooltip__"] =
        "Select a different database connection to run this query";
      codeLens2["__aguments__"] = [
        queryInfo.query,
        document.uri.toString(),
        true,
        queryInfo.startPosition,
        queryInfo.endPosition,
      ];

      codeLenses.push(codeLens1, codeLens2);

      if (this.mssqlAvailable) {
        const codeLens3 = new vscode.CodeLens(range);
        codeLens3["__title__"] = "🛠️ Custom Connection";
        codeLens3["__command__"] = "jSql.selectConnectionAndRunQuery";
        codeLens3["__tooltip__"] =
          "Configure and use a custom J-SQL connection for this query";
        codeLens3["__aguments__"] = [
          queryInfo.query,
          document.uri.toString(),
          false,
          queryInfo.startPosition,
          queryInfo.endPosition,
        ];
        codeLenses.push(codeLens3);
      }
    }

    return codeLenses;
  }

  resolveCodeLens(
    codeLens: vscode.CodeLens,
    _: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    // Retrieve the metadata attached earlier
    const title = codeLens["__title__"] as string;
    const command = codeLens["__command__"] as string;
    const tooltip = codeLens["__tooltip__"] as string;
    const args = codeLens["__aguments__"] as unknown[];

    let isQueryExecuting = false;

    // If this CodeLens's query is currently running, change the first CodeLens to "Cancel"
    // and don't resolve the others
    for (const [, queryState] of this.queryStateManager.queryStates) {
      const range = codeLens.range;
      if (
        queryState.selection &&
        queryState.selection.isEqual(range) &&
        queryState.status === "running"
      ) {
        isQueryExecuting = true;
        if (command === "jSql.executeQueryFromCodeLens") {
          codeLens.command = {
            title: "✖ Cancel",
            command: "jSql.cancelQuery",
            tooltip: "Cancel this running query",
            arguments: [queryState.queryId, queryState.queryText],
          };
        }
      }
    }

    // If the query is not executing, resolve normally
    if (!isQueryExecuting) {
      codeLens.command = {
        title,
        command,
        tooltip,
        arguments: args,
      };
    }

    return codeLens;
  }
}
