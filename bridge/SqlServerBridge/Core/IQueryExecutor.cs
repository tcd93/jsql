namespace SqlServerBridge;

public interface IQueryExecutor
{
    Task<ExecuteQueryPayload> ExecuteQuery(string connectionName, string query);
    IAsyncEnumerable<ReturnPayload> ExecuteStreamingQuery(string connectionName, string query, string queryId);
    void CancelQuery(string queryId);
}

