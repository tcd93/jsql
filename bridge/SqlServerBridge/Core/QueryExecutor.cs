using System.Collections.Concurrent;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace SqlServerBridge;

public class QueryExecutor(IConnectionManager connectionManager) : IQueryExecutor, IDisposable
{
    // Track cancellation tokens for each query ID to support query cancellation
    private readonly ConcurrentDictionary<string, CancellationTokenSource> cancellationTokens = new();

    public async Task<ExecuteQueryPayload> ExecuteQuery(string connectionName, string query)
    {
        var connection = connectionManager.GetConnection(connectionName) ?? throw new InvalidOperationException($"Connection '{connectionName}' not found");
        var command = new SqlCommand(query, connection);
        return await ExecuteQuery(command);
    }

    public async IAsyncEnumerable<ReturnPayload> ExecuteStreamingQuery(
        string connectionName,
        string query,
        string queryId)
    {
        // Validate inputs
        var validationError = ValidateInputs(connectionName, query, queryId);
        if (validationError != null)
        {
            yield return CreateErrorPayload(queryId, validationError);
            yield break;
        }

        var connection = connectionManager.GetConnection(connectionName);
        if (connection == null)
        {
            yield return CreateErrorPayload(queryId, $"Connection '{connectionName}' not found");
            yield break;
        }

        var command = new SqlCommand(query, connection);
        CancellationTokenSource? cancellationTokenSource = null;

        try
        {
            cancellationTokenSource = RegisterCancellation(queryId, command);
            await foreach (var message in ExecuteStreamingQuery(command, queryId, cancellationTokenSource.Token))
            {
                yield return message;
            }
        }
        finally
        {
            UnregisterCancellation(queryId, cancellationTokenSource);
        }
    }

    private string? ValidateInputs(string connectionName, string query, string queryId)
    {
        if (string.IsNullOrWhiteSpace(connectionName))
            return "Connection name cannot be null or empty";
        if (string.IsNullOrWhiteSpace(query))
            return "Query cannot be null or empty";
        if (string.IsNullOrWhiteSpace(queryId))
            return "Query ID cannot be null or empty";
        return null;
    }

    private ExecuteStreamingQueryPayload CreateErrorPayload(string queryId, string error)
    {
        return new ExecuteStreamingQueryPayload
        {
            Event = StreamingEvent.Error,
            QueryId = queryId,
            Data = new StreamingError { Error = error }
        };
    }

    private CancellationTokenSource RegisterCancellation(string queryId, SqlCommand command)
    {
        var cancellationTokenSource = new CancellationTokenSource();
        
        // If a cancellation token already exists for this query ID, cancel and dispose it first
        if (!cancellationTokens.TryAdd(queryId, cancellationTokenSource))
        {
            if (cancellationTokens.TryGetValue(queryId, out var existingCts))
            {
                existingCts.Cancel();
                existingCts.Dispose();
            }
            cancellationTokens.TryRemove(queryId, out _);
            cancellationTokens.TryAdd(queryId, cancellationTokenSource);
        }

        cancellationTokenSource.Token.Register(command.Cancel);
        return cancellationTokenSource;
    }

    private void UnregisterCancellation(string queryId, CancellationTokenSource? cancellationTokenSource)
    {
        if (cancellationTokenSource != null)
        {
            cancellationTokens.TryRemove(queryId, out _);
            cancellationTokenSource.Dispose();
        }
    }

    /// <summary>
    /// Cancels a running query by its query ID
    /// </summary>
    public void CancelQuery(string queryId)
    {
        if (string.IsNullOrWhiteSpace(queryId))
        {
            return;
        }

        if (cancellationTokens.TryGetValue(queryId, out var cts))
        {
            cts.Cancel();
        }
    }

    private async Task<ExecuteQueryPayload> ExecuteQuery(SqlCommand command)
    {
        using var reader = await command.ExecuteReaderAsync();
        var schema = ExtractSchema(reader);
        var rows = new List<List<object?>>();

        do
        {
            while (await reader.ReadAsync())
            {
                var row = new List<object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    row.Add(value);
                }
                rows.Add(row);
            }
        } while (await reader.NextResultAsync());

