import { WebviewMessage } from "./WebviewToExtension";

// package.json commands

export interface ChooseConnectionCommandMessage extends WebviewMessage<void> {
  type: "jSql.chooseConnection";
  payload: void;
}

export interface OpenEditorCommandMessage extends WebviewMessage<void> {
  type: "jSql.openEditor";
  payload: void;
}

export interface ExecuteQueryAtCursorCommandMessage
  extends WebviewMessage<void> {
  type: "jSql.executeQueryAtCursor";
  payload: void;
}

export interface ExecuteAllQueriesCommandMessage extends WebviewMessage<void> {
  type: "jSql.executeAllQueries";
  payload: void;
}

export interface CancelAllQueriesCommandMessage extends WebviewMessage<void> {
  type: "jSql.cancelAllQueries";
  payload: void;
}

export type ExtensionToExtensionMessage =
  | ChooseConnectionCommandMessage
  | OpenEditorCommandMessage
  | ExecuteQueryAtCursorCommandMessage
  | ExecuteAllQueriesCommandMessage
  | CancelAllQueriesCommandMessage;

export type ExtensionToExtensionMessageTypeMap = {
  [M in ExtensionToExtensionMessage as M["type"]]: M;
};
