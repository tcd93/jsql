using System.Diagnostics;
using Xunit.Abstractions;

namespace SqlServerBridge.Tests;

/// <summary>
/// Helper class to measure and log test execution times
/// </summary>
public class TestTimingHelper : IDisposable
{
    private readonly Stopwatch _stopwatch;
    private readonly ITestOutputHelper? _output;
    private readonly string _testName;

    public TestTimingHelper(string testName, ITestOutputHelper? output = null)
    {
        _testName = testName;
        _output = output;
        _stopwatch = Stopwatch.StartNew();
        _output?.WriteLine($"[TIMING] Starting: {testName}");
    }

    public void LogCheckpoint(string checkpointName)
    {
        var elapsed = _stopwatch.ElapsedMilliseconds;
        _output?.WriteLine($"[TIMING] {_testName} - {checkpointName}: {elapsed}ms");
    }

    public void Dispose()
    {
        _stopwatch.Stop();
        var elapsed = _stopwatch.ElapsedMilliseconds;
        _output?.WriteLine($"[TIMING] Completed: {_testName} - Total: {elapsed}ms");
        
        if (elapsed > 1000)
        {
            _output?.WriteLine($"[TIMING] ⚠️  WARNING: {_testName} took {elapsed}ms (>1s)");
        }
    }
}

