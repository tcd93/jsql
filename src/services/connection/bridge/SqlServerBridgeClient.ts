import { ChildProcess, spawn, spawnSync } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  BridgeRequest,
  BridgeMethod,
  BridgeMessage,
  ReturnPayload,
  ExecuteStreamingQueryPayload,
  BridgeError,
  isLogPayload,
  LogPayload,
} from "../../../types";

interface PendingRequest {
  resolve: (value: ReturnPayload | null) => void;
  reject: (error: Error) => void;
  payloads: ReturnPayload[];
}

interface OutputLogger {
  writeToOutput(
    message: string,
    level?: "INFO" | "ERROR" | "WARNING" | "DEBUG",
  ): void;
}

interface BridgeLaunchTarget {
  command: string;
  args: string[];
  cwd: string;
  resolvedPath: string;
}

export interface SqlServerBridgeClientOptions {
  extensionPath: string;
  outputLogger?: OutputLogger;
}

export class SqlServerBridgeClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private requestIdCounter = 0;
  private readonly extensionPath: string;
  private readonly outputLogger?: OutputLogger;
  private stdoutBuffer = "";
  private isDisposed = false;

  constructor(options: SqlServerBridgeClientOptions) {
    super();
    this.extensionPath = options.extensionPath;
    this.outputLogger = options.outputLogger;
  }

  private getBridgeLaunchTarget(): BridgeLaunchTarget {
    const platform = os.platform();
    const arch = os.arch();
    const executableName =
      platform === "win32" ? "SqlServerBridge.exe" : "SqlServerBridge";
    const dllName = "SqlServerBridge.dll";

    const bridgeDir = path.join(
      this.extensionPath,
      "bridge",
      "SqlServerBridge",
    );
    const runtimeId = this.getRuntimeId(platform, arch);

    const targetFrameworks = ["net10.0", "net9.0"];

    // Search order: .NET 10 > .NET 9, Release > Debug, runtime-specific > framework-dependent, exe > dll
    const searchPaths: string[] = [];
    for (const tfm of targetFrameworks) {
      searchPaths.push(
        // Release, runtime-specific
        path.join(bridgeDir, "bin", "Release", tfm, runtimeId, executableName),
        path.join(bridgeDir, "bin", "Release", tfm, runtimeId, dllName),
        // Release, Framework-dependent
        path.join(bridgeDir, "bin", "Release", tfm, executableName),
        path.join(bridgeDir, "bin", "Release", tfm, dllName),
        // Debug, runtime-specific
        path.join(bridgeDir, "bin", "Debug", tfm, runtimeId, executableName),
        path.join(bridgeDir, "bin", "Debug", tfm, runtimeId, dllName),
        // Debug, Framework-dependent
        path.join(bridgeDir, "bin", "Debug", tfm, executableName),
        path.join(bridgeDir, "bin", "Debug", tfm, dllName),
      );
    }

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        // The bridge is built framework-dependent (dotnet build, not a
        // self-contained publish), so both the apphost .exe and the .dll
        // require the shared .NET runtime to be installed on the machine.
        this.ensureDotnetRuntimeAvailable();

        if (searchPath.toLowerCase().endsWith(".dll")) {
          return {
            command: "dotnet",
            args: [searchPath],
            cwd: path.dirname(searchPath),
            resolvedPath: searchPath,
          };
        }

        return {
          command: searchPath,
          args: [],
          cwd: path.dirname(searchPath),
          resolvedPath: searchPath,
        };
      }
    }

    const diagnostics = [
      "Bridge executable not found.",
      `Platform=${platform}, arch=${arch}, runtimeId=${runtimeId}`,
      `Base directory: ${bridgeDir}`,
      "Checked paths:",
      ...searchPaths.map((p) => `- ${p}`),
    ].join("\n");

    this.outputLogger?.writeToOutput(`[Bridge] ${diagnostics}`, "ERROR");
    throw new Error(diagnostics);
  }

  private getRuntimeId(platform: string, arch: string): string {
    // Architecture policy:
    // - Use native runtime IDs for supported platform/arch combinations.
    // - Fall back to framework-dependent .dll probing when native runtime-specific outputs are unavailable.
    if (platform === "win32") {
      if (arch === "x64") {
        return "win-x64";
      }
      if (arch === "arm64") {
        return "win-arm64";
      }

      throw new Error(
        `Unsupported architecture for Windows bridge: ${arch}. Supported Windows architectures are x64 and arm64.`,
      );
    }

    if (platform === "darwin") {
      if (arch === "x64") {
        return "osx-x64";
      }
      if (arch === "arm64") {
        return "osx-arm64";
      }

      throw new Error(
        `Unsupported architecture for macOS bridge: ${arch}. Supported macOS architectures are x64 and arm64.`,
      );
    }

    if (platform === "linux") {
      if (arch === "x64") {
        return "linux-x64";
      }
      if (arch === "arm64") {
        return "linux-arm64";
      }

      throw new Error(
        `Unsupported architecture for Linux bridge: ${arch}. Supported Linux architectures are x64 and arm64.`,
      );
    }

    throw new Error(`Unsupported platform for bridge: ${platform}`);
  }

  private ensureDotnetRuntimeAvailable(): void {
    const result = spawnSync("dotnet", ["--list-runtimes"], {
      encoding: "utf8",
    });

    if (result.error) {
      const diagnostics =
        "The bridge requires .NET runtime, but dotnet was not found on PATH.";
      this.outputLogger?.writeToOutput(`[Bridge] ${diagnostics}`, "ERROR");
      throw new Error(diagnostics);
    }

    if (result.status !== 0) {
      const diagnostics = [
        "Failed to query installed .NET runtimes (dotnet --list-runtimes).",
        `Exit code: ${result.status ?? "unknown"}`,
        `stderr: ${(result.stderr ?? "").trim()}`,
      ].join("\n");
      this.outputLogger?.writeToOutput(`[Bridge] ${diagnostics}`, "ERROR");
      throw new Error(diagnostics);
    }

    const runtimes = result.stdout ?? "";
    const hasSupportedRuntime =
      /Microsoft\.NETCore\.App\s+10\./.test(runtimes) ||
      /Microsoft\.NETCore\.App\s+9\./.test(runtimes);

    if (!hasSupportedRuntime) {
      const diagnostics = [
        "No supported .NET runtime found for SQL Server bridge.",
        "Expected Microsoft.NETCore.App 9.x or 10.x.",
        "Installed runtimes:",
        runtimes.trim() || "(none)",
      ].join("\n");
      this.outputLogger?.writeToOutput(`[Bridge] ${diagnostics}`, "ERROR");
      throw new Error(diagnostics);
    }
  }

  private async ensureProcessStarted(): Promise<void> {
    if (this.isDisposed) {
      throw new Error("Bridge client has been disposed");
    }

    if (this.process && !this.process.killed) {
      return;
    }

    const launchTarget = this.getBridgeLaunchTarget();

    this.process = spawn(launchTarget.command, launchTarget.args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: launchTarget.cwd,
    });

    this.process.stdout?.setEncoding("utf8");
    this.process.stderr?.setEncoding("utf8");

    this.stdoutBuffer = "";

    this.process.stdout?.on("data", (chunk: string) => {
      this.processStdoutChunk(chunk);
    });

    this.process.stderr?.on("data", (data: string) => {
      const trimmed = data.trim();
      if (
        trimmed.includes("You must install or update .NET") ||
        trimmed.includes("Framework:") ||
        trimmed.includes("Microsoft.NETCore.App")
      ) {
        this.outputLogger?.writeToOutput(
          `[Bridge] .NET runtime startup issue detected while launching ${launchTarget.resolvedPath}: ${trimmed}`,
          "ERROR",
        );
      }
      console.error(`[Bridge stderr] ${data}`);
    });

    this.process.on("error", (error) => {
      this.outputLogger?.writeToOutput(
        `[Bridge] Process start failed. Command='${launchTarget.command}' Args='${launchTarget.args.join(
          " ",
        )}' Error='${error.message}'`,
        "ERROR",
      );
      console.error(`[Bridge process error]`, error);
      this.cleanup();
    });

    this.process.on("exit", (code) => {
      console.log(`[Bridge process exited] Code: ${code}`);
      this.cleanup();
    });
  }

  private processStdoutChunk(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split("\n");
    // Keep incomplete line in buffer for next chunk
    this.stdoutBuffer = lines.pop() ?? "";

    // Process each complete line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        this.processLine(trimmed);
      }
    }
  }

  private processLine(line: string): void {
    let message: BridgeMessage;
    try {
      message = JSON.parse(line) as BridgeMessage;
    } catch (error) {
      // If parsing fails, try to extract request ID for better error reporting
      const requestId = this.extractRequestIdFromMalformedJson(line);
      if (requestId && this.pendingRequests.has(requestId)) {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          this.pendingRequests.delete(requestId);
          pending.reject(
            new Error(
              `Failed to parse bridge response: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
        }
      } else {
        // Unknown request or log message - treat as log
        this.handleLog(line);
      }
      return;
    }

    // Handle log messages separately
    if (message?.payload && isLogPayload(message.payload)) {
      this.handleLog(message.payload);
      return;
    }

    // Handle regular request/response messages
    if (message.done) {
      this.handleDoneMessage(message);
    } else if (message.payload) {
      this.handlePayloadMessage(message);
    }
  }

  private extractRequestIdFromMalformedJson(line: string): string | null {
    const idMatch = line.match(/"id"\s*:\s*"([^"]+)"/);
    return idMatch?.[1] ?? null;
  }

  private handleDoneMessage(message: BridgeMessage): void {
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      this.pendingRequests.delete(message.id);
      const lastPayload =
        pending.payloads.length > 0
          ? pending.payloads[pending.payloads.length - 1]
          : null;
      pending.resolve(lastPayload);
    } else {
      console.warn(
        `[Bridge] Received done message for unknown request ID: ${message.id}`,
      );
    }
  }

  private handlePayloadMessage(message: BridgeMessage): void {
    if (!message.payload) {
      return;
    }

    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      pending.payloads.push(message.payload);

      if (message.payload.$type === "executeStreamingQuery") {
        this.handleStreamingPayload(message.payload);
      }
    } else {
      if (message.payload.$type === "executeStreamingQuery") {
        this.handleStreamingPayload(message.payload);
      } else {
        console.warn(
          `[Bridge] Received payload for unknown request ID: ${message.id}`,
        );
      }
    }
  }

  private handleLog(log: LogPayload | unknown): void {
    if (typeof log === "object" && isLogPayload(log)) {
      const level = log.level.toUpperCase() as
        | "INFO"
        | "ERROR"
        | "WARNING"
        | "DEBUG";
      this.outputLogger?.writeToOutput(`[Bridge] ${log.message}`, level);
      console.debug(`[Bridge] [${level}] ${log.message}`);
      return;
    } else {
      this.outputLogger?.writeToOutput(
        `[Bridge] [UNKNOWN] ${JSON.stringify(log)}`,
        "DEBUG",
      );
      console.debug(`[Bridge] [UNKNOWN] ${JSON.stringify(log)}`);
      return;
    }
  }

  private handleStreamingPayload(payload: ExecuteStreamingQueryPayload): void {
    this.emit("streaming", payload);
  }

  async sendRequest(
    method: BridgeMethod | string,
    params: unknown,
  ): Promise<ReturnPayload | null> {
    try {
      await this.ensureProcessStarted();
    } catch (error) {
      // If client is disposed, return an error payload instead of throwing
      if (
        error instanceof Error &&
        error.message === "Bridge client has been disposed"
      ) {
        return this.createErrorPayload(method, error.message);
      }
      throw error;
    }

    if (!this.process || this.process.killed) {
      return this.createErrorPayload(method, "Bridge process is not available");
    }

    const id = (++this.requestIdCounter).toString();
    const request: BridgeRequest = {
      id,
      method: typeof method === "string" ? method : BridgeMethod[method],
      params,
    };

    return new Promise<ReturnPayload | null>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve,
        reject,
        payloads: [],
      });

      try {
        const requestJson = JSON.stringify(request);
        const written = this.process?.stdin?.write(`${requestJson}\n`);
        if (!written) {
          this.pendingRequests.delete(id);
          reject(new Error("Failed to write request to bridge stdin"));
        }
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(
          new Error(
            `Failed to send request: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    });
  }

  private createErrorPayload(
    method: BridgeMethod | string,
    errorMessage: string,
  ): ReturnPayload {
    const methodStr =
      typeof method === "string" ? method : BridgeMethod[method];
    const error: BridgeError = {
      code: "CLIENT_ERROR",
      message: errorMessage,
    };

    // Create appropriate error payload based on method type
    switch (methodStr) {
      case "executeQuery":
        return {
          $type: "executeQuery",
          schema: [],
          data: { rows: [], totalRowsSoFar: 0 },
          error,
        };
      case "createConnection":
        return {
          $type: "createConnection",
          success: false,
          error,
        };
      case "closeConnection":
        return {
          $type: "closeConnection",
          success: false,
          error,
        };
      case "cancelQuery":
        return {
          $type: "cancelQuery",
          success: false,
          error,
        };
      case "executeStreamingQuery":
        return {
          $type: "executeStreamingQuery",
          event: "error",
          queryId: "",
          data: {
            $type: "error",
            error: errorMessage,
          },
          error,
        };
      default:
        // Fallback to createConnection payload for unknown methods
        return {
          $type: "createConnection",
          success: false,
          error,
        };
    }
  }

  private cleanup(): void {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("Bridge process terminated"));
    }
    this.pendingRequests.clear();
    this.process = null;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    this.cleanup();
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }
}
