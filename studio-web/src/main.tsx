import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: Error | null };

class RootErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LinkedIn AI UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const { message, stack } = this.state.error;
      return (
        <div
          style={{
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "#0f1419",
            color: "#e8eef4",
            minHeight: "100vh",
            lineHeight: 1.5,
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: "1.15rem" }}>LinkedIn AI — something broke</h1>
          <p style={{ color: "#8fa3b8" }}>
            The app hit a runtime error (this replaces a blank screen). Check the browser console for details.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#1a222d",
              padding: "1rem",
              borderRadius: 8,
              border: "1px solid #2f3d4d",
              color: "#f06b6b",
            }}
          >
            {message}
          </pre>
          {stack != null && stack.length > 0 && (
            <pre
              style={{
                marginTop: "1rem",
                whiteSpace: "pre-wrap",
                fontSize: "0.72rem",
                opacity: 0.85,
                overflow: "auto",
                maxHeight: "50vh",
              }}
            >
              {stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