        return new ExecuteQueryPayload
        {
            Schema = schema,
            Data = new QueryData
            {
                Rows = rows,
                TotalRowsSoFar = rows.Count
            }
        };
    }

    private async IAsyncEnumerable<ExecuteStreamingQueryPayload> ExecuteStreamingQuery(
        SqlCommand command,
        string queryId,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var connection = command.Connection;
        var infoMessages = new ConcurrentQueue<string>();

        void OnInfoMessage(object sender, SqlInfoMessageEventArgs e)
        {
            infoMessages.Enqueue(e.Message);
        }

        connection.InfoMessage += OnInfoMessage;

        try
        {
            using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var totalRows = 0;
            var batchNumber = -1;
            var affectedRows = new List<int>();

            do
            {
                batchNumber++;
                var schema = ExtractSchema(reader);

                if (schema.Count > 0)
                {
                    yield return new ExecuteStreamingQueryPayload
                    {
                        Event = StreamingEvent.Schema,
                        QueryId = queryId,
                        Data = new StreamingSchema { Schema = schema }
                    };
                }

                var batchRows = new List<List<object?>>();
                while (await reader.ReadAsync(cancellationToken))
                {
                    var row = new List<object?>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        row.Add(value);
                    }
                    batchRows.Add(row);
                    totalRows++;
                    // Send rows in batches to avoid overwhelming the client with too much data at once
                    if (batchRows.Count >= BridgeConstants.StreamingBatchSize)
                    {
                        yield return new ExecuteStreamingQueryPayload
                        {
                            Event = StreamingEvent.Data,
                            QueryId = queryId,
                            Data = new StreamingRows
                            {
                                Rows = [.. batchRows.Select(r => r.ToArray())],
                                BatchNumber = batchNumber,
                                TotalRowsSoFar = totalRows
                            }
                        };
                        batchRows.Clear();

                        foreach (var infoMessage in DequeueInfoMessages(infoMessages, queryId))
                        {
                            yield return infoMessage;
                        }
                    }
                }

                if (batchRows.Count > 0)
                {
                    yield return new ExecuteStreamingQueryPayload
                    {
                        Event = StreamingEvent.Data,
                        QueryId = queryId,
                        Data = new StreamingRows
                        {
                            Rows = [.. batchRows.Select(r => r.ToArray())],
                            BatchNumber = batchNumber,
                            TotalRowsSoFar = totalRows
                        }
                    };
                    batchRows.Clear();
                }
                affectedRows.Add(reader.RecordsAffected);
            } while (await reader.NextResultAsync(cancellationToken));

            foreach (var infoMessage in DequeueInfoMessages(infoMessages, queryId))
            {
                yield return infoMessage;
            }

            yield return new ExecuteStreamingQueryPayload
            {
                Event = StreamingEvent.Complete,
                QueryId = queryId,
                Data = new StreamingCompleteData
                {
                    TotalRows = totalRows,
                    TotalBatches = batchNumber + 1,
                    AffectedRows = [.. affectedRows]
                }
            };
        }
        finally
        {
            connection.InfoMessage -= OnInfoMessage;
        }
    }

    private IEnumerable<ExecuteStreamingQueryPayload> DequeueInfoMessages(
        ConcurrentQueue<string> infoMessages, string queryId)
    {
        while (infoMessages.TryDequeue(out var infoMsg))
        {
            yield return new ExecuteStreamingQueryPayload
            {
                Event = StreamingEvent.Info,
                QueryId = queryId,
                Data = new StreamingInfo { Message = infoMsg }
            };
        }
    }

    private List<SchemaField> ExtractSchema(SqlDataReader reader)
    {
        var schema = new List<SchemaField>();
        for (int i = 0; i < reader.FieldCount; i++)
        {
            var fieldName = reader.GetName(i);
            var fieldType = reader.GetFieldType(i)?.Name ?? "unknown";
            schema.Add(new SchemaField
            {
                Name = string.IsNullOrEmpty(fieldName) ? i.ToString() : fieldName,
                Type = MapSqlTypeToTypeScriptType(fieldType)
            });
        }
        return schema;
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
        foreach (var cts in cancellationTokens.Values)
        {
            cts.Dispose();
        }
        cancellationTokens.Clear();
    }

    private static string MapSqlTypeToTypeScriptType(string sqlType)
    {
        return sqlType.ToLower() switch
        {
            "int32" or "int" => "Int",
            "int64" or "bigint" => "BigInt",
            "decimal" or "money" or "smallmoney" => "Decimal",
            "float" or "double" => "Float",
            "boolean" or "bit" => "Bit",
            "string" or "varchar" or "nvarchar" or "char" or "nchar" or "text" or "ntext" => "VarChar",
            "datetime" or "datetime2" or "smalldatetime" => "DateTime",
            "date" => "Date",
            "time" => "Time",
            "datetimeoffset" => "DateTimeOffset",
            "uniqueidentifier" => "UniqueIdentifier",
            "binary" or "varbinary" or "image" => "VarBinary",
            _ => sqlType
        };
    }
}

