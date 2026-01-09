using Moq;
using SqlServerBridge.Handlers;
using Xunit;

namespace SqlServerBridge.Tests;

public class ExecuteQueryHandlerTests
{
    [Fact]
    public async Task HandleAsync_WithValidParams_ExecutesQuerySuccessfully()
    {
        var expectedPayload = new ExecuteQueryPayload
        {
            Schema =
            [
                new() { Name = "Id", Type = "Int" },
                new() { Name = "Name", Type = "VarChar" }
            ],
            Data = new QueryData
            {
                Rows =
                [
                    new() { 1, "Test" }
                ],
                TotalRowsSoFar = 1
            }
        };

        var mockQueryExecutor = new Mock<IQueryExecutor>();
        mockQueryExecutor.Setup(x => x.ExecuteQuery(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(expectedPayload);

        var handler = new ExecuteQueryHandler(mockQueryExecutor.Object);
        var param = new ExecuteQueryParams
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
        var payload = Assert.IsType<ExecuteQueryPayload>(results[0]);
        Assert.Equal(expectedPayload.Schema, payload.Schema);
        Assert.Equal(expectedPayload.Data.Rows, payload.Data.Rows);
        Assert.Equal(expectedPayload.Data.TotalRowsSoFar, payload.Data.TotalRowsSoFar);
        Assert.Null(payload.Error);
        mockQueryExecutor.Verify(x => x.ExecuteQuery("test-connection", "SELECT * FROM Test"), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenExecuteQueryThrowsException_ReturnsErrorPayload()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        mockQueryExecutor.Setup(x => x.ExecuteQuery(It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new Exception("Query execution failed"));

        var handler = new ExecuteQueryHandler(mockQueryExecutor.Object);
        var param = new ExecuteQueryParams
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
        var payload = Assert.IsType<ReturnPayload>(results[0]);
        Assert.NotNull(payload.Error);
        Assert.Equal(BridgeErrorCode.EXECUTE_QUERY_ERROR.ToString(), payload.Error.Code);
        Assert.Equal("Query execution failed", payload.Error.Message);
    }

    [Fact]
    public async Task HandleAsync_WithInvalidParamType_ThrowsInvalidOperationException()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        var handler = new ExecuteQueryHandler(mockQueryExecutor.Object);
        var param = new CancelQueryParams { QueryId = "test-id" };

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await foreach (var _ in handler.HandleAsync(param)) { }
        });
    }
}

