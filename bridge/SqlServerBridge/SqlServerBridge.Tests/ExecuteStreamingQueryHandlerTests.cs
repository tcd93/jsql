using Moq;
using SqlServerBridge.Handlers;
using Xunit;

namespace SqlServerBridge.Tests;

public class ExecuteStreamingQueryHandlerTests
{
    [Fact]
    public async Task HandleAsync_WithValidParams_StreamsQueryResults()
    {
        var streamingPayloads = new List<ExecuteStreamingQueryPayload>
        {
            new() {
                Event = StreamingEvent.Schema,
                QueryId = "test-query-id",
                Data = new StreamingSchema
                {
                    Schema =
                    [
                        new() { Name = "Id", Type = "Int" },
                        new() { Name = "Name", Type = "VarChar" }
                    ]
                }
            },
            new() {
                Event = StreamingEvent.Data,
                QueryId = "test-query-id",
                Data = new StreamingRows
                {
                    Rows = [[1, "Test"]],
                    BatchNumber = 0,
                    TotalRowsSoFar = 1
                }
            },
            new() {
                Event = StreamingEvent.Complete,
                QueryId = "test-query-id",
                Data = new StreamingCompleteData
                {
                    TotalRows = 1,
                    TotalBatches = 1,
                    AffectedRows = []
                }
            }
        };

        var mockQueryExecutor = new Mock<IQueryExecutor>();
        mockQueryExecutor.Setup(x => x.ExecuteStreamingQuery(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>()))
            .Returns(ToAsyncEnumerable(streamingPayloads));

        var handler = new ExecuteStreamingQueryHandler(mockQueryExecutor.Object);
        var param = new ExecuteStreamingQueryParams
        {
            ConnectionName = "test-connection",
            Query = "SELECT * FROM Test",
            QueryId = "test-query-id"
        };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Equal(3, results.Count);
        Assert.All(results, r => Assert.IsType<ExecuteStreamingQueryPayload>(r));
        
        var schemaPayload = Assert.IsType<ExecuteStreamingQueryPayload>(results[0]);
        Assert.Equal(StreamingEvent.Schema, schemaPayload.Event);
        
        var dataPayload = Assert.IsType<ExecuteStreamingQueryPayload>(results[1]);
        Assert.Equal(StreamingEvent.Data, dataPayload.Event);
        
        var completePayload = Assert.IsType<ExecuteStreamingQueryPayload>(results[2]);
        Assert.Equal(StreamingEvent.Complete, completePayload.Event);

        mockQueryExecutor.Verify(x => x.ExecuteStreamingQuery(
            "test-connection",
            "SELECT * FROM Test",
            "test-query-id"), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenStreamThrowsOperationCanceledException_ReturnsInfoPayload()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        mockQueryExecutor.Setup(x => x.ExecuteStreamingQuery(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>()))
            .Returns(ThrowAsyncEnumerable<ExecuteStreamingQueryPayload>(new OperationCanceledException("Query cancelled")));

        var handler = new ExecuteStreamingQueryHandler(mockQueryExecutor.Object);
        var param = new ExecuteStreamingQueryParams
        {
            ConnectionName = "test-connection",
            Query = "SELECT * FROM Test",
            QueryId = "test-query-id"
        };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<ExecuteStreamingQueryPayload>(results[0]);
        Assert.Equal(StreamingEvent.Info, payload.Event);
        Assert.Equal("test-query-id", payload.QueryId);
        var infoData = Assert.IsType<StreamingInfo>(payload.Data);
        Assert.Equal("Query cancelled", infoData.Message);
    }

    [Fact]
    public async Task HandleAsync_WhenStreamThrowsGenericException_ReturnsErrorPayload()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        mockQueryExecutor.Setup(x => x.ExecuteStreamingQuery(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>()))
            .Returns(ThrowAsyncEnumerable<ExecuteStreamingQueryPayload>(new Exception("Internal error")));

        var handler = new ExecuteStreamingQueryHandler(mockQueryExecutor.Object);
        var param = new ExecuteStreamingQueryParams
        {
            ConnectionName = "test-connection",
            Query = "SELECT * FROM Test",
            QueryId = "test-query-id"
        };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<ExecuteStreamingQueryPayload>(results[0]);
        Assert.Equal(StreamingEvent.Error, payload.Event);
        Assert.Equal("test-query-id", payload.QueryId);
        var errorData = Assert.IsType<StreamingError>(payload.Data);
        Assert.Contains("Internal error: Internal error", errorData.Error);
    }

    [Fact]
    public async Task HandleAsync_WithInvalidParamType_ThrowsInvalidOperationException()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        var handler = new ExecuteStreamingQueryHandler(mockQueryExecutor.Object);
        var param = new CancelQueryParams { QueryId = "test-id" };

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await foreach (var _ in handler.HandleAsync(param)) { }
        });
    }

    private static async IAsyncEnumerable<T> ToAsyncEnumerable<T>(IEnumerable<T> items)
    {
        await Task.CompletedTask;
        foreach (var item in items)
        {
            yield return item;
        }
    }

    private static async IAsyncEnumerable<T> ThrowAsyncEnumerable<T>(Exception exception)
    {
        await Task.Yield();
        throw exception;
        // yield break is required by C# compiler for async iterator methods,
        // even though it's unreachable due to the throw above
#pragma warning disable CS0162 // Unreachable code detected
        yield break;
#pragma warning restore CS0162 // Unreachable code detected
    }
}

