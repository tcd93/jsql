using System.Collections.Concurrent;
using Microsoft.Data.SqlClient;
using SqlServerBridge.Handlers;

namespace SqlServerBridge;

/// <summary>
/// Main service that orchestrates the bridge components
/// </summary>
public class BridgeService : IDisposable
{
    private readonly RequestProcessor processor;
    private readonly MessageWriter writer;
    private readonly ConnectionManager connectionManager;
    private readonly QueryExecutor queryExecutor;
    private readonly MessageRouter router;
    private readonly CancellationTokenSource cts;
    private readonly ConcurrentBag<Task> activeTasks = new();

    public BridgeService()
    {
        processor = new RequestProcessor();
        writer = new MessageWriter();
        connectionManager = CreateConnectionManager();
        queryExecutor = new QueryExecutor(connectionManager);
        router = CreateRouter();
        cts = new CancellationTokenSource();
        
        SetupCancellation();
    }

    private ConnectionManager CreateConnectionManager()
    {
        var manager = new ConnectionManager();
        manager.ConnectionStateChange += OnConnectionStateChange;
        return manager;
    }

    private void OnConnectionStateChange(object? sender, string connectionName)
    {
        if (sender is SqlConnection connection)
        {
            writer.WriteLog(LogLevel.Info, 
                $"Connection state changed to {connection.State} for connection {connectionName}");
        }
        else
        {
            writer.WriteLog(LogLevel.Warning, 
                $"ConnectionStateChange fired but sender is not a SqlConnection: {sender?.GetType().Name}");
        }
    }

    private MessageRouter CreateRouter()
    {
        var router = new MessageRouter();
        router.RegisterHandler(Method.CreateConnection, new CreateConnectionHandler(connectionManager));
        router.RegisterHandler(Method.ExecuteQuery, new ExecuteQueryHandler(queryExecutor));
        router.RegisterHandler(Method.ExecuteStreamingQuery, new ExecuteStreamingQueryHandler(queryExecutor));
        router.RegisterHandler(Method.CancelQuery, new CancelQueryHandler(queryExecutor));
        router.RegisterHandler(Method.CloseConnection, new CloseConnectionHandler(connectionManager));
        return router;
    }

    private void SetupCancellation()
    {
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            cts.Cancel();
        };
    }

    /// <summary>
    /// Runs the bridge service, processing requests until cancellation
    /// </summary>
    public async Task RunAsync()
    {
        try
        {
            // Process requests concurrently - each request runs in its own task
            // This allows multiple queries to execute simultaneously without blocking each other
            await foreach (var request in processor.GetRequests(cts.Token))
            {
                var startTime = DateTime.Now;
                writer.WriteLog(LogLevel.Info, $"[{request.Method}] Starting request {request.Id} at {startTime.ToString("HH:mm:ss.fff")}");
                var requestCopy = request;
                var task = Task.Run(async () =>
                {
                    try
                    {
                        await foreach (var message in router.RouteAsync(requestCopy))
                        {
                            writer.WriteMessage(message);
                        }
                    }
                    catch (Exception ex)
                    {
                        writer.WriteLog(LogLevel.Error, 
                            $"Error processing request {requestCopy.Id}: {ex.Message}");
                    }
                    finally
                    {
                        var endTime = DateTime.Now;
                        var duration = endTime - startTime;
                        writer.WriteLog(LogLevel.Info, $"[{requestCopy.Method}] Request {requestCopy.Id} completed at {endTime.ToString("HH:mm:ss.fff")} - {duration.TotalMilliseconds}ms");
                    }
                }, cts.Token);

                activeTasks.Add(task);
            }

            // Wait for all concurrent requests to complete
            await Task.WhenAll(activeTasks);
        }
        catch (OperationCanceledException)
        {
            writer.WriteLog(LogLevel.Info, "Request reading cancelled");
        }
        catch (Exception ex)
        {
            writer.WriteLog(LogLevel.Error, $"Fatal error while reading requests: {ex.Message}");
        }
    }

    public void Dispose()
    {
        // Cancel any pending operations
        if (!cts.Token.IsCancellationRequested)
        {
            cts.Cancel();
        }

        // Wait for all active request tasks to finish before disposing resources
        try
        {
            Task.WaitAll([.. activeTasks], TimeSpan.FromSeconds(5));
        }
        catch (Exception ex)
        {
            writer.WriteLog(LogLevel.Warning, $"Error waiting for active tasks: {ex.Message}");
        }

        try
        {
            queryExecutor?.Dispose();
        }
        catch (Exception ex)
        {
            writer.WriteLog(LogLevel.Error, $"Error disposing query executor: {ex.Message}");
        }

        try
        {
            connectionManager?.Dispose();
            writer.WriteLog(LogLevel.Info, "Disposed all connections");
        }
        catch (Exception ex)
        {
            writer.WriteLog(LogLevel.Error, $"Error disposing connection manager: {ex.Message}");
        }

        try
        {
            writer?.Dispose();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error disposing writer: {ex.Message}");
        }

        cts?.Dispose();
    }
}


