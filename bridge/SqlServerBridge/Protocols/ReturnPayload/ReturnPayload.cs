namespace SqlServerBridge;

using System.Text.Json.Serialization;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "$type")]
[JsonDerivedType(typeof(CreateConnectionPayload), "createConnection")]
[JsonDerivedType(typeof(CloseConnectionPayload), "closeConnection")]
[JsonDerivedType(typeof(CancelQueryPayload), "cancelQuery")]
[JsonDerivedType(typeof(ExecuteQueryPayload), "executeQuery")]
[JsonDerivedType(typeof(ExecuteStreamingQueryPayload), "executeStreamingQuery")]
[JsonDerivedType(typeof(LogPayload), "log")]
public class ReturnPayload
{
    [JsonPropertyName("error")]
    public BridgeError? Error;
}

/// <summary>
/// Error returned from bridge operations
/// </summary>
public class BridgeError
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Creates a BridgeError from a BridgeErrorCode enum
    /// </summary>
    public static BridgeError FromCode(BridgeErrorCode code, string message)
    {
        return new BridgeError
        {
            Code = code.ToString(),
            Message = message
        };
    }
}