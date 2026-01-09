import * as vscode from "vscode";
import {
  MessageService,
  QueryStateManager,
  ConnectionProfileService,
  ConnectionService,
  OutputService,
  getService,
} from "../../services";
import {
  ConnectionProfile,
  DatabaseProvider,
  QueryRequest,
  ExecuteStreamingQueryCompleteMessage,
  ExecuteStreamingQueryDataMessage,
  ExecuteStreamingQuerySchemaMessage,
  ExecuteStreamingQueryErrorMessage,
  ExecuteStreamingQueryInfoMessage,
} from "../../types";

export interface ExecuteStreamingQueryHandler {
  handleExecuteStreamingQuery(
    payload: QueryRequest,
    context: vscode.TextDocument
  ): Promise<void>;
  executeStreamingQuery(
    query: string,
    queryId: string,
    context: vscode.TextDocument,
    selection?: vscode.Selection,
    connectionProfile?: ConnectionProfile
  ): Promise<void>;
}

export class ExecuteStreamingQueryHandlerImpl
  implements ExecuteStreamingQueryHandler
{
  private readonly profileService: ConnectionProfileService;
  private readonly connectionService: ConnectionService;
  private readonly queryStateManager: QueryStateManager;
  private readonly messageService: MessageService;
  private readonly outputService: OutputService;

  constructor(readonly context: vscode.ExtensionContext) {
    this.profileService = getService(ConnectionProfileService);
    this.connectionService = getService(ConnectionService);
    this.queryStateManager = getService(QueryStateManager);
    this.messageService = getService(MessageService);
    this.outputService = getService(OutputService);
  }

  async handleExecuteStreamingQuery(
    payload: QueryRequest,
    context: vscode.TextDocument
  ): Promise<void> {
    const { queryId } = payload;
    await this.executeStreamingQuery(payload.query, queryId, context);
  }

  public async executeStreamingQuery(
    queryId: string,
    query: string,
    context: vscode.TextDocument,
    selection?: vscode.Selection,
    connectionProfile?: ConnectionProfile
  ): Promise<void> {
    // generate tab id for client to display this in a new tab
    // assuming predictable streaming order: recordset > rows > next recordset > rows...
    let tabId: string;

    // Use provided connection profile or fall back to document's active connection
    const profile =
      connectionProfile ??
      (await this.profileService.getActiveConnection(context));
    if (!profile || profile.provider === DatabaseProvider.None) {
      const message: ExecuteStreamingQueryErrorMessage = {
        type: "ext.streamingQueryError",
        payload: {
          queryId,
          tabId: "",
          query,
          error: "No active connection profile found",
        },
      };
      this.messageService.invoke(message);
      return;
    }
    try {
      // Focus the query results panel
      await vscode.commands.executeCommand("jsql-query-results-view.focus");

      const abort = await this.connectionService.executeStreamingQuery(
        queryId,
        query,
        profile,
        {
          onSchema: (schema) => {
            // Query might return multiple result sets, use one tab per result set
            tabId = crypto.randomUUID();
            this.outputService.writeToOutput(
              `Streaming query schema received for\n
              tabId=${tabId}\n
              query=${query}\n
              schema=${JSON.stringify(schema)}\n`
            );
            this.queryStateManager.updateTabId(queryId, tabId);
            const message: ExecuteStreamingQuerySchemaMessage = {
              type: "ext.streamingQuerySchema",
              payload: {
                queryId,
                tabId,
                query,
                schema,
              },
            };
            this.messageService.invoke(message);
          },
          onData: (data) => {
            const message: ExecuteStreamingQueryDataMessage = {
              type: "ext.streamingQueryData",
              payload: {
                queryId,
                tabId,
                data,
              },
            };
            this.messageService.invoke(message);
          },
          onComplete: (summary) => {
            const message: ExecuteStreamingQueryCompleteMessage = {
              type: "ext.streamingQueryComplete",
              payload: {
                query,
                queryId,
                tabId,
                summary,
              },
            };
            this.messageService.invoke(message);
            this.outputService.writeToOutput(
              `Streaming query completed for\n
              tabId=${tabId}\n
              query=${query}\n
              summary=${JSON.stringify(summary)}\n`
            );
            this.queryStateManager.completeQuery(queryId, {
              totalRows: summary.totalRows,
              affectedRows: summary.affectedRows,
            });
          },
          onError: (error) => {
            console.error(
              `Error during streaming query (tabId=${tabId}): ${error}`
            );
            this.outputService.writeToOutput(
              `Error during streaming query (tabId=${tabId}): ${error}`,
              "ERROR"
            );
            const message: ExecuteStreamingQueryErrorMessage = {
              type: "ext.streamingQueryError",
              payload: {
                queryId,
                tabId,
                query,
                error,
              },
            };
            this.messageService.invoke(message);
            this.queryStateManager.errorQuery(queryId);
          },
          onInfo: (info) => {
            // Show info in OUTPUT channel and as notification
            this.outputService.showInfo(info);

            // Send info message to webview
            const message: ExecuteStreamingQueryInfoMessage = {
              type: "ext.streamingQueryInfo",
              payload: {
                queryId,
                tabId,
                info,
              },
            };
            this.messageService.invoke(message);
          },
        },
        context
      );

      await this.queryStateManager.startQuery(
        queryId,
        query,
        context,
        selection,
        abort,
        profile
      );
    } catch (error) {
      console.error("Failed to execute streaming query", error);
      this.outputService.writeToOutput(
        `Failed to execute streaming query: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "ERROR"
      );
      const message: ExecuteStreamingQueryErrorMessage = {
        type: "ext.streamingQueryError",
        payload: {
          queryId,
          tabId: "",
          query,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
      this.messageService.invoke(message);
      this.queryStateManager.errorQuery(queryId);
    }
  }
}
