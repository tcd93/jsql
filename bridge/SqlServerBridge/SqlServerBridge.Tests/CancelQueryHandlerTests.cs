using Moq;
using SqlServerBridge.Handlers;
using Xunit;

namespace SqlServerBridge.Tests;

public class CancelQueryHandlerTests
{
    [Fact]
    public async Task HandleAsync_WithValidParams_CancelsQuerySuccessfully()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        var handler = new CancelQueryHandler(mockQueryExecutor.Object);
        var param = new CancelQueryParams { QueryId = "test-query-id" };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<CancelQueryPayload>(results[0]);
        Assert.True(payload.Success);
        Assert.Null(payload.Error);
        mockQueryExecutor.Verify(x => x.CancelQuery("test-query-id"), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenCancelThrowsException_ReturnsErrorPayload()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        mockQueryExecutor.Setup(x => x.CancelQuery(It.IsAny<string>()))
            .Throws(new Exception("Cancel failed"));

        var handler = new CancelQueryHandler(mockQueryExecutor.Object);
        var param = new CancelQueryParams { QueryId = "test-query-id" };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<CancelQueryPayload>(results[0]);
        Assert.False(payload.Success);
        Assert.NotNull(payload.Error);
        Assert.Equal(BridgeErrorCode.CANCEL_QUERY_ERROR.ToString(), payload.Error.Code);
        Assert.Equal("Cancel failed", payload.Error.Message);
    }

    [Fact]
    public async Task HandleAsync_WithInvalidParamType_ThrowsInvalidOperationException()
    {
        var mockQueryExecutor = new Mock<IQueryExecutor>();
        var handler = new CancelQueryHandler(mockQueryExecutor.Object);
        var param = new CreateConnectionParams { ConnectionName = "test" };

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await foreach (var _ in handler.HandleAsync(param)) { }
        });
    }
}

