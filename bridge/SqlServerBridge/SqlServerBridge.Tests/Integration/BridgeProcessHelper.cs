using System.Diagnostics;
using System.Text;
using System.Text.Json;
using SqlServerBridge;

namespace SqlServerBridge.Tests.Integration;

public class BridgeProcessHelper : IDisposable
{
    private readonly Process _process;
    private readonly StreamWriter _stdin;
    private readonly StreamReader _stdout;
    private readonly StreamReader _stderr;
    private readonly StringBuilder _stdoutBuffer = new();
    private readonly StringBuilder _stderrBuffer = new();
    private bool _disposed;

    public BridgeProcessHelper()
    {
        var baseDir = AppContext.BaseDirectory;
        var currentDir = Directory.GetCurrentDirectory();
        
        var possiblePaths = new List<string>();
        
        var testProjectDir = Path.GetDirectoryName(baseDir);
        if (testProjectDir != null)
        {
            var projectRoot = Path.GetDirectoryName(testProjectDir);
            if (projectRoot != null)
            {
                possiblePaths.Add(Path.Combine(projectRoot, "bin", "Debug", "net8.0", "SqlServerBridge.exe"));
                possiblePaths.Add(Path.Combine(projectRoot, "bin", "Debug", "net8.0", "SqlServerBridge.dll"));
            }
        }
        
        possiblePaths.Add(Path.Combine(currentDir, "bin", "Debug", "net8.0", "SqlServerBridge.exe"));
        possiblePaths.Add(Path.Combine(currentDir, "bin", "Debug", "net8.0", "SqlServerBridge.dll"));
        possiblePaths.Add(Path.Combine(currentDir, "..", "bin", "Debug", "net8.0", "SqlServerBridge.exe"));
        possiblePaths.Add(Path.Combine(currentDir, "..", "bin", "Debug", "net8.0", "SqlServerBridge.dll"));
        possiblePaths.Add(Path.Combine(baseDir, "..", "..", "..", "bin", "Debug", "net8.0", "SqlServerBridge.exe"));
        possiblePaths.Add(Path.Combine(baseDir, "..", "..", "..", "bin", "Debug", "net8.0", "SqlServerBridge.dll"));

        string? exePath = null;
        foreach (var path in possiblePaths)
        {
            var fullPath = Path.GetFullPath(path);
            if (File.Exists(fullPath))
            {
                exePath = fullPath;
                break;
            }
        }

        if (exePath == null)
        {
            var searchedPaths = string.Join("\n", possiblePaths.Select(p => $"  - {Path.GetFullPath(p)}"));
            throw new FileNotFoundException($"Bridge executable not found. Searched paths:\n{searchedPaths}");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = exePath.EndsWith(".dll") ? "dotnet" : exePath,
            Arguments = exePath.EndsWith(".dll") ? $"\"{exePath}\"" : "",
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        _process = new Process { StartInfo = startInfo };
        _process.Start();
        
        var utf8NoBom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
        _stdin = new StreamWriter(_process.StandardInput.BaseStream, utf8NoBom) { AutoFlush = true };
        _stdout = new StreamReader(_process.StandardOutput.BaseStream, Encoding.UTF8);
        _stderr = new StreamReader(_process.StandardError.BaseStream, Encoding.UTF8);

        _ = Task.Run(ReadStdoutAsync);
        _ = Task.Run(ReadStderrAsync);

        Thread.Sleep(200);
    }

    private async Task ReadStdoutAsync()
    {
        try
        {
            while (!_process.HasExited && !_stdout.EndOfStream)
            {
                var line = await _stdout.ReadLineAsync();
                if (line != null)
                {
                    lock (_stdoutBuffer)
                    {
                        _stdoutBuffer.AppendLine(line);
                    }
                }
            }
        }
        catch
        {
        }
    }

    private async Task ReadStderrAsync()
    {
        try
        {
            while (!_process.HasExited && !_stderr.EndOfStream)
            {
                var line = await _stderr.ReadLineAsync();
                if (line != null)
                {
                    lock (_stderrBuffer)
                    {
                        _stderrBuffer.AppendLine(line);
                    }
                }
            }
        }
        catch
        {
        }
    }

    public async Task<string> SendRequestAsync(BridgeRequest request)
    {
        var json = JsonSerializer.Serialize(request, MessageWriter.JsonOptions);
        await _stdin.WriteLineAsync(json);
        await _stdin.FlushAsync();
        await Task.Delay(100);
        return json;
    }

    public async Task<List<BridgeMessage>> ReadMessagesAsync(string requestId, int expectedCount = 1, int timeoutMs = 5000)
    {
        var messages = new List<BridgeMessage>();
        var processedLines = new HashSet<string>();
        var startTime = DateTime.UtcNow;
        var lastLineCount = 0;
        var noProgressCount = 0;
        
        while (messages.Count < expectedCount && (DateTime.UtcNow - startTime).TotalMilliseconds < timeoutMs)
        {
            var lines = GetStdoutLines();
            
            if (lines.Count == lastLineCount)
            {
                noProgressCount++;
                if (noProgressCount > 10)
                {
                    await Task.Delay(200);
                    noProgressCount = 0;
                }
            }
            else
            {
                lastLineCount = lines.Count;
                noProgressCount = 0;
            }
            
            foreach (var line in lines)
            {
                if (string.IsNullOrWhiteSpace(line) || processedLines.Contains(line))
                    continue;

                try
                {
                    var message = JsonSerializer.Deserialize<BridgeMessage>(line, MessageWriter.JsonOptions);
                    if (message != null && message.Id == requestId)
                    {
                        var messageJson = JsonSerializer.Serialize(message, MessageWriter.JsonOptions);
                        if (!messages.Any(m => JsonSerializer.Serialize(m, MessageWriter.JsonOptions) == messageJson))
                        {
                            messages.Add(message);
                            processedLines.Add(line);
                        }
                    }
                }
                catch (JsonException)
                {
                }
            }

            if (messages.Count < expectedCount)
            {
                await Task.Delay(50);
            }
        }

        return messages;
    }

    public List<BridgeMessage> GetAllMessages()
    {
        var messages = new List<BridgeMessage>();
        var lines = GetStdoutLines();
        
        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line))
                continue;

            try
            {
                var message = JsonSerializer.Deserialize<BridgeMessage>(line, MessageWriter.JsonOptions);
                if (message != null)
                {
                    messages.Add(message);
                }
            }
            catch (JsonException)
            {
            }
        }

        return messages;
    }

    public List<string> GetStdoutLines()
    {
        lock (_stdoutBuffer)
        {
            var content = _stdoutBuffer.ToString();
            return content.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries)
                .ToList();
        }
    }

    public string GetStderr()
    {
        lock (_stderrBuffer)
        {
            return _stderrBuffer.ToString();
        }
    }

    public void ClearBuffers()
    {
        lock (_stdoutBuffer)
        {
            _stdoutBuffer.Clear();
        }
        lock (_stderrBuffer)
        {
            _stderrBuffer.Clear();
        }
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        try
        {
            if (!_process.HasExited)
            {
                _process.Kill();
            }
            _process.WaitForExit(1000);
        }
        catch
        {
        }

        _stdin?.Dispose();
        _stdout?.Dispose();
        _stderr?.Dispose();
        _process?.Dispose();
        
        _disposed = true;
    }
}

