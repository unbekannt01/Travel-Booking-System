import { cn } from "../../utils/cn"

/**
 * Standard top-of-screen page header with title, optional subtitle/eyebrow, and responsive action slot.
 * @param {{
 *   title: import("react").ReactNode,
 *   subtitle?: import("react").ReactNode,
 *   eyebrow?: import("react").ReactNode,
 *   actions?: import("react").ReactNode,
 *   className?: string,
 * }} props
 */
export function PageHeader({ title, subtitle, eyebrow, actions, className }) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border-subtle",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-warm-text mb-1">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-ink-muted mt-1 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  )
}
