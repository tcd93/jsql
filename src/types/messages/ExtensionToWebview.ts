import {
  ConnectionProfile,
  ConnectionStatus,
} from "../ConnectionProfile";
import { SmartDrillTableRequest } from "../QueryRequest";
import { StreamingCompleteResult, StreamingDataResult } from "../QueryResults";
import { SchemaData, SchemaField } from "../schema";
import { WebviewMessage } from "./WebviewToExtension";

//#region SmartDrill Messages
export interface SmartDrillTablesFoundMessage
  extends WebviewMessage<{
    tables: SmartDrillTableRequest[];
  }> {
  type: "ext.smartDrillTablesFound";
}

export interface SmartDrillQueryGeneratedMessage
  extends WebviewMessage<{
    query: string;
  }> {
  type: "ext.smartDrillQueryGenerated";
}

export interface SmartDrillErrorMessage
  extends WebviewMessage<{
    error: string;
  }> {
  type: "ext.smartDrillError";
}
//#endregion

//#region Schema Messages
export interface SchemaDataFoundMessage
  extends WebviewMessage<{
    schemaData: SchemaData;
  }> {
  type: "ext.schemaDataFound";
}

export interface SchemaDataErrorMessage
  extends WebviewMessage<{
    error: string;
    profile?: ConnectionProfile;
  }> {
  type: "ext.schemaDataError";
}

/**
 * For setting up autocompletion and update status bar
 */
export interface ConnectionChangedMessage
  extends WebviewMessage<{
    profile: ConnectionProfile;
    status: ConnectionStatus;
  }> {
  type: "ext.connectionChanged";
}
//#endregion

//#region Focus Messages
export interface EditorFocusChangedMessage extends WebviewMessage<void> {
  type: "ext.editorFocusChanged";
}
//#endregion

//#region VSCode extension buttons
export interface ExecuteQueryMessage extends WebviewMessage<void> {
  type: "ext.executeAllQuery";
}

//#endregion

//#region Query Streaming Messages
export interface ExecuteStreamingQueryDataMessage
  extends WebviewMessage<{
    queryId: string;
    tabId: string;
    data: StreamingDataResult;
  }> {
  type: "ext.streamingQueryData";
}

export interface ExecuteStreamingQuerySchemaMessage
  extends WebviewMessage<{
    queryId: string;
    tabId: string;
    query: string;
    schema: SchemaField[];
  }> {
  type: "ext.streamingQuerySchema";
}

export interface ExecuteStreamingQueryCompleteMessage
  extends WebviewMessage<{
    query: string;
    queryId: string;
    tabId: string;
    summary: StreamingCompleteResult;
  }> {
  type: "ext.streamingQueryComplete";
}

export interface ExecuteStreamingQueryErrorMessage
  extends WebviewMessage<{
    queryId: string;
    tabId: string;
    query: string;
    error: string;
  }> {
  type: "ext.streamingQueryError";
}

export interface ExecuteStreamingQueryInfoMessage
  extends WebviewMessage<{
    queryId: string;
    tabId: string;
    info: string;
  }> {
  type: "ext.streamingQueryInfo";
}
//#endregion

//#region Document Sync Messages
export interface DocumentSyncStatusMessage
  extends WebviewMessage<{
    synced: boolean;
    error?: string;
  }> {
  type: "ext.documentSyncStatus";
}

/// Document content from extension to webview, usually sent on first load
export interface DocumentContentMessage
  extends WebviewMessage<{
    content: string;
    version: number;
  }> {
  type: "ext.documentContent";
}

export interface DocumentDiagnosticsMessage
  extends WebviewMessage<{
    diagnostics: {
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      severity: 1 | 2 | 3 | 4; // Error=1, Warning=2, Information=3, Hint=4
      message: string;
      source?: string;
      code?: string | number;
    }[];
  }> {
  type: "ext.documentDiagnostics";
}
//#endregion

//#region Export Messages
export interface ExportDataSuccessMessage
  extends WebviewMessage<{
    filepath: string;
    format: string;
  }> {
  type: "ext.exportDataSuccess";
}

export interface ExportDataErrorMessage
  extends WebviewMessage<{
    error: string;
  }> {
  type: "ext.exportDataError";
}
//#endregion

export type ExtensionToWebviewMessage =
  | SmartDrillTablesFoundMessage
  | SmartDrillQueryGeneratedMessage
  | SmartDrillErrorMessage
  | ExecuteQueryMessage
  | ExecuteStreamingQueryDataMessage
  | ExecuteStreamingQuerySchemaMessage
  | ExecuteStreamingQueryCompleteMessage
  | ExecuteStreamingQueryErrorMessage
  | ExecuteStreamingQueryInfoMessage
  | SchemaDataFoundMessage
  | SchemaDataErrorMessage
  | ConnectionChangedMessage
  | DocumentContentMessage
  | DocumentSyncStatusMessage
  | DocumentDiagnosticsMessage
  | EditorFocusChangedMessage
  | ExportDataSuccessMessage
  | ExportDataErrorMessage;

export type ExtensionToWebviewMessageTypeMap = {
  [M in ExtensionToWebviewMessage as M["type"]]: M;
};
