using System.Runtime.CompilerServices;
using System.Text.Json;

namespace SqlServerBridge.Handlers;

public class CreateConnectionHandler(IConnectionManager connectionManager) : IRequestHandler
{
    public async IAsyncEnumerable<ReturnPayload> HandleAsync(BridgeCommandParams param)
    {
        if (param is not CreateConnectionParams createParams)
        {
            throw new InvalidOperationException($"Invalid parameter type for CreateConnectionHandler: {param.GetType().Name}");
        }

        CreateConnectionPayload? response;

        try
        {
            await connectionManager.CreateConnection(createParams.ConnectionName, createParams);
            response = new CreateConnectionPayload { Success = true };
        }
        catch (Exception ex)
        {
            response = new CreateConnectionPayload
            {
                Success = false,
                Error = BridgeError.FromCode(BridgeErrorCode.CREATE_CONNECTION_ERROR, ex.Message)
            };
        }

        if (response != null)
            yield return response;
    }
}

