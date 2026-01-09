using Moq;
using Microsoft.Data.SqlClient;
using SqlServerBridge.Handlers;
using Xunit;

namespace SqlServerBridge.Tests;

public class CreateConnectionHandlerTests
{
    [Fact]
    public async Task HandleAsync_WithValidParams_CreatesConnectionSuccessfully()
    {
        var mockConnectionManager = new Mock<IConnectionManager>();
        // SqlConnection is sealed, so we create a real instance with a minimal connection string.
        // Using an invalid server name with very short timeout to avoid any network delays.
        // The handler doesn't use the returned connection, so this is safe for testing.
        var connection = new SqlConnection("Data Source=InvalidServerThatDoesNotExist;Initial Catalog=test;Connect Timeout=1;");
        mockConnectionManager.Setup(x => x.CreateConnection(It.IsAny<string>(), It.IsAny<CreateConnectionParams>()))
            .ReturnsAsync(connection);

        var handler = new CreateConnectionHandler(mockConnectionManager.Object);
        var param = new CreateConnectionParams
        {
            ConnectionName = "test-connection",
            Host = "localhost",
            Port = 1433,
            Database = "testdb"
        };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<CreateConnectionPayload>(results[0]);
        Assert.True(payload.Success);
        Assert.Null(payload.Error);
        mockConnectionManager.Verify(x => x.CreateConnection("test-connection", param), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WhenCreateConnectionThrowsException_ReturnsErrorPayload()
    {
        var mockConnectionManager = new Mock<IConnectionManager>();
        mockConnectionManager.Setup(x => x.CreateConnection(It.IsAny<string>(), It.IsAny<CreateConnectionParams>()))
            .ThrowsAsync(new Exception("Connection failed"));

        var handler = new CreateConnectionHandler(mockConnectionManager.Object);
        var param = new CreateConnectionParams
        {
            ConnectionName = "test-connection",
            Host = "localhost",
            Port = 1433
        };

        var results = new List<ReturnPayload>();
        await foreach (var result in handler.HandleAsync(param))
        {
            results.Add(result);
        }

        Assert.Single(results);
        var payload = Assert.IsType<CreateConnectionPayload>(results[0]);
        Assert.False(payload.Success);
        Assert.NotNull(payload.Error);
        Assert.Equal(BridgeErrorCode.CREATE_CONNECTION_ERROR.ToString(), payload.Error.Code);
        Assert.Equal("Connection failed", payload.Error.Message);
    }

    [Fact]
    public async Task HandleAsync_WithInvalidParamType_ThrowsInvalidOperationException()
    {
        var mockConnectionManager = new Mock<IConnectionManager>();
        var handler = new CreateConnectionHandler(mockConnectionManager.Object);
        var param = new CancelQueryParams { QueryId = "test-id" };

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await foreach (var _ in handler.HandleAsync(param)) { }
        });
    }
}

