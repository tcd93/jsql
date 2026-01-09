using Microsoft.Data.SqlClient;

namespace SqlServerBridge;

public interface IConnectionManager
{
    Task<SqlConnection> CreateConnection(string connectionName, CreateConnectionParams parameters);
    SqlConnection? GetConnection(string connectionName);
    Task CloseConnection(string connectionName);
}

