import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-100 border border-semantic-border-light rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-semantic-text-primary mb-1">
              कुछ गड़बड़ हो गई / Something went wrong
            </h1>
            <p className="text-sm text-semantic-text-secondary mb-6">
              An unexpected issue occurred. We apologize for the inconvenience. Please refresh or return to the homepage.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 p-3 bg-surface-200/80 rounded-lg text-left text-xs text-semantic-text-tertiary font-mono overflow-auto max-h-28 border border-semantic-border-light">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 px-4 bg-surface-200 hover:bg-surface-300 text-semantic-text-primary text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors border border-semantic-border-light"
              >
                <Home className="w-4 h-4" />
                <span>Go to Home</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
