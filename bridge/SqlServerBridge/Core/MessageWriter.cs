using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SqlServerBridge;

public class MessageWriter : IDisposable
{
    private readonly object @lock = new();
    private readonly StreamWriter writer = new(Console.OpenStandardOutput(), Encoding.UTF8) { AutoFlush = true };

    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        IncludeFields = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false) },
        WriteIndented = false
    };

    public void WriteLog(LogLevel level, string log)
    {
        var payload = new LogPayload
        {
            Level = level,
            Message = log
        };
        var message = new BridgeMessage
        {
            Id = BridgeConstants.LogMessageId,
            Done = true,
            Payload = payload
        };
        WriteMessage(message);
    }

    public void WriteMessage(BridgeMessage message)
    {
        try
        {
            if (string.IsNullOrEmpty(message.Id))
            {
                Console.Error.WriteLine($"[MessageWriter] Warning: Attempted to write message with empty Id. Done={message.Done}, HasPayload={message.Payload != null}");
            }
            
            var json = JsonSerializer.Serialize(message, JsonOptions);
            
            if (string.IsNullOrWhiteSpace(json) || json == "{}")
            {
                Console.Error.WriteLine($"[MessageWriter] Warning: Serialized message is empty. Original: Id={message.Id}, Done={message.Done}, HasPayload={message.Payload != null}");
                return;
            }
            
            lock (@lock)
            {
                writer.WriteLine(json);
            }
        }
        catch (ObjectDisposedException)
        {
        }
        catch (Exception ex)
        {
            try
            {
                var errorLog = new BridgeMessage
                {
                    Id = BridgeConstants.LogMessageId,
                    Done = true,
                    Payload = new LogPayload
                    {
                        Level = LogLevel.Error,
                        Message = $"Failed to write message: {ex.Message}"
                    }
                };
                var errorJson = JsonSerializer.Serialize(errorLog, JsonOptions);
                Console.Error.WriteLine(errorJson);
            }
            catch
            {
            }
        }
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
        writer.Dispose();
    }
}

