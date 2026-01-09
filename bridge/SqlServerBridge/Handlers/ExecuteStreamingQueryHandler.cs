using System.Text;
using Microsoft.Data.SqlClient;

namespace SqlServerBridge.Handlers;

public class ExecuteStreamingQueryHandler(IQueryExecutor queryExecutor) : IRequestHandler
{
    public async IAsyncEnumerable<ReturnPayload> HandleAsync(BridgeCommandParams param)
    {
        if (param is not ExecuteStreamingQueryParams queryParams)
        {
            throw new InvalidOperationException($"Invalid parameter type for ExecuteStreamingQueryHandler: {param.GetType().Name}");
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

        var stream = queryExecutor.ExecuteStreamingQuery(
            queryParams.ConnectionName,
            queryParams.Query,
            queryParams.QueryId);

        await foreach (var payload in HandleStream(stream, queryParams.QueryId))
        {
            yield return payload;
        }

    }

    private static async IAsyncEnumerable<ReturnPayload> HandleStream(
        IAsyncEnumerable<ReturnPayload> stream,
        string queryId)
    {
        var enumerator = stream.GetAsyncEnumerator();
        ReturnPayload? errorPayload = null;
        var hasError = false;

        try
        {
            while (true)
            {
                bool hasMore;
                try
                {
                    hasMore = await enumerator.MoveNextAsync();
                }
                catch (Exception ex)
                {
                    errorPayload = ConvertExceptionToPayload(ex, queryId);
                    hasError = true;
                    break;
                }

                if (!hasMore)
                {
                    break;
                }

                yield return enumerator.Current;
            }
        }
        finally
        {
            await enumerator.DisposeAsync();
        }

        if (hasError && errorPayload != null)
        {
            yield return errorPayload;
        }
    }

    private static ExecuteStreamingQueryPayload ConvertExceptionToPayload(Exception ex, string queryId)
    {
        return ex switch
        {
            OperationCanceledException => new ExecuteStreamingQueryPayload
            {
                Event = StreamingEvent.Info,
                QueryId = queryId,
                Data = new StreamingInfo { Message = "Query cancelled" }
            },
            SqlException sqlEx => CreateSqlErrorPayload(sqlEx, queryId),
            _ => new ExecuteStreamingQueryPayload
            {
                Event = StreamingEvent.Error,
                QueryId = queryId,
                Data = new StreamingError { Error = $"Internal error: {ex.Message}" }
            }
        };
    }

    private static ExecuteStreamingQueryPayload CreateSqlErrorPayload(SqlException sqlEx, string queryId)
    {
        var errorMessage = new StringBuilder();
        foreach (SqlError error in sqlEx.Errors)
        {
            errorMessage.Append($"Error {error.Number}: {error.Message} ");
            errorMessage.Append($"(Line {error.LineNumber}, ");
            if (!string.IsNullOrEmpty(error.Procedure))
            {
                errorMessage.Append($"Procedure: {error.Procedure}, ");
            }
            errorMessage.Append($"State: {error.State}, Severity: {error.Class})");
            errorMessage.AppendLine();
        }
        
        return new ExecuteStreamingQueryPayload
        {
            Event = StreamingEvent.Error,
            QueryId = queryId,
            Data = new StreamingError { Error = errorMessage.ToString() }
        };
    }
}

