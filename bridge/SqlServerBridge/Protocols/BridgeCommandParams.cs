using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SqlServerBridge;

public abstract class BridgeCommandParams {}

/// <summary>
/// Parameters for creating a connection in the bridge
/// </summary>
public class CreateConnectionParams : BridgeCommandParams
{
    [JsonPropertyName("connectionString")]
    public string? ConnectionString { get; set; }

    [JsonPropertyName("connectionName")]
    public string ConnectionName { get; set; } = string.Empty;

    [JsonPropertyName("host")]
    public string Host { get; set; } = string.Empty;

    [JsonPropertyName("port")]
    public int Port { get; set; } = 1433;

    [JsonPropertyName("database")]
    public string? Database { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("password")]
    public string? Password { get; set; }

    [JsonPropertyName("authentication")]
    public string? Authentication { get; set; }

    [JsonPropertyName("connectTimeout")]
    public int? ConnectTimeout { get; set; }

    [JsonPropertyName("commandTimeout")]
    public int? CommandTimeout { get; set; }

    [JsonPropertyName("encrypt")]
    public bool? Encrypt { get; set; }

    [JsonPropertyName("trustServerCertificate")]
    public bool? TrustServerCertificate { get; set; }

    [JsonPropertyName("applicationName")]
    public string? ApplicationName { get; set; }

    [JsonPropertyName("accessToken")]
    public string? AccessToken { get; set; }

    [JsonPropertyName("clientId")]
    public string? ClientId { get; set; }

    [JsonPropertyName("serverSPN")]
    public string? ServerSPN { get; set; }
}

/// <summary>
/// Parameters for executing a query
/// </summary>
public class ExecuteQueryParams : BridgeCommandParams
{
    [JsonPropertyName("connectionName")]
    [Required(AllowEmptyStrings = false)]
    public required string ConnectionName;

    [JsonPropertyName("query")]
    [Required(AllowEmptyStrings = false)]
    public string Query { get; set; } = string.Empty;

    [JsonPropertyName("queryId")]
    [Required(AllowEmptyStrings = false)]
    public required string QueryId;
}

/// <summary>
/// Parameters for executing a streaming query
/// </summary>
public class ExecuteStreamingQueryParams : BridgeCommandParams
{
    [JsonPropertyName("connectionName")]
    [Required(AllowEmptyStrings = false)]
    public required string ConnectionName;

    [JsonPropertyName("query")]
    [Required(AllowEmptyStrings = false)]
    public required string Query;

    [JsonPropertyName("queryId")]
    public string QueryId { get; set; } = string.Empty;
}

/// <summary>
/// Parameters for canceling a query
/// </summary>
public class CancelQueryParams : BridgeCommandParams
{
    [JsonPropertyName("queryId")]
    [Required(AllowEmptyStrings = false)]
    public required string QueryId;
}

/// <summary>
/// Parameters for closing a connection
/// </summary>
public class CloseConnectionParams : BridgeCommandParams
{
    [JsonPropertyName("connectionName")]
    public string ConnectionName { get; set; } = string.Empty;
}
