import { cn } from "../../utils/cn"
import { Card } from "./Card"

const TONE_ICON_STYLES = {
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent-warm-soft text-accent-warm-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  info: "bg-info-soft text-info-text",
}

/**
 * KPI metric card displaying an icon, label, tabular-nums value, and optional subtitle/trend.
 * @param {{
 *   label: string,
 *   value: import("react").ReactNode,
 *   hint?: import("react").ReactNode,
 *   icon?: import("react").ReactNode,
 *   tone?: "brand" | "accent" | "success" | "warning" | "danger" | "info",
 *   className?: string,
 * }} props
 */
export function StatCard({ label, value, hint, icon, tone = "brand", className }) {
  return (
    <Card elevation="sm" padding="md" className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-bold text-ink tabular-nums tracking-tight leading-none">
          {value}
        </p>
        {hint ? <p className="mt-2 text-xs text-ink-secondary leading-snug">{hint}</p> : null}
      </div>
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yh-radius-md)]",
            TONE_ICON_STYLES[tone] || TONE_ICON_STYLES.brand,
          )}
        >
          {icon}
        </span>
      ) : null}
    </Card>
  )
}
