import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public handleReset = () => {
    // Clear local storage if needed or just reload
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0e121b] border border-red-500/30 rounded-[2rem] p-10 text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-500/20">
              <AlertTriangle size={40} />
            </div>
            
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Critical System Halt</h2>
              <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
                The terminal encountered an unexpected data anomaly.
                <br />
                <span className="font-mono text-xs text-red-400 mt-2 block bg-black/50 p-2 rounded">
                  {this.state.error?.message || 'Null Pointer Exception'}
                </span>
              </p>
            </div>

            <button 
              onClick={this.handleReset}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-red-500/20"
            >
              <RefreshCcw size={16} />
              Reboot Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;