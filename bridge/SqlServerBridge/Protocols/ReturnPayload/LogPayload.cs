namespace SqlServerBridge;

using System.Text.Json.Serialization;

public enum LogLevel
{
    Info,
    Error,
    Warning,
    Debug
}

/// <summary>
/// Log message payload from bridge process
/// </summary>
public class LogPayload : ReturnPayload
{
    [JsonPropertyName("level")]
    public LogLevel Level { get; set; } = LogLevel.Info;

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}