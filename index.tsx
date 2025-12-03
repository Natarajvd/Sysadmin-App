import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// POLYFILL: Ensure process.env exists in browser environments (fixes GitHub Pages crash)
// This prevents "Uncaught ReferenceError: process is not defined"
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} };
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Error Boundary to catch runtime crashes and show a useful error instead of a black screen
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Critical Application Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-black text-red-500 h-screen w-full p-8 font-mono overflow-auto flex flex-col items-start justify-center">
          <h1 className="text-3xl font-bold mb-4 tracking-widest border-b border-red-500/30 pb-2 w-full">SYSTEM CRITICAL FAILURE</h1>
          <p className="mb-6 text-gray-400">The application encountered a fatal error during initialization.</p>
          
          <div className="bg-red-950/20 border border-red-500/20 p-6 rounded-lg w-full max-w-4xl">
            <h2 className="text-sm font-bold text-red-400 mb-2 uppercase">Error Log</h2>
            <pre className="whitespace-pre-wrap text-xs text-red-300 font-mono">
              {this.state.error?.toString()}
            </pre>
          </div>

          <div className="mt-8 text-gray-500 text-xs">
            <p>DIAGNOSTIC HINT: If you are seeing "process is not defined", the polyfill in index.tsx failed.</p>
            <p>If you are seeing "API Key missing", check your environment variables.</p>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-red-600 hover:bg-red-500 text-black font-bold rounded uppercase tracking-wider transition-colors"
          >
            Reboot System
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);