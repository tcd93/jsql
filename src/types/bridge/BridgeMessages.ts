export interface BridgeMessage {
  id: string;
  done: boolean;
  payload?: ReturnPayload;
}

export interface BridgeError {
  code: string;
  message: string;
}

export type ReturnPayload =
  | CreateConnectionPayload
  | ExecuteQueryPayload
  | ExecuteStreamingQueryPayload
  | CloseConnectionPayload
  | CancelQueryPayload
  | LogPayload;

export interface CreateConnectionPayload {
  $type: "createConnection";
  success: boolean;
  error?: BridgeError;
}

export interface ExecuteQueryPayload {
  $type: "executeQuery";
  schema: SchemaField[];
  data: QueryData;
  error?: BridgeError;
}

import { SchemaField } from "../schema";

export interface QueryData {
  rows: (unknown | null)[][];
  totalRowsSoFar: number;
}

export type StreamingEvent = "schema" | "data" | "complete" | "error" | "info";

export interface ExecuteStreamingQueryPayload {
  $type: "executeStreamingQuery";
  event: StreamingEvent;
  queryId: string;
  data: StreamingDataPayload;
  error?: BridgeError;
}

export type StreamingDataPayload =
  | StreamingError
  | StreamingSchema
  | StreamingRows
  | StreamingInfo
  | StreamingCompleteData;

export interface StreamingError {
  $type: "error";
  error: string;
}

export interface StreamingSchema {
  $type: "schema";
  schema: SchemaField[];
}

export interface StreamingRows {
  $type: "rows";
  rows: (unknown | null)[][];
  batchNumber: number;
  totalRowsSoFar: number;
}

export interface StreamingInfo {
  $type: "info";
  message: string;
}

export interface StreamingCompleteData {
  $type: "complete";
  totalRows: number;
  totalBatches: number;
  affectedRows: number[];
}

export interface CloseConnectionPayload {
  $type: "closeConnection";
  success: boolean;
  error?: BridgeError;
}

export interface CancelQueryPayload {
  $type: "cancelQuery";
  success: boolean;
  error?: BridgeError;
}

export type LogLevel = "Info" | "Error" | "Warning" | "Debug";

export interface LogPayload {
  $type: "log";
  level: LogLevel;
  message: string;
  error?: BridgeError;
}

export type StreamingMessage = ExecuteStreamingQueryPayload;

export function isLogPayload(payload: ReturnPayload | unknown): payload is LogPayload {
  return typeof payload === "object" && payload !== null && "$type" in payload && payload.$type === "log";
}
