export type QueryStatus = "Idle" | "Executing" | "Completed" | "Error";

export type ConnectionStatus =
  | "Disconnected"
  | "Connected"
  | "Connecting"
  | "Error";

export enum DatabaseProvider {
  None = "None",
  SqlServer = "SqlServer",
  PostgreSQL = "PostgreSQL",
}

export type ConnectionProfile =
  | SqlServerConnectionProfile
  | PostgreSqlConnectionProfile
  | NoneConnectionProfile;

interface _ConnectionProfile {
  provider: DatabaseProvider;
  name: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
}

export interface NoneConnectionProfile extends _ConnectionProfile {
  provider: DatabaseProvider.None;
}

export interface SqlServerConnectionProfile extends _ConnectionProfile {
  provider: DatabaseProvider.SqlServer;
  /**
   * If provided, this connection string will be used directly instead of building one from the other parameters
   */
  connectionString?: string;
  /** Windows SPN for Kerberos authentication, might be required for Integrated auth - you can check SSMS > Management > SQL Server Logs > Current for the SPN server name */
  serverSPN?: string;

  // SQL Server specific connection options
  connectTimeout?: number;
  commandTimeout?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  pooling?: boolean;
  minPoolSize?: number;
  maxPoolSize?: number;
  /** Authentication method for SQL Server/Azure SQL */
  authentication?:
    | "Sql Password"
    | "Integrated Security"
    | "Active Directory Interactive";
  applicationName?: string;
  applicationIntent?: "ReadWrite" | "ReadOnly";

  /**
   * Tenant ID for Azure AD authentication
   * @todo VsCode extension does not currently return this value in connection string
   */
  tenantId?: string;
  /**
   * Client ID for Azure AD authentication
   * @todo VsCode extension does not currently return this value in connection string
   */
  clientId?: string;
  /** Access token for Azure AD authentication
   * @todo VsCode extension does not currently return this value in connection string
   */
  accessToken?: string;
}

export interface PostgreSqlConnectionProfile extends _ConnectionProfile {
  provider: DatabaseProvider.PostgreSQL;
  /**
   * If provided, this connection string will be used directly instead of building one from the other parameters
   */
  connectionString?: string;

  // PostgreSQL specific connection options
  connectTimeout?: number;
  commandTimeout?: number;
  /** Enable SSL/TLS connection */
  ssl?: boolean;
  /** Reject unauthorized SSL certificates (only applies if ssl is true) */
  rejectUnauthorized?: boolean;
  pooling?: boolean;
  minPoolSize?: number;
  maxPoolSize?: number;
  applicationName?: string;

  /** Keep alive settings */
  keepAlive?: boolean;
  keepAliveInitialDelayMillis?: number;

  /** Statement timeout in seconds (0 = no timeout) */
  statementTimeout?: number;

  /** Query timeout in milliseconds (0 = no timeout) */
  queryTimeout?: number;

  /** Idle timeout for connections in the pool */
  idleTimeoutMillis?: number;
}
