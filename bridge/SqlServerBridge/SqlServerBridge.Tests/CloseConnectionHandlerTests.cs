using Moq;
using SqlServerBridge.Handlers;
using Xunit;

namespace SqlServerBridge.Tests;

public class CloseConnectionHandlerTests
{
    [Fact]
    public async Task HandleAsync_WithValidParams_ClosesConnectionSuccessfully()
    {
        var mockConnectionManager = new Mock<IConnectionManager>();
        mockConnectionManager.Setup(x => x.CloseConnection(It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        var handler = new CloseConnectionHandler(mockConnectionManager.Object);
        var param = new CloseConnectionParams { ConnectionName = "test-connection" };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<CloseConnectionPayload>(results[0]);
        Assert.True(payload.Success);
        Assert.Null(payload.Error);
        mockConnectionManager.Verify(x => x.CloseConnection("test-connection"), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenCloseConnectionThrowsException_ReturnsErrorPayload()
    {
        var mockConnectionManager = new Mock<IConnectionManager>();
        mockConnectionManager.Setup(x => x.CloseConnection(It.IsAny<string>()))
            .ThrowsAsync(new Exception("Close failed"));

        var handler = new CloseConnectionHandler(mockConnectionManager.Object);
        var param = new CloseConnectionParams { ConnectionName = "test-connection" };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<CloseConnectionPayload>(results[0]);
        Assert.False(payload.Success);
        Assert.NotNull(payload.Error);
        Assert.Equal(BridgeErrorCode.CLOSE_CONNECTION_ERROR.ToString(), payload.Error.Code);
        Assert.Equal("Close failed", payload.Error.Message);
    }

    [Fact]
    public async Task HandleAsync_WithInvalidParamType_ThrowsInvalidOperationException()
    {
        var mockConnectionManager = new Mock<IConnectionManager>();
        var handler = new CloseConnectionHandler(mockConnectionManager.Object);
        var param = new CancelQueryParams { QueryId = "test-id" };

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await foreach (var _ in handler.HandleAsync(param)) { }
        });
    }
}

