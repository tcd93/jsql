/** Bridge method types matching the C# Method enum */
export enum BridgeMethod {
  CreateConnection = "createConnection",
  ExecuteQuery = "executeQuery",
  ExecuteStreamingQuery = "executeStreamingQuery",
  CancelQuery = "cancelQuery",
  CloseConnection = "closeConnection",
}

/** Request sent to the SQL Server bridge process */
export interface BridgeRequest {
  id: string;
  method: string | BridgeMethod;
  params?: unknown;
}
