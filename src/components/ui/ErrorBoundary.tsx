import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Global error boundary that catches render errors from lazy-loaded pages
 * and shows a branded recovery UI instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[hsl(var(--background))] px-6 text-center">
          <div className="text-6xl">🐄</div>
          <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">
            Something udderly went wrong
          </h1>
          <p className="max-w-md text-sm text-[hsl(var(--muted-foreground))]">
            The app hit an unexpected error. This is probably a bug — try reloading the page.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="max-w-lg overflow-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4 text-left text-xs text-red-500">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="rounded-xl bg-amul-red px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
