import { useState, useEffect } from "react"
import { Clock, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "../ui/index"
import { cn } from "../../utils/cn"

/**
 * Calm inline 429 Rate Limit Card with countdown timer and accessible retry button.
 *
 * @param {Object} props
 * @param {number} [props.retryAfterSeconds=60] - Seconds until request can be retried
 * @param {() => void} props.onRetry - Function to invoke when user clicks retry
 * @param {string} [props.title="Rate Limit Reached"] - Alert title
 * @param {string} [props.message] - Custom explanation message
 * @param {string} [props.className] - Additional styling classes
 */
export function RateLimitNotice({
  retryAfterSeconds = 60,
  onRetry,
  title = "Rate Limit Reached",
  message,
  className,
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(Math.max(1, retryAfterSeconds))

  useEffect(() => {
    setSecondsRemaining(Math.max(1, retryAfterSeconds))
  }, [retryAfterSeconds])

  useEffect(() => {
    if (secondsRemaining <= 0) return

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [secondsRemaining])

  const defaultMsg =
    secondsRemaining > 0
      ? `Too many requests were sent in a short period. Please wait ${secondsRemaining}s before retrying.`
      : "You can now retry your request."

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl",
        "bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-100",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
          {secondsRemaining > 0 ? (
            <Clock size={20} aria-hidden="true" />
          ) : (
            <AlertTriangle size={20} aria-hidden="true" />
          )}
        </div>
        <div>
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-xs text-ink-muted mt-0.5">{message || defaultMsg}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={secondsRemaining > 0}
          icon={<RefreshCw size={14} className={secondsRemaining === 0 ? "" : "opacity-50"} />}
        >
          {secondsRemaining > 0 ? `Retry in ${secondsRemaining}s` : "Retry Now"}
        </Button>
      </div>
    </div>
  )
}

export default RateLimitNotice
