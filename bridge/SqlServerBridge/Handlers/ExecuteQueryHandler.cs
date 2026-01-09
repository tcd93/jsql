using System.Runtime.CompilerServices;
using System.Text.Json;

namespace SqlServerBridge.Handlers;

public class ExecuteQueryHandler(IQueryExecutor queryExecutor) : IRequestHandler
{
    public async IAsyncEnumerable<ReturnPayload> HandleAsync(BridgeCommandParams param)
    {
        if (param is not ExecuteQueryParams queryParams)
        {
            throw new InvalidOperationException($"Invalid parameter type for ExecuteQueryHandler: {param.GetType().Name}");
        }

        var truncatedQuery = queryParams.Query.ReplaceLineEndings(" ");
        if (truncatedQuery.Length > 50)
        {
            truncatedQuery = truncatedQuery[..50] + "...";
        }
        
        yield return new LogPayload
        {
            Level = LogLevel.Info,
            Message = $"Executing query '{truncatedQuery}'"
        };

        ReturnPayload? response;
        try
        {
            response = await queryExecutor.ExecuteQuery(queryParams.ConnectionName, queryParams.Query);
        }
        catch (Exception ex)
        {
            response = new ReturnPayload
            {
                Error = BridgeError.FromCode(BridgeErrorCode.EXECUTE_QUERY_ERROR, ex.Message)
            };
        }
        
        if (response != null)
            yield return response;
    }
}

