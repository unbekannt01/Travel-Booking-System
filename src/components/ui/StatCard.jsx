import { isValidElement, createElement } from "react"
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
 * Defensively accepts React elements or component functions/forwardRefs for `icon`.
 * @param {{
 *   label: string,
 *   value: import("react").ReactNode,
 *   hint?: import("react").ReactNode,
 *   subtitle?: import("react").ReactNode,
 *   icon?: import("react").ReactNode,
 *   tone?: "brand" | "accent" | "success" | "warning" | "danger" | "info",
 *   iconTone?: "brand" | "accent" | "success" | "warning" | "danger" | "info",
 *   className?: string,
 * }} props
 */
export function StatCard({
  label,
  value,
  hint,
  subtitle,
  icon,
  tone = "brand",
  iconTone,
  className,
}) {
  const resolvedTone = iconTone || tone
  const resolvedHint = hint || subtitle

  let renderedIcon = null
  if (icon) {
    if (isValidElement(icon)) {
      renderedIcon = icon
    } else if (
      typeof icon === "function" ||
      (typeof icon === "object" && icon !== null && icon.$$typeof)
    ) {
      renderedIcon = createElement(icon, { size: 20 })
    }
  }

  return (
    <Card elevation="sm" padding="md" className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-bold text-ink tabular-nums tracking-tight leading-none">
          {value}
        </p>
        {resolvedHint ? <p className="mt-2 text-xs text-ink-secondary leading-snug">{resolvedHint}</p> : null}
      </div>
      {renderedIcon ? (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yh-radius-md)]",
            TONE_ICON_STYLES[resolvedTone] || TONE_ICON_STYLES.brand,
          )}
        >
          {renderedIcon}
        </span>
      ) : null}
    </Card>
  )
}
