using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SqlServerBridge;

public enum Method
{
    [JsonPropertyName("createConnection")]
    CreateConnection,

    [JsonPropertyName("executeQuery")]
    ExecuteQuery,

    [JsonPropertyName("executeStreamingQuery")]
    ExecuteStreamingQuery,

    [JsonPropertyName("cancelQuery")]
    CancelQuery,

    [JsonPropertyName("closeConnection")]
    CloseConnection
}


/// <summary>
/// Request sent to the SQL Server bridge process
/// </summary>
[JsonConverter(typeof(BridgeRequestConverter))]
public class BridgeRequest
{
    public required string Id;
    public required Method Method;
    public required BridgeCommandParams Params;
}

public class BridgeRequestConverter : JsonConverter<BridgeRequest>
{
    public override BridgeRequest? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        var id = root.GetProperty("id").GetString();
        var methodStr = root.GetProperty("method").GetString();
        var paramsElement = root.GetProperty("params");

        if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(methodStr))
            throw new JsonException("Invalid request: id and method are required");

        if (!Enum.TryParse<Method>(methodStr, true, out var method))
            throw new JsonException($"Unknown method: {methodStr}");

        BridgeCommandParams? @params = method switch
        {
            Method.CreateConnection => JsonSerializer.Deserialize<CreateConnectionParams>(paramsElement.GetRawText(), options),
            Method.ExecuteQuery => JsonSerializer.Deserialize<ExecuteQueryParams>(paramsElement.GetRawText(), options),
            Method.ExecuteStreamingQuery => JsonSerializer.Deserialize<ExecuteStreamingQueryParams>(paramsElement.GetRawText(), options),
            Method.CancelQuery => JsonSerializer.Deserialize<CancelQueryParams>(paramsElement.GetRawText(), options),
            Method.CloseConnection => JsonSerializer.Deserialize<CloseConnectionParams>(paramsElement.GetRawText(), options),
            _ => throw new JsonException($"Unknown method: {method}")
        };

        return new BridgeRequest
        {
            Id = id,
            Method = method,
            Params = @params ?? throw new JsonException("Failed to deserialize params")
        };
    }

    public override void Write(Utf8JsonWriter writer, BridgeRequest value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("id", value.Id);
        
        var methodName = value.Method switch
        {
            Method.CreateConnection => "createConnection",
            Method.ExecuteQuery => "executeQuery",
            Method.ExecuteStreamingQuery => "executeStreamingQuery",
            Method.CancelQuery => "cancelQuery",
            Method.CloseConnection => "closeConnection",
            _ => value.Method.ToString()
        };
        writer.WriteString("method", methodName);
        
        writer.WritePropertyName("params");
        JsonSerializer.Serialize(writer, value.Params, value.Params.GetType(), options);
        writer.WriteEndObject();
    }
}