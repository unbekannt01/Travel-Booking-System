import { Component } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button, Card } from "../ui"

/**
 * Error boundary wrapping lazy-loaded routes and modals.
 * Recovers cleanly when `resetKey` changes (e.g. switching tabs) or when the user clicks Retry.
 */
export class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, retryCount: 0 }
    this.handleRetry = this.handleRetry.bind(this)
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error("Lazy screen load error:", error)
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  handleRetry() {
    this.setState((prev) => ({
      hasError: false,
      retryCount: prev.retryCount + 1,
    }))
    if (typeof this.props.onRetry === "function") {
      this.props.onRetry()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card elevation="sm" padding="lg" className="max-w-lg mx-auto my-8 text-center">
          <div className="flex flex-col items-center">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--yh-radius-lg)] bg-warning-soft text-warning-text border border-warning-border mb-4"
            >
              <AlertTriangle size={24} />
            </span>
            <h2 className="text-lg font-bold text-ink">Could not load this page</h2>
            <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">
              This screen failed to load — which can happen right after an update or a temporary network interruption.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                variant="primary"
                leftIcon={<RefreshCw size={16} />}
                onClick={this.handleRetry}
              >
                Retry
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Reload App
              </Button>
            </div>
          </div>
        </Card>
      )
    }

    return (
      <div key={this.state.retryCount} className="contents">
        {this.props.children}
      </div>
    )
  }
}
