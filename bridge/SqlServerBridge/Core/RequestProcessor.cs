using System.Buffers;
using System.IO.Pipelines;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace SqlServerBridge;

public class RequestProcessor()
{
    private readonly PipeReader stdInReader = PipeReader.Create(Console.OpenStandardInput());

    /// <summary>
    /// Asynchronously reads requests from standard input
    /// </summary>
    public async IAsyncEnumerable<BridgeRequest> GetRequests([EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var result = await stdInReader.ReadAsync(cancellationToken);
                var buffer = result.Buffer;

                // Process all complete lines in the buffer
                SequencePosition? consumed = null;
                while (TryParseLine(buffer, out var line, out var nextPosition))
                {
                    consumed = nextPosition;

                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        yield return ConvertToRequest(line);
                    }

                    buffer = buffer.Slice(nextPosition);
                }

                if (consumed.HasValue)
                {
                    // Tell PipeReader what we've consumed and what to keep for next iteration
                    stdInReader.AdvanceTo(consumed.Value, result.Buffer.End);
                }
                else
                {
                    // No complete lines found - examine all but consume nothing
                    stdInReader.AdvanceTo(buffer.Start, buffer.End);
                }

                if (result.IsCompleted)
                {
                    break;
                }
            }
        }
        finally
        {
            stdInReader.Complete();
        }
    }

    /// <summary>
    /// Attempts to parse a single line from the buffer.
    /// </summary>
    /// <param name="buffer">The buffer to parse from</param>
    /// <param name="line">The parsed line (if successful)</param>
    /// <param name="nextPosition">Position after the parsed line (for slicing)</param>
    /// <returns>True if a complete line was found, false if more data is needed</returns>
    private static bool TryParseLine(ReadOnlySequence<byte> buffer, out string line, out SequencePosition nextPosition)
    {
        var reader = new SequenceReader<byte>(buffer);

        // Try to find a line ending with \n
        if (reader.TryReadTo(out ReadOnlySequence<byte> lineSequence, (byte)'\n', advancePastDelimiter: true))
        {
            line = Encoding.UTF8.GetString(lineSequence);
            nextPosition = reader.Position;
            return true;
        }

        // No newline found - incomplete line
        line = string.Empty;
        nextPosition = default;
        return false;
    }

    private static BridgeRequest ConvertToRequest(string line)
    {
        return JsonSerializer.Deserialize<BridgeRequest>(line, MessageWriter.JsonOptions)!;
    }
}
