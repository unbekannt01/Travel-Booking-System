import { Component } from "react"
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"

/**
 * Lightweight error boundary designed for tab panels and modular dashboard sections.
 * Displays a calm, compact inline error state with Retry and Reload App options,
 * with collapsible stack traces in DEV mode and zero PII in production.
 */
export class PanelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    }
    this.handleRetry = this.handleRetry.bind(this)
    this.handleReload = this.handleReload.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error("PanelErrorBoundary caught error:", error, errorInfo)
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      })
    }
  }

  handleRetry() {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }))
    if (typeof this.props.onRetry === "function") {
      this.props.onRetry()
    }
  }

  handleReload() {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV)
      const { title = "Section Unavailable", className } = this.props
      const { error, errorInfo, retryCount } = this.state

      return (
        <Card
          elevation="sm"
          padding="lg"
          className={`max-w-xl mx-auto my-6 text-center space-y-4 ${className || ""}`}
        >
          <div className="flex flex-col items-center">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--yh-radius-lg)] bg-danger-soft text-danger-text border border-danger-border mb-3"
            >
              <AlertTriangle size={24} />
            </span>
            <h3 className="text-base font-bold text-ink">{title}</h3>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed max-w-md">
              {isDev && error?.message
                ? error.message
                : "An unexpected error occurred while rendering this section. You can retry loading it."}
            </p>

            {isDev && error && (
              <details className="mt-3 text-left w-full text-xs bg-surface-muted p-3 rounded-[var(--yh-radius-md)] border border-border-subtle max-h-44 overflow-auto">
                <summary className="font-semibold text-ink cursor-pointer select-none">
                  Error Details & Stack Trace (Dev Only)
                </summary>
                <pre className="mt-2 text-[11px] font-mono text-danger-text whitespace-pre-wrap break-all">
                  {error.stack}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={this.handleRetry}
              >
                Retry
              </Button>
              {retryCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCcw size={14} />}
                  onClick={this.handleReload}
                >
                  Reload App
                </Button>
              )}
            </div>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}

export default PanelErrorBoundary
