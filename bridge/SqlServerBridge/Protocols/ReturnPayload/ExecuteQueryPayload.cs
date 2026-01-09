namespace SqlServerBridge;

using System.Text.Json.Serialization;

/// <summary>
/// Log message payload from bridge process
/// </summary>
public class ExecuteQueryPayload : ReturnPayload
{
    [JsonPropertyName("schema")]
    public required List<SchemaField> Schema;

    [JsonPropertyName("data")]
    public required QueryData Data;
}

public class QueryData
{
    [JsonPropertyName("rows")]
    public required List<List<object?>> Rows;

    [JsonPropertyName("totalRowsSoFar")]
    public required int TotalRowsSoFar;
}

public class SchemaField
{
    [JsonPropertyName("name")]
    public required string Name;

    [JsonPropertyName("type")]
    public required string Type;
}