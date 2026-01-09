using System.Diagnostics;
using System.Text.Json;
using SqlServerBridge;
using Xunit;
using Xunit.Abstractions;

namespace SqlServerBridge.Tests.Integration;

public class BridgeIntegrationTests : IClassFixture<LocalDbFixture>, IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly BridgeProcessHelper _bridge;
    private readonly LocalDbFixture _fixture;

    public BridgeIntegrationTests(ITestOutputHelper output, LocalDbFixture fixture)
    {
        _output = output;
        _fixture = fixture;
        var sw = Stopwatch.StartNew();
        _bridge = new BridgeProcessHelper();
        Thread.Sleep(300);
        sw.Stop();
        _output.WriteLine($"[TIMING] BridgeProcessHelper initialization: {sw.ElapsedMilliseconds}ms");
    }

    [Fact]
    public async Task CreateConnection_WithValidLocalDb_WritesSuccessToStdout()
    {
        var sw = Stopwatch.StartNew();
        var requestId = Guid.NewGuid().ToString();
        var connectionName = "test-conn-1";
        var connectionString = LocalDbHelper.GetLocalDbConnectionString();
        sw.Stop();
        _output.WriteLine($"[TIMING] Setup: {sw.ElapsedMilliseconds}ms");

        var request = new BridgeRequest
        {
            Id = requestId,
            Method = Method.CreateConnection,
            Params = new CreateConnectionParams
            {
                ConnectionName = connectionName,
                ConnectionString = connectionString
            }
        };

        sw.Restart();
        var requestJson = await _bridge.SendRequestAsync(request);
        _output.WriteLine($"Sent request: {requestJson}");
        await Task.Delay(1000);
        sw.Stop();
        _output.WriteLine($"[TIMING] SendRequest + Delay(1000ms): {sw.ElapsedMilliseconds}ms");

        sw.Restart();
        var messages = await _bridge.ReadMessagesAsync(requestId, expectedCount: 2, timeoutMs: 10000);
        sw.Stop();
        _output.WriteLine($"[TIMING] ReadMessagesAsync (timeout 10s): {sw.ElapsedMilliseconds}ms");

        if (messages.Count == 0)
        {
            var allMessages = _bridge.GetAllMessages();
            var stdout = string.Join("\n", _bridge.GetStdoutLines());
            var stderr = _bridge.GetStderr();
            _output.WriteLine($"No messages found for requestId: {requestId}");
            _output.WriteLine($"All messages ({allMessages.Count}): {string.Join("\n", allMessages.Select(m => $"Id={m.Id}, Done={m.Done}, Payload={JsonSerializer.Serialize(m.Payload)}"))}");
            _output.WriteLine($"Stdout: {stdout}");
            _output.WriteLine($"Stderr: {stderr}");
        }

        Assert.True(messages.Count >= 1, $"Expected at least 1 message, got {messages.Count}. Stdout: {string.Join("\n", _bridge.GetStdoutLines())}");

        var payloadMessage = messages.FirstOrDefault(m => m.Payload != null);
        Assert.NotNull(payloadMessage);
        Assert.Equal(requestId, payloadMessage.Id);
        Assert.False(payloadMessage.Done);

        var payload = JsonSerializer.Deserialize<CreateConnectionPayload>(
            JsonSerializer.Serialize(payloadMessage.Payload, MessageWriter.JsonOptions),
            MessageWriter.JsonOptions);

        Assert.NotNull(payload);
        Assert.True(payload.Success);
        Assert.Null(payload.Error);

        var doneMessage = messages.FirstOrDefault(m => m.Done && m.Payload == null);
        Assert.NotNull(doneMessage);
        Assert.Equal(requestId, doneMessage.Id);
        Assert.True(doneMessage.Done);
    }

    [Fact]
    public async Task CreateConnection_WithInvalidConnectionString_WritesErrorToStdout()
    {
        var sw = Stopwatch.StartNew();
        var requestId = Guid.NewGuid().ToString();
        var connectionName = "test-conn-invalid";

        var request = new BridgeRequest
        {
            Id = requestId,
            Method = Method.CreateConnection,
            Params = new CreateConnectionParams
            {
                ConnectionName = connectionName,
                // Use Connect Timeout=3 to make invalid connections fail faster (default is 180s)
                ConnectionString = "Server=InvalidServer;Database=InvalidDb;User Id=InvalidUser;Password=InvalidPass;Connect Timeout=3;"
            }
        };

        await _bridge.SendRequestAsync(request);
        await Task.Delay(500);
        sw.Stop();
        _output.WriteLine($"[TIMING] SendRequest + Delay(500ms): {sw.ElapsedMilliseconds}ms");

        sw.Restart();
        // Timeout set to 8s to allow for connection timeout (3s) + processing time
        var messages = await _bridge.ReadMessagesAsync(requestId, expectedCount: 2, timeoutMs: 8000);
        sw.Stop();
        _output.WriteLine($"[TIMING] ReadMessagesAsync (timeout 5s): {sw.ElapsedMilliseconds}ms");

        if (messages.Count == 0)
        {
            var allMessages = _bridge.GetAllMessages();
            var stdout = string.Join("\n", _bridge.GetStdoutLines());
            _output.WriteLine($"No messages found for requestId: {requestId}");
            _output.WriteLine($"All messages ({allMessages.Count}): {string.Join("\n", allMessages.Select(m => $"Id={m.Id}, Done={m.Done}"))}");
            _output.WriteLine($"Stdout: {stdout}");
        }

        Assert.True(messages.Count >= 1, $"Expected at least 1 message, got {messages.Count}. Stdout: {string.Join("\n", _bridge.GetStdoutLines())}");

        var payloadMessage = messages.FirstOrDefault(m => m.Payload != null);
        Assert.NotNull(payloadMessage);

        var payload = JsonSerializer.Deserialize<CreateConnectionPayload>(
            JsonSerializer.Serialize(payloadMessage.Payload, MessageWriter.JsonOptions),
            MessageWriter.JsonOptions);

        Assert.NotNull(payload);
        Assert.False(payload.Success);
        Assert.NotNull(payload.Error);
        Assert.Equal("CREATE_CONNECTION_ERROR", payload.Error.Code);
        Assert.NotEmpty(payload.Error.Message);
    }

    [Fact]
    public async Task ExecuteQuery_WithValidConnection_ReturnsQueryResults()
    {
        var connectionName = "test-conn-query";
        var connectionString = LocalDbHelper.GetLocalDbConnectionString(_fixture.DatabaseName);

        var createRequest = new BridgeRequest
        {
            Id = Guid.NewGuid().ToString(),
            Method = Method.CreateConnection,
            Params = new CreateConnectionParams
            {
                ConnectionName = connectionName,
                ConnectionString = connectionString
            }
        };

        await _bridge.SendRequestAsync(createRequest);
        await Task.Delay(500);

        var queryRequestId = Guid.NewGuid().ToString();
        var queryRequest = new BridgeRequest
        {
            Id = queryRequestId,
            Method = Method.ExecuteQuery,
            Params = new ExecuteQueryParams
            {
                ConnectionName = connectionName,
                Query = "SELECT Id, Name, Value FROM TestTable ORDER BY Id",
                QueryId = Guid.NewGuid().ToString()
            }
        };

        await _bridge.SendRequestAsync(queryRequest);

        var messages = await _bridge.ReadMessagesAsync(queryRequestId, expectedCount: 2, timeoutMs: 10000);

        Assert.True(messages.Count >= 1);

        var payloadMessage = messages.FirstOrDefault(m => m.Payload != null);
        Assert.NotNull(payloadMessage);

        var payloadJson = JsonSerializer.Serialize(payloadMessage.Payload, MessageWriter.JsonOptions);
        var payload = JsonSerializer.Deserialize<ExecuteQueryPayload>(payloadJson, MessageWriter.JsonOptions);

        Assert.NotNull(payload);
        Assert.Null(payload.Error);
        Assert.NotNull(payload.Schema);
        Assert.Equal(3, payload.Schema.Count);
        Assert.Equal("Id", payload.Schema[0].Name);
        Assert.Equal("Name", payload.Schema[1].Name);
        Assert.Equal("Value", payload.Schema[2].Name);

        Assert.NotNull(payload.Data);
        Assert.Equal(3, payload.Data.Rows.Count);
        Assert.Equal(3, payload.Data.TotalRowsSoFar);

        var firstRow = payload.Data.Rows[0];
        Assert.Equal(3, firstRow.Count);
        
        var firstValue = firstRow[0];
        var firstLong = firstValue switch
        {
            long l => l,
            int i => (long)i,
            JsonElement je when je.ValueKind == JsonValueKind.Number => je.GetInt64(),
            _ => Convert.ToInt64(firstValue)
        };
        Assert.Equal(1L, firstLong);
        
        Assert.Equal("Item1", firstRow[1]?.ToString());
        
        var thirdValue = firstRow[2];
        var thirdLong = thirdValue switch
        {
            long l => l,
            int i => (long)i,
            JsonElement je when je.ValueKind == JsonValueKind.Number => je.GetInt64(),
            _ => Convert.ToInt64(thirdValue)
        };
        Assert.Equal(10L, thirdLong);
    }

    [Fact]
    public async Task ExecuteStreamingQuery_WithValidConnection_StreamsResults()
    {
        var sw = Stopwatch.StartNew();
        var connectionName = "test-conn-streaming";
        var connectionString = LocalDbHelper.GetLocalDbConnectionString(_fixture.DatabaseName);

        var createRequest = new BridgeRequest
        {
            Id = Guid.NewGuid().ToString(),
            Method = Method.CreateConnection,
            Params = new CreateConnectionParams
            {
                ConnectionName = connectionName,
                ConnectionString = connectionString
            }
        };

        await _bridge.SendRequestAsync(createRequest);
        await Task.Delay(500);
        sw.Stop();
        _output.WriteLine($"[TIMING] CreateConnection + Delay(500ms): {sw.ElapsedMilliseconds}ms");

        sw.Restart();
        var queryRequestId = Guid.NewGuid().ToString();
        var queryId = Guid.NewGuid().ToString();
        var queryRequest = new BridgeRequest
        {
            Id = queryRequestId,
            Method = Method.ExecuteStreamingQuery,
            Params = new ExecuteStreamingQueryParams
            {
                ConnectionName = connectionName,
                Query = "SELECT Id, Name, Value FROM TestTable ORDER BY Id",
                QueryId = queryId
            }
        };

        await _bridge.SendRequestAsync(queryRequest);
        sw.Stop();
        _output.WriteLine($"[TIMING] SendStreamingQueryRequest: {sw.ElapsedMilliseconds}ms");

        sw.Restart();
        var messages = await _bridge.ReadMessagesAsync(queryRequestId, expectedCount: 10, timeoutMs: 10000);
        sw.Stop();
        _output.WriteLine($"[TIMING] ReadMessagesAsync (timeout 15s): {sw.ElapsedMilliseconds}ms");

        Assert.True(messages.Count >= 3, $"Expected at least 3 messages, got {messages.Count}");

        var payloadTypes = messages
            .Where(m => m.Payload != null)
            .Select(m => m.Payload!.GetType().Name)
            .ToList();
        _output.WriteLine($"Payload types received: {string.Join(", ", payloadTypes)}");

        var streamingPayloads = messages
            .Where(m => m.Payload != null && m.Payload is ExecuteStreamingQueryPayload)
            .Select(m => m.Payload as ExecuteStreamingQueryPayload)
            .ToList();
        _output.WriteLine($"ExecuteStreamingQueryPayload messages: {streamingPayloads.Count}");
        
        var events = streamingPayloads
            .Where(p => p != null)
            .Select(p => p!.Event.ToString())
            .ToList();
        _output.WriteLine($"Events received: {string.Join(", ", events)}");

        var schemaMessages = streamingPayloads
            .Where(p => p != null && p.Event == StreamingEvent.Schema)
            .ToList();
        Assert.True(schemaMessages.Count >= 1, $"Expected at least 1 schema message, got {schemaMessages.Count}");

        var dataMessages = streamingPayloads
            .Where(p => p != null && p.Event == StreamingEvent.Data)
            .ToList();
        Assert.True(dataMessages.Count >= 1, $"Expected at least 1 data message, got {dataMessages.Count}");
        
        var dataMessage = dataMessages.First();
        Assert.NotNull(dataMessage?.Data);
        Assert.True(dataMessage.Data is StreamingRows);
        var rows = (StreamingRows)dataMessage.Data;
        Assert.True(rows.Rows.Length >= 3, $"Expected at least 3 rows in data message, got {rows.Rows.Length}");

        var completeMessages = streamingPayloads
            .Where(p => p != null && p.Event == StreamingEvent.Complete)
            .ToList();
        Assert.True(completeMessages.Count >= 1, $"Expected at least 1 complete message, got {completeMessages.Count}");

        var doneMessage = messages.FirstOrDefault(m => m.Done && m.Payload == null);
        Assert.NotNull(doneMessage);
        Assert.Equal(queryRequestId, doneMessage.Id);
        Assert.True(doneMessage.Done);
    }

    [Fact]
    public async Task CloseConnection_WithValidConnection_ClosesSuccessfully()
    {
        var connectionName = "test-conn-close";
        var connectionString = LocalDbHelper.GetLocalDbConnectionString(_fixture.DatabaseName);

        var createRequest = new BridgeRequest
        {
            Id = Guid.NewGuid().ToString(),
            Method = Method.CreateConnection,
            Params = new CreateConnectionParams
            {
                ConnectionName = connectionName,
                ConnectionString = connectionString
            }
        };

        await _bridge.SendRequestAsync(createRequest);
        await Task.Delay(500);

        var closeRequestId = Guid.NewGuid().ToString();
        var closeRequest = new BridgeRequest
        {
            Id = closeRequestId,
            Method = Method.CloseConnection,
            Params = new CloseConnectionParams
            {
                ConnectionName = connectionName
            }
        };

        await _bridge.SendRequestAsync(closeRequest);

        var messages = await _bridge.ReadMessagesAsync(closeRequestId, expectedCount: 2, timeoutMs: 10000);

        Assert.True(messages.Count >= 1);

        var payloadMessage = messages.FirstOrDefault(m => m.Payload != null);
        Assert.NotNull(payloadMessage);

        var payload = JsonSerializer.Deserialize<CloseConnectionPayload>(
            JsonSerializer.Serialize(payloadMessage.Payload, MessageWriter.JsonOptions),
            MessageWriter.JsonOptions);

        Assert.NotNull(payload);
        Assert.True(payload.Success);
        Assert.Null(payload.Error);
    }

    [Fact]
    public async Task MultipleRequests_ProcessedInOrder()
    {
        var connectionName = "test-conn-multi";
        var connectionString = LocalDbHelper.GetLocalDbConnectionString(_fixture.DatabaseName);

        var request1Id = Guid.NewGuid().ToString();
        var request1 = new BridgeRequest
        {
            Id = request1Id,
            Method = Method.CreateConnection,
            Params = new CreateConnectionParams
            {
                ConnectionName = connectionName,
                ConnectionString = connectionString
            }
        };

        var request2Id = Guid.NewGuid().ToString();
        var request2 = new BridgeRequest
        {
            Id = request2Id,
            Method = Method.ExecuteQuery,
            Params = new ExecuteQueryParams
            {
                ConnectionName = connectionName,
                Query = "SELECT 1 AS TestValue",
                QueryId = Guid.NewGuid().ToString()
            }
        };

        await _bridge.SendRequestAsync(request1);
        await Task.Delay(300);
        await _bridge.SendRequestAsync(request2);

        var messages1 = await _bridge.ReadMessagesAsync(request1Id, expectedCount: 2, timeoutMs: 5000);
        var messages2 = await _bridge.ReadMessagesAsync(request2Id, expectedCount: 2, timeoutMs: 5000);

        Assert.True(messages1.Count >= 1);
        Assert.True(messages2.Count >= 1);

        var payload1 = JsonSerializer.Deserialize<CreateConnectionPayload>(
            JsonSerializer.Serialize(messages1.First(m => m.Payload != null).Payload, MessageWriter.JsonOptions),
            MessageWriter.JsonOptions);
        Assert.True(payload1!.Success);

        var payload2 = JsonSerializer.Deserialize<ExecuteQueryPayload>(
            JsonSerializer.Serialize(messages2.First(m => m.Payload != null).Payload, MessageWriter.JsonOptions),
            MessageWriter.JsonOptions);
        Assert.Null(payload2!.Error);
    }

    public void Dispose()
    {
        _bridge?.Dispose();
    }
}

