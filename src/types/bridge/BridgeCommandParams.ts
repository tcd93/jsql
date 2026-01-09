import { SqlServerConnectionProfile } from "../ConnectionProfile";

/** Parameters for creating a connection in the bridge */
export interface CreateConnectionParams
  extends Omit<SqlServerConnectionProfile, "name" | "provider"> {
  connectionName: string;
}

/** Parameters for executing a query */
export interface ExecuteQueryParams {
  connectionName: string;
  query: string;
  queryId: string;
}

/** Parameters for executing a streaming query */
export interface ExecuteStreamingQueryParams {
  connectionName: string;
  query: string;
  queryId: string;
}

/** Parameters for canceling a query */
export interface CancelQueryParams {
  queryId: string;
}

/** Parameters for closing a connection */
export interface CloseConnectionParams {
  connectionName: string;
}
