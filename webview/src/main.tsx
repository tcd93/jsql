import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import "./styles/main.css";

// Import dev CSS variables only in development
if (import.meta.env.DEV) {
  console.debug("Loading development CSS variables");
  import("./dev-variables.css");
}

// @refresh reset

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  } 

  static getDerivedStateFromError(error: Error): { hasError: boolean; error?: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("VSCode Webview Error:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
          return (
      <div className="error-boundary">
        <h2>Something went wrong in the VSCode extension.</h2>
        <details>
          <summary>Error Details</summary>
          <pre>{this.state.error?.stack}</pre>
        </details>
      </div>
    );
    }

    return this.props.children;
  }
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
