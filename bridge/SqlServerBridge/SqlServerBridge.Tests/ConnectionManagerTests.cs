using Microsoft.Data.SqlClient;
using Xunit;

namespace SqlServerBridge.Tests;

public class ConnectionManagerTests
{
    [Fact]
    public void BuildConnectionString_WithActiveDirectoryInteractive_EnablesMars()
    {
        var parameters = new CreateConnectionParams
        {
            Authentication = AuthenticationMethods.ActiveDirectoryInteractive,
            Host = "jsql-extension-test.database.windows.net",
            Database = "jsql",
            Port = 1433,
            ConnectTimeout = 30,
            CommandTimeout = 30,
            Encrypt = true,
            TrustServerCertificate = true,
            ApplicationName = "vscode-mssql",
            ApplicationIntent = "ReadWrite"
        };

        var result = ConnectionManager.BuildConnectionString(parameters);
        var builder = new SqlConnectionStringBuilder(result);

        Assert.Equal(
            SqlAuthenticationMethod.ActiveDirectoryInteractive,
            builder.Authentication
        );
        Assert.Equal(
            "jsql-extension-test.database.windows.net",
            builder.DataSource
        );
        Assert.Equal("jsql", builder.InitialCatalog);
        Assert.True(builder.Encrypt);
        Assert.False(builder.Pooling);
        Assert.True(builder.MultipleActiveResultSets);
        Assert.Empty(builder.UserID);
        Assert.Empty(builder.Password);
    }

    [Fact]
    public void BuildConnectionString_WithAccessToken_OmitsAuthenticationKeyword()
    {
        const string accessToken = "sql-resource-token";
        var parameters = new CreateConnectionParams
        {
            Authentication = AuthenticationMethods.ActiveDirectoryInteractive,
            AccessToken = accessToken,
            Host = "jsql-extension-test.database.windows.net",
            Database = "jsql",
            Port = 1433
        };

        var result = ConnectionManager.BuildConnectionString(parameters);
        var builder = new SqlConnectionStringBuilder(result);
        using var connection = new SqlConnection(result)
        {
            AccessToken = parameters.AccessToken
        };

        Assert.Equal(SqlAuthenticationMethod.NotSpecified, builder.Authentication);
        Assert.Empty(builder.UserID);
        Assert.Empty(builder.Password);
        Assert.Equal(accessToken, connection.AccessToken);
    }

    [Fact]
    public void BuildConnectionString_WithActiveDirectoryDefault_UsesDefaultAuthentication()
    {
        var parameters = new CreateConnectionParams
        {
            Authentication = AuthenticationMethods.ActiveDirectoryDefault,
            Host = "jsql-extension-test.database.windows.net",
            Port = 1433
        };

        var result = ConnectionManager.BuildConnectionString(parameters);
        var builder = new SqlConnectionStringBuilder(result);

        Assert.Equal(
            SqlAuthenticationMethod.ActiveDirectoryDefault,
            builder.Authentication
        );
    }

    [Fact]
    public void BuildConnectionString_WithSqlAuthentication_EnablesMars()
    {
        var parameters = new CreateConnectionParams
        {
            Host = "sql.example.com",
            Database = "app",
            Authentication = "Sql Password",
            Username = "app-user",
            Password = "secret"
        };

        var result = ConnectionManager.BuildConnectionString(parameters);
        var builder = new SqlConnectionStringBuilder(result);

        Assert.True(builder.MultipleActiveResultSets);
        Assert.Equal("app-user", builder.UserID);
        Assert.Equal("secret", builder.Password);
    }

    [Fact]
    public void BuildConnectionString_WithoutConnectionString_EnablesMars()
    {
        var parameters = new CreateConnectionParams
        {
            Host = "sql.example.com",
            Port = 1433,
            Authentication = AuthenticationMethods.ActiveDirectoryInteractive
        };

        var result = ConnectionManager.BuildConnectionString(parameters);
        var builder = new SqlConnectionStringBuilder(result);

        Assert.True(builder.MultipleActiveResultSets);
        Assert.Equal("sql.example.com", builder.DataSource);
        Assert.Equal(
            SqlAuthenticationMethod.ActiveDirectoryInteractive,
            builder.Authentication
        );
    }

    [Fact]
    public void BuildConnectionString_WithApplicationIntent_AppliesIt()
    {
        var parameters = new CreateConnectionParams
        {
            Host = "sql.example.com",
            Port = 1433,
            ApplicationIntent = "ReadOnly"
        };

        var result = ConnectionManager.BuildConnectionString(parameters);
        var builder = new SqlConnectionStringBuilder(result);

        Assert.Equal(ApplicationIntent.ReadOnly, builder.ApplicationIntent);
    }
}
