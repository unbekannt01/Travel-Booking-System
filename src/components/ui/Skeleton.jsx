import { cn } from "../../utils/cn"

const SHAPE_CLASSES = {
  text: "h-4 rounded-[var(--yh-radius-xs)]",
  rect: "rounded-[var(--yh-radius-md)]",
  circle: "rounded-full",
}

/**
 * Loading placeholder skeleton respecting prefers-reduced-motion.
 * @param {{
 *   shape?: "text" | "rect" | "circle",
 *   className?: string,
 * }} props
 */
export function Skeleton({ shape = "text", className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse bg-surface-muted border border-border-subtle/50",
        SHAPE_CLASSES[shape] || SHAPE_CLASSES.text,
        className,
      )}
    />
  )
}
