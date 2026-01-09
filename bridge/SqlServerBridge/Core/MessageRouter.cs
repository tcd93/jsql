namespace SqlServerBridge;

public class MessageRouter
{
    private readonly Dictionary<Method, IRequestHandler> handlers = [];

    public void RegisterHandler(Method method, IRequestHandler handler)
    {
        handlers[method] = handler;
    }

    public async IAsyncEnumerable<BridgeMessage> RouteAsync(BridgeRequest request)
    {
        if (handlers.TryGetValue(request.Method, out var handler))
        {
            await foreach (var payload in handler.HandleAsync(request.Params))
            {
                yield return new BridgeMessage
                {
                    Id = request.Id,
                    Done = false,
                    Payload = payload
                };
            }

            yield return new BridgeMessage
            {
                Id = request.Id,
                Done = true
            };

            yield break;
        }

        throw new InvalidOperationException($"No handler registered for method '{request.Method}'");
    }
}

