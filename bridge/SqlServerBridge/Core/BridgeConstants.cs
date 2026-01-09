namespace SqlServerBridge;

/// <summary>
/// Constants used throughout the bridge
/// </summary>
public static class BridgeConstants
{
    /// <summary>
    /// Number of rows to batch together before sending in streaming queries
    /// </summary>
    public const int StreamingBatchSize = 200;

    /// <summary>
    /// Default connection timeout in seconds
    /// </summary>
    public const int DefaultConnectTimeout = 180;

    /// <summary>
    /// Default command timeout in seconds (0 = no timeout)
    /// </summary>
    public const int DefaultCommandTimeout = 0;

    /// <summary>
    /// Special message ID used for log messages
    /// </summary>
    public const string LogMessageId = "log";

    /// <summary>
    /// Default application name for SQL Server connections
    /// </summary>
    public const string DefaultApplicationName = "jsql-extension";
}


