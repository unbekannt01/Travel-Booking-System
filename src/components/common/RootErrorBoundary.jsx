import { Component } from "react"
import { AlertOctagon, RotateCw, Home } from "lucide-react"
import { Button, Card } from "../ui/index"

export class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught application error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-(--yh-bg-subtle) flex items-center justify-center p-4 sm:p-6 text-center font-sans">
          <Card elevation="md" className="max-w-lg w-full p-8 rounded-3xl border-(--yh-border-subtle) space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-(--yh-danger)/10 text-(--yh-danger) mx-auto flex items-center justify-center">
              <AlertOctagon size={28} />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-(--yh-text-primary)">
                Something went wrong
              </h1>
              <p className="text-xs text-(--yh-text-muted) leading-relaxed">
                An unexpected application error occurred. You can reload the application or return to the overview.
              </p>
            </div>

            {this.state.error?.message && (
              <details className="text-left p-3 rounded-xl bg-(--yh-surface-muted) border border-(--yh-border-subtle) text-xs">
                <summary className="cursor-pointer font-semibold text-(--yh-text-muted) hover:text-(--yh-text-primary)">
                  Error Details
                </summary>
                <pre className="mt-2 text-[11px] font-mono text-(--yh-danger) whitespace-pre-wrap break-all">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
                className="flex-1"
                icon={<RotateCw size={16} />}
              >
                Reload Application
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/"
                }}
                className="flex-1"
                icon={<Home size={16} />}
              >
                Go to Overview
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
