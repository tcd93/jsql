import * as vscode from "vscode";
import { ConnectionProfile } from "../types";
import { getService, QueryHighlightService, StatusBarService } from "./index";

export interface QueryState {
  queryId: string;
  queryText: string;
  documentUri?: vscode.Uri;
  selection?: vscode.Selection;
  tabIds: string[];
  /** Optional abort function to cancel the query */
  abort?: CallableFunction;
  startTime: Date;
  endTime?: Date;
  /** Duration in milliseconds */
  duration?: number;
  /** Total rows returned for SELECT queries */
  totalRows?: number;
  /** Rows affected for INSERT/UPDATE/DELETE queries - raw array from SQL Server */
  affectedRows?: number[];
  status: "running" | "completed" | "cancelled" | "error";
  error?: string;
  /** Connection profile used for this query */
  connectionProfile?: ConnectionProfile;
}

export class QueryStateManager extends vscode.Disposable {
  private readonly statusBarService: StatusBarService;
  private readonly queryHighlightService: QueryHighlightService;

  public readonly queryStates = new Map<string, QueryState>();
  private readonly onStateChangeEmitter = new vscode.EventEmitter<QueryState>();

  public readonly onStateChange = this.onStateChangeEmitter.event;

  constructor() {
    super(() => this.dispose());

    this.statusBarService = getService(StatusBarService);
    this.queryHighlightService = getService(QueryHighlightService);

    // Listen for state changes to update status bar and context
    this.onStateChange((queryState) => {
      this.updateStatusBar(queryState);

      switch (queryState.status) {
        case "completed":
        case "error":
        case "cancelled":
          vscode.commands.executeCommand(
            "setContext",
            "jSqlQueryRunning",
            false
          );
          break;
        case "running":
          vscode.commands.executeCommand(
            "setContext",
            "jSqlQueryRunning",
            true
          );
          break;
      }
    });
  }

  public dispose(): void {
    this.queryStates.clear();
    this.onStateChangeEmitter.dispose();
  }

  /**
   * Start tracking a new query, including its abort function and initial state.
   */
  public async startQuery(
    queryId: string,
    queryText: string,
    document?: vscode.TextDocument,
    selection?: vscode.Selection,
    abort?: CallableFunction,
    connectionProfile?: ConnectionProfile
  ): Promise<void> {
    if (this.queryStates.has(queryId)) {
      throw new Error(`Query ${queryId} is already running`);
    }

    const queryState: QueryState = {
      queryId,
      queryText,
      selection,
      documentUri: document?.uri,
      tabIds: [],
      abort,
      startTime: new Date(),
      status: "running",
      connectionProfile,
    };

    this.queryStates.set(queryId, queryState);
    this.onStateChangeEmitter.fire(queryState);

    if (document && selection) {
      const editor = await this.queryHighlightService.showDocument(
        document.uri
      );
      if (editor) {
        this.queryHighlightService.highlightQuery(editor, selection, queryText);
      }
    }

    return;
  }

  public updateTabId(queryId: string, tabId: string): boolean {
    const queryState = this.queryStates.get(queryId);

    if (!queryState) {
      return false;
    }

    // Add tabId to the array if not already present
    if (!queryState.tabIds.includes(tabId)) {
      queryState.tabIds.push(tabId);
    }

    return true;
  }

  private finalizeQueryState(
    queryState: QueryState,
    status: "completed" | "cancelled" | "error"
  ): void {
    queryState.endTime = new Date();
    queryState.duration =
      queryState.endTime.getTime() - queryState.startTime.getTime();
    queryState.status = status;
  }

