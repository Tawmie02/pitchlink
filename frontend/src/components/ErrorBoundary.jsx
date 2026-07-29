import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[React ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
          <div className="max-w-md w-full p-6 bg-white dark:bg-stone-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-card text-center">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 line-clamp-3">
              {this.state.error?.message || "An unexpected error occurred in the application."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pitch-600 dark:bg-pitch-500 text-white font-medium text-sm hover:bg-pitch-700 shadow-soft transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
