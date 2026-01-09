using Microsoft.Data.SqlClient;

namespace SqlServerBridge;

public class ConnectionManager : IConnectionManager, IDisposable
{
    private readonly Dictionary<string, SqlConnection> connections = [];
    private readonly object @lock = new();

    public event EventHandler<string>? ConnectionStateChange;

    public async Task<SqlConnection> CreateConnection(string connectionName, CreateConnectionParams parameters)
    {
        if (string.IsNullOrWhiteSpace(connectionName))
        {
            throw new ArgumentException("Connection name cannot be null or empty", nameof(connectionName));
        }

        SqlConnection? connection = null;
        try
        {
            connection = await CreateOrGetConnection(connectionName, parameters);
            connection.StateChange += (sender, e) => OnConnectionStateChange(sender, connectionName);
            
            lock (@lock)
            {
                connections[connectionName] = connection;
            }
            
            return connection;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error creating connection: {ex.Message}");
            await CleanupFailedConnection(connection);
            throw;
        }
    }

    private void OnConnectionStateChange(object? sender, string connectionName)
    {
        lock (@lock)
        {
            if (sender is SqlConnection connection && 
                connection.State == System.Data.ConnectionState.Closed)
            {
                if (connections.TryGetValue(connectionName, out var currentConnection) && 
                    currentConnection == connection)
                {
                    connections.Remove(connectionName);
                }
            }
        }
        ConnectionStateChange?.Invoke(sender, connectionName);
    }

    private async Task<SqlConnection> CreateOrGetConnection(
        string connectionName, 
        CreateConnectionParams parameters)
    {
        lock (@lock)
        {
            if (connections.TryGetValue(connectionName, out SqlConnection? existing))
            {
                if (existing.State == System.Data.ConnectionState.Open)
                {
                    return existing;
                }
                connections.Remove(connectionName);
            }
        }

        var connectionString = BuildConnectionString(parameters);
        var connection = new SqlConnection(connectionString);

        if (parameters.Authentication == AuthenticationMethods.ActiveDirectoryInteractive && 
            parameters.AccessToken != null)
        {
            connection.AccessToken = parameters.AccessToken;
        }

        await connection.OpenAsync();
        return connection;
    }

    private async Task CleanupFailedConnection(SqlConnection? connection)
    {
        if (connection != null)
        {
            try
            {
                await connection.CloseAsync();
                await connection.DisposeAsync();
            }
            catch
            {
                // Ignore cleanup errors
            }
        }
    }

    public SqlConnection? GetConnection(string connectionName)
    {
        lock (@lock)
        {
            if (connections.TryGetValue(connectionName, out var connection))
            {
                if (connection.State == System.Data.ConnectionState.Open)
                {
                    return connection;
                }
                connections.Remove(connectionName);
            }
            return null;
        }
    }

    public async Task CloseConnection(string connectionName)
    {
        SqlConnection? connection;
        lock (@lock)
        {
            if (!connections.TryGetValue(connectionName, out connection))
            {
                return;
            }
            connections.Remove(connectionName);
        }

        if (connection != null)
        {
            await connection.CloseAsync();
            await connection.DisposeAsync();
        }
    }

    private string BuildConnectionString(CreateConnectionParams parameters)
    {
        SqlConnectionStringBuilder builder;
        
        if (parameters.ConnectionString != null)
        {
            builder = new SqlConnectionStringBuilder(parameters.ConnectionString);
        }
        else
        {
            builder = new SqlConnectionStringBuilder
            {
                DataSource = $"{parameters.Host},{parameters.Port}",
                InitialCatalog = parameters.Database ?? "master",
                ConnectTimeout = parameters.ConnectTimeout ?? BridgeConstants.DefaultConnectTimeout,
                CommandTimeout = parameters.CommandTimeout ?? BridgeConstants.DefaultCommandTimeout,
                Encrypt = parameters.Encrypt ?? false,
                TrustServerCertificate = parameters.TrustServerCertificate ?? true,
                ApplicationName = parameters.ApplicationName ?? BridgeConstants.DefaultApplicationName
            };

            if (parameters.Authentication == AuthenticationMethods.IntegratedSecurity ||
                (string.IsNullOrEmpty(parameters.Authentication) && string.IsNullOrEmpty(parameters.Username) && string.IsNullOrEmpty(parameters.Password)))
            {
                builder.IntegratedSecurity = true;
                if (!string.IsNullOrEmpty(parameters.ServerSPN))
                {
                    builder.ServerSPN = parameters.ServerSPN;
                }
            }
            else if (parameters.Authentication == AuthenticationMethods.ActiveDirectoryInteractive)
            {
                builder.Authentication = SqlAuthenticationMethod.ActiveDirectoryInteractive;
                if (!string.IsNullOrEmpty(parameters.ClientId))
                {
                    builder.UserID = parameters.ClientId;
                }
            }
            else
            {
                if (!string.IsNullOrEmpty(parameters.Username))
                {
                    builder.UserID = parameters.Username;
                }
                if (!string.IsNullOrEmpty(parameters.Password))
                {
                    builder.Password = parameters.Password;
                }
            }
        }

        builder.Pooling = false;
        // Enable MARS (Multiple Active Result Sets) to allow concurrent queries on the same connection
        // Without this, SQL Server throws "There is already an open DataReader" when multiple queries run simultaneously
        builder.MultipleActiveResultSets = true;

        return builder.ConnectionString;
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
        foreach (var connection in connections.Values)
        {
            connection.Close();
            connection.Dispose();
        }
        connections.Clear();
    }
}
