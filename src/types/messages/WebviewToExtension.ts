import { AggregationResult } from "../Aggregation";
import {
  QueryRequest,
  SmartDrillTableRequest,
  FindTablesRequest,
  SmartDrillCellSelection,
} from "../QueryRequest";

// Base message interface
export interface WebviewMessage<T = unknown> {
  type: string;
  payload: T;
}

// Webview to Extension messages
export interface ExecuteStreamingQueryMessage
  extends WebviewMessage<QueryRequest> {
  type: "wv.executeStreamingQuery";
}

export interface FindMatchingTablesMessage
  extends WebviewMessage<FindTablesRequest> {
  type: "wv.findMatchingTables";
}

export interface GenerateSmartDrillQueryMessage
  extends WebviewMessage<{
    selectedTable: SmartDrillTableRequest;
    selectedCells: SmartDrillCellSelection[];
  }> {
  type: "wv.generateSmartDrillQuery";
}

export interface GetSchemaDataMessage extends WebviewMessage<void> {
  type: "wv.getSchemaData";
}

export interface DocumentContentChangedMessage
  extends WebviewMessage<{
    content: string;
    version: number;
    delta?: {
      from: number;
      to: number;
      insert: string;
    };
  }> {
  type: "wv.documentContentChanged";
}

export interface UpdateStatusBarAggregationMessage
  extends WebviewMessage<AggregationResult> {
  type: "wv.updateStatusBarAggregation";
}

export interface ClearStatusBarAggregationMessage extends WebviewMessage<void> {
  type: "wv.clearStatusBarAggregation";
}

export interface SetActiveTabMessage
  extends WebviewMessage<{
    activeTabId: string;
    previousTabId?: string;
  }> {
  type: "wv.setActiveTab";
}

export interface ExportDataMessage
  extends WebviewMessage<{
    data: unknown[][];
    schema: { name: string; type?: string }[];
    format: "csv" | "excel" | "data-wrangler";
    filename?: string;
    includeHeaders?: boolean;
  }> {
  type: "wv.exportData";
}

export type WebviewToExtensionMessage =
  | ExecuteStreamingQueryMessage
  | FindMatchingTablesMessage
  | GenerateSmartDrillQueryMessage
  | GetSchemaDataMessage
  | DocumentContentChangedMessage
  | UpdateStatusBarAggregationMessage
  | ClearStatusBarAggregationMessage
  | SetActiveTabMessage
  | ExportDataMessage;

export type WebviewToExtensionMessageTypeMap = {
  [K in WebviewToExtensionMessage["type"]]: Extract<
    WebviewToExtensionMessage,
    { type: K }
  >;
};
