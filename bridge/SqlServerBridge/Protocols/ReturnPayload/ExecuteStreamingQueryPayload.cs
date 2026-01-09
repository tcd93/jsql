
namespace SqlServerBridge;

using System.Text.Json.Serialization;

public enum StreamingEvent
{
    [JsonPropertyName("schema")]
    Schema,
    [JsonPropertyName("data")]
    Data,
    [JsonPropertyName("complete")]
    Complete,
    [JsonPropertyName("error")]
    Error,
    [JsonPropertyName("info")]
    Info
}

/// <summary>
/// Streaming event payload from query execution
/// </summary>
public class ExecuteStreamingQueryPayload : ReturnPayload
{
    [JsonPropertyName("event")]
    public required StreamingEvent Event;

    [JsonPropertyName("queryId")]
    public required string QueryId;

    [JsonPropertyName("data")]
    public required StreamingDataPayload Data;
}

// Streaming data types

[JsonPolymorphic(TypeDiscriminatorPropertyName = "$type")]
[JsonDerivedType(typeof(StreamingError), "error")]
[JsonDerivedType(typeof(StreamingSchema), "schema")]
[JsonDerivedType(typeof(StreamingRows), "rows")]
[JsonDerivedType(typeof(StreamingInfo), "info")]
[JsonDerivedType(typeof(StreamingCompleteData), "complete")]
public abstract class StreamingDataPayload { }

public class StreamingError : StreamingDataPayload
{
    [JsonPropertyName("error")]
    public required string Error;
}

public class StreamingSchema : StreamingDataPayload
{
    [JsonPropertyName("schema")]
    public required List<SchemaField> Schema;
}

public class StreamingRows : StreamingDataPayload
{
    [JsonPropertyName("rows")]
    public required object?[][] Rows;

    [JsonPropertyName("batchNumber")]
    public required int BatchNumber;

    [JsonPropertyName("totalRowsSoFar")]
    public required int TotalRowsSoFar;
}

public class StreamingInfo : StreamingDataPayload
{
    [JsonPropertyName("message")]
    public required string Message;
}

public class StreamingCompleteData : StreamingDataPayload
{
    [JsonPropertyName("totalRows")]
    public required int TotalRows;

    [JsonPropertyName("totalBatches")]
    public required int TotalBatches;

    [JsonPropertyName("affectedRows")]
    public required int[] AffectedRows;
}