namespace SqlServerBridge;

using System.Text.Json.Serialization;

/// <summary>
/// Response payload from bridge operations
/// </summary>
public class CreateConnectionPayload : ReturnPayload
{
    [JsonPropertyName("success")]
    public required Boolean Success;
}