  /**
   * Cancel a running query
   */
  public cancelQuery(queryId: string): QueryState | undefined {
    const queryState = this.queryStates.get(queryId);

    if (!queryState) {
      return;
    }

    // Prevent cancelling already finished queries
    if (queryState.status !== "running") {
      return queryState;
    }

    // Check if abort function exists
    if (!queryState.abort) {
      console.warn(
        `[QueryStateManager] No abort function for query ${queryId}`
      );
      this.finalizeQueryState(queryState, "cancelled");
      this.onStateChangeEmitter.fire(queryState);
      return queryState;
    }

    // Call the abort function with timeout protection
    const abortPromise = queryState.abort();

    if (!abortPromise || typeof abortPromise.then !== "function") {
      console.error(
        `[QueryStateManager] Abort function did not return a promise for query ${queryId}`
      );
      this.finalizeQueryState(queryState, "error");
      queryState.error = "Abort function did not return a promise";
      this.onStateChangeEmitter.fire(queryState);
      return queryState;
    }

    // Add timeout to prevent hanging forever if bridge response is lost
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "Cancellation request timed out - bridge may not be responding"
          )
        );
      }, 5000);
    });

    Promise.race([abortPromise, timeoutPromise])
      .then(() => {
        console.debug(`[QueryStateManager] Query ${queryId} cancelled`);
        this.finalizeQueryState(queryState, "cancelled");
      })
      .catch((error) => {
        console.error(
          `[QueryStateManager] Error calling abort for query ${queryId}:`,
          error
        );
        queryState.error =
          error instanceof Error ? error.message : String(error);
        this.finalizeQueryState(queryState, "error");
      })
      .finally(() => {
        this.onStateChangeEmitter.fire(queryState);
      });

    return queryState;
  }

  public cancelAllQueries(): QueryState[] {
    return Array.from(this.queryStates.keys())
      .map((queryId) => this.cancelQuery(queryId))
      .filter((state) => state !== undefined);
  }

  /**
   * Mark query as completed
   */
  public completeQuery(
    queryId: string,
    metrics?: { totalRows?: number; affectedRows?: number[] }
  ): boolean {
    const queryState = this.queryStates.get(queryId);

    if (!queryState) {
      return false;
    }

    this.finalizeQueryState(queryState, "completed");

    // Store row metrics if provided
    if (metrics) {
      queryState.totalRows = metrics.totalRows;
      queryState.affectedRows = metrics.affectedRows;
    }

    this.onStateChangeEmitter.fire(queryState);

    return true;
  }

  /**
   * Mark query as errored
   */
  public errorQuery(queryId: string): boolean {
    const queryState = this.queryStates.get(queryId);

    if (!queryState) {
      return false;
    }

    this.finalizeQueryState(queryState, "error");
    this.onStateChangeEmitter.fire(queryState);

    return true;
  }

  private updateStatusBar(queryState: QueryState | undefined): void {
    if (!queryState) {
      this.statusBarService.displayQueryStatus("Idle");
      return;
    }

    // Display the appropriate status based on query state
    switch (queryState.status) {
      case "running":
        this.statusBarService.displayQueryStatus("Executing", {
          startTime: queryState.startTime,
          tabCount: queryState.tabIds.length,
        });
        break;
      case "completed":
        this.statusBarService.displayQueryStatus("Completed", {
          duration: queryState.duration,
          totalRows: queryState.totalRows,
          affectedRows: queryState.affectedRows,
          tabCount: queryState.tabIds.length,
        });
        break;
      case "error":
        this.statusBarService.displayQueryStatus("Error", {
          duration: queryState.duration,
          tabCount: queryState.tabIds.length,
        });
        break;
      case "cancelled":
        this.statusBarService.displayQueryStatus("Idle");
        break;
      default:
        this.statusBarService.displayQueryStatus("Idle");
        break;
    }
  }

  /**
   * Update status bar to show the query state for the active tab
   */
  public updateStatusBarForActiveTab(activeTabId: string): void {
    // Find the query state that contains this tab
    const queryState = Array.from(this.queryStates.values()).find((state) =>
      state.tabIds.includes(activeTabId)
    );
    this.updateStatusBar(queryState);
  }

  public getQueryStateFromTabId(tabId: string): QueryState | undefined {
    return Array.from(this.queryStates.values()).find((state) =>
      state.tabIds.includes(tabId)
    );
  }
}
