namespace SqlServerBridge.Handlers;

public class CancelQueryHandler(IQueryExecutor queryExecutor) : IRequestHandler
{
    public async IAsyncEnumerable<ReturnPayload> HandleAsync(BridgeCommandParams param)
    {
        if (param is not CancelQueryParams cancelParams)
        {
            throw new InvalidOperationException($"Invalid parameter type for CancelQueryHandler: {param.GetType().Name}");
        }

        CancelQueryPayload? response;
        try
        {
            await Task.Run(() => queryExecutor.CancelQuery(cancelParams.QueryId));
            response = new CancelQueryPayload
            {
                Success = true
            };
        }
        catch (Exception ex)
        {
            response = new CancelQueryPayload
            {
                Success = false,
                Error = BridgeError.FromCode(BridgeErrorCode.CANCEL_QUERY_ERROR, ex.Message)
            };
        }

        if (response != null)
            yield return response;
    }
}

