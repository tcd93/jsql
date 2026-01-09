import { SchemaField } from "./schema";

export interface StreamingDataResult {
  rows: unknown[][];
  batchNumber?: number;
  totalRowsSoFar: number;
}

export interface StreamingCompleteResult {
  totalRows: number;
  totalBatches: number;
  /** Rows affected for INSERT/UPDATE/DELETE queries */
  affectedRows?: number[];
}

export interface SyncQueryResult {
  schema: SchemaField[];
  data: StreamingDataResult;
}

export interface StreamingCallbacks {
  onSchema: (schema: SchemaField[]) => void;
  onData: (data: StreamingDataResult) => void;
  onComplete: (summary: StreamingCompleteResult) => void;
  onError: (error: string) => void;
  onInfo: (info: string) => void;
}
