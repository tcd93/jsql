import * as vscode from "vscode";
import {
  getService,
  QueryHighlightService,
  QueryStateManager,
} from "../../services";

export interface SetActiveTabHandler {
  handleSetActiveTab(payload: {
    activeTabId: string;
    previousTabId?: string;
  }): Promise<void>;
}

export class SetActiveTabHandlerImpl implements SetActiveTabHandler {
  private readonly queryStateManager: QueryStateManager;
  private readonly queryHighlightService: QueryHighlightService;

  constructor(readonly context: vscode.ExtensionContext) {
    this.queryStateManager = getService(QueryStateManager);
    this.queryHighlightService = getService(QueryHighlightService);
  }

  async handleSetActiveTab(payload: {
    activeTabId: string;
    previousTabId?: string;
  }): Promise<void> {
    const { activeTabId } = payload;

    const queryState =
      this.queryStateManager.getQueryStateFromTabId(activeTabId);
    if (queryState?.documentUri) {
      const editor = await this.queryHighlightService.showDocument(
        queryState.documentUri
      );
      if (editor && queryState.selection) {
        this.queryHighlightService.highlightQuery(
          editor,
          queryState.selection,
          queryState.queryText
        );
      }
    }

    // Update the status bar to reflect the query state of the active tab
    this.queryStateManager.updateStatusBarForActiveTab(activeTabId);
  }
}
