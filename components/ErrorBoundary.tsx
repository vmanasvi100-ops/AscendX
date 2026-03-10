import React, { Component, ErrorInfo, ReactNode } from 'react';

// Define Props with optional children
interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * ErrorBoundary catches JavaScript errors in its child component tree and displays a fallback UI.
 */
class ErrorBoundary extends Component<Props, State> {
  // Fix: Explicitly declare props and state as class properties for better type inference and to fix "Property does not exist" errors in this environment.
  public props!: Props;
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to the console for debugging.
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    // Fix: Accessing this.state which is now explicitly declared.
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-100 flex items-center justify-center p-4 font-sans antialiased">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center max-w-md w-full">
                <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="mt-4 text-2xl font-bold text-slate-800">Oops! Something went wrong.</h1>
                <p className="mt-2 text-slate-600">
                    We've encountered an unexpected error. Please try refreshing the page. If the problem persists, please contact support.
                </p>
                <button
                    onClick={this.handleReload}
                    className="mt-6 px-6 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
                >
                    Reload Page
                </button>
            </div>
        </div>
      );
    }

    // Fix: Accessing this.props which is now explicitly declared to satisfy compiler checks.
    return this.props.children || null;
  }
}

export default ErrorBoundary;
