namespace SqlServerBridge;

public interface IRequestHandler
{
    /// <summary>
    /// Handles the incoming request and returns an async enumerable of ReturnPayload.  
    /// Must catch exceptions and return them as part of the ReturnPayload.
    /// </summary>
    IAsyncEnumerable<ReturnPayload> HandleAsync(BridgeCommandParams param);
}


