using System.Text.Json;
using System.Text.Json.Serialization;

namespace SqlServerBridge;

/// <summary>
/// Base message structure received from the bridge
/// </summary>
public class BridgeMessage
{
    /// <summary>
    ///  The id of the request this payload is associated with
    /// </summary>
    [JsonPropertyName("id")]
    public required string Id;

    [JsonPropertyName("done")]
    public required Boolean Done;

    [JsonPropertyName("payload")]
    public ReturnPayload? Payload;
}


