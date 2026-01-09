using System.Diagnostics;
using Xunit;

namespace SqlServerBridge.Tests.Integration;

public class LocalDbFixture : IAsyncLifetime
{
    public string DatabaseName { get; private set; } = "SqlServerBridgeTest";

    public async Task InitializeAsync()
    {
        var sw = Stopwatch.StartNew();
        
        if (!await LocalDbHelper.IsLocalDbAvailableAsync())
        {
            throw new InvalidOperationException(
                "SQL Server LocalDB is not available. " +
                "Please install SQL Server Express LocalDB or SQL Server Developer Edition.");
        }
        sw.Stop();
        Console.WriteLine($"[TIMING] LocalDbFixture - IsLocalDbAvailableAsync: {sw.ElapsedMilliseconds}ms");

        sw.Restart();
        await LocalDbHelper.EnsureTestDatabaseAsync(DatabaseName);
        sw.Stop();
        Console.WriteLine($"[TIMING] LocalDbFixture - EnsureTestDatabaseAsync: {sw.ElapsedMilliseconds}ms");
        
        sw.Restart();
        var connectionString = LocalDbHelper.GetLocalDbConnectionString(DatabaseName);
        await LocalDbHelper.CreateTestTableAsync(connectionString);
        sw.Stop();
        Console.WriteLine($"[TIMING] LocalDbFixture - CreateTestTableAsync: {sw.ElapsedMilliseconds}ms");
        Console.WriteLine($"[TIMING] LocalDbFixture - Total InitializeAsync: {sw.ElapsedMilliseconds}ms");
    }

    public async Task DisposeAsync()
    {
        var sw = Stopwatch.StartNew();
        await LocalDbHelper.CleanupTestDatabaseAsync(DatabaseName);
        sw.Stop();
        Console.WriteLine($"[TIMING] LocalDbFixture - CleanupTestDatabaseAsync: {sw.ElapsedMilliseconds}ms");
    }
}

