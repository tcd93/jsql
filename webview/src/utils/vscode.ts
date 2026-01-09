import { mockVscodeApi } from "./mockAPI";

export interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}

let vscodeApi: VSCodeAPI | null = null;

export const getVSCodeAPI = (): VSCodeAPI => {
  if (!vscodeApi) {
    if (typeof window.acquireVsCodeApi !== "function") {
      // Ensure that acquireVsCodeApi is available before calling it
      console.warn(
        "acquireVsCodeApi is not defined. This may not be running in a VSCode webview context."
      );
      vscodeApi = mockVscodeApi; // Use mock API if not available

      // set mock schemaData for autocompletion - simulate connection change and schema loading
      setTimeout(() => {
        // Simulate connection changed event
        const connectionChangeMessage = {
          type: "ext.connectionChanged",
          payload: {
            profile: {
              provider: "Dremio",
              name: "Mock Dremio Connection",
              host: "localhost",
              port: 9047,
              username: "demo_user",
            },
            status: "Connected",
          },
        };
        window.dispatchEvent(
          new MessageEvent("message", { data: connectionChangeMessage })
        );
      }, 1000);
    } else {
      vscodeApi = window.acquireVsCodeApi();
    }
  }
  return vscodeApi;
};
