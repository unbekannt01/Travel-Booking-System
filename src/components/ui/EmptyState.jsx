import { cn } from "../../utils/cn"

/**
 * Calm empty state block for tables, lists, or filtered views with zero matching rows.
 * @param {{
 *   icon?: import("react").ReactNode,
 *   title: import("react").ReactNode,
 *   description?: import("react").ReactNode,
 *   action?: import("react").ReactNode,
 *   className?: string,
 * }} props
 */
export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10 rounded-[var(--yh-radius-lg)]",
        "border border-dashed border-border-subtle bg-surface-muted/50",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink-muted border border-border-subtle mb-3 shadow-[var(--yh-shadow-xs)]"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-ink-muted max-w-sm leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  )
}
