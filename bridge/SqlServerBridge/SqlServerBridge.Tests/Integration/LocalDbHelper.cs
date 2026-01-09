using Microsoft.Data.SqlClient;

namespace SqlServerBridge.Tests.Integration;

public static class LocalDbHelper
{
    public static string GetLocalDbConnectionString(string? database = null)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = "(localdb)\\MSSQLLocalDB",
            IntegratedSecurity = true,
            TrustServerCertificate = true,
            Encrypt = false
        };

        if (!string.IsNullOrEmpty(database))
        {
            builder.InitialCatalog = database;
        }

        return builder.ConnectionString;
    }

    public static async Task<bool> IsLocalDbAvailableAsync()
    {
        try
        {
            using var connection = new SqlConnection(GetLocalDbConnectionString());
            await connection.OpenAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static async Task EnsureTestDatabaseAsync(string databaseName = "SqlServerBridgeTest")
    {
        var masterConnectionString = GetLocalDbConnectionString("master");
        
        using var connection = new SqlConnection(masterConnectionString);
        await connection.OpenAsync();

        var checkDbQuery = $@"
            IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '{databaseName}')
            BEGIN
                CREATE DATABASE [{databaseName}]
            END";

        using var command = new SqlCommand(checkDbQuery, connection);
        await command.ExecuteNonQueryAsync();
    }

    public static async Task CreateTestTableAsync(string connectionString, string tableName = "TestTable")
    {
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        var dropTableQuery = $@"
            IF OBJECT_ID('{tableName}', 'U') IS NOT NULL
                DROP TABLE [{tableName}]";

        using var dropCommand = new SqlCommand(dropTableQuery, connection);
        await dropCommand.ExecuteNonQueryAsync();

        var createTableQuery = $@"
            CREATE TABLE [{tableName}] (
                Id INT PRIMARY KEY IDENTITY(1,1),
                Name NVARCHAR(100) NOT NULL,
                Value INT NOT NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
            )";

        using var createCommand = new SqlCommand(createTableQuery, connection);
        await createCommand.ExecuteNonQueryAsync();

        var insertDataQuery = $@"
            INSERT INTO [{tableName}] (Name, Value) VALUES
                ('Item1', 10),
                ('Item2', 20),
                ('Item3', 30)";

        using var insertCommand = new SqlCommand(insertDataQuery, connection);
        await insertCommand.ExecuteNonQueryAsync();
    }

    public static async Task CleanupTestDatabaseAsync(string databaseName = "SqlServerBridgeTest")
    {
        try
        {
            var masterConnectionString = GetLocalDbConnectionString("master");
            
            using var connection = new SqlConnection(masterConnectionString);
            await connection.OpenAsync();

            var dropDbQuery = $@"
                IF EXISTS (SELECT name FROM sys.databases WHERE name = '{databaseName}')
                BEGIN
                    ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE
                    DROP DATABASE [{databaseName}]
                END";

            using var command = new SqlCommand(dropDbQuery, connection);
            await command.ExecuteNonQueryAsync();
        }
        catch
        {
        }
    }
}

