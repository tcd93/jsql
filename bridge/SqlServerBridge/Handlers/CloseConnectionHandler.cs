using System.Runtime.CompilerServices;
using System.Text.Json;

namespace SqlServerBridge.Handlers;

public class CloseConnectionHandler(IConnectionManager connectionManager) : IRequestHandler
{
    public async IAsyncEnumerable<ReturnPayload> HandleAsync(BridgeCommandParams param)
    {
        if (param is not CloseConnectionParams closeParams)
        {
            throw new InvalidOperationException($"Invalid parameter type for CloseConnectionHandler: {param.GetType().Name}");
        }
        ReturnPayload? response;
        
        try
        {
            await connectionManager.CloseConnection(closeParams.ConnectionName);
            response = new CloseConnectionPayload { Success = true };
        }
        catch (Exception ex)
        {
            response = new CloseConnectionPayload
            {
                Success = false,
                Error = BridgeError.FromCode(BridgeErrorCode.CLOSE_CONNECTION_ERROR, ex.Message)
            };
        }
        
        if (response != null)
            yield return response;
    }
}

