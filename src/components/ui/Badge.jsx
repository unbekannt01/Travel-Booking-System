import { cn } from "../../utils/cn"
import { badgeVariants } from "./variants"

/**
 * Compact semantic label badge using soft tinted backgrounds and WCAG AA text contrast.
 * @param {import("react").HTMLAttributes<HTMLSpanElement> & {
 *   variant?: "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info",
 *   size?: "sm" | "md",
 *   icon?: import("react").ReactNode,
 * }} props
 */
export function Badge({ variant = "neutral", size = "md", icon, className, children, ...rest }) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...rest}>
      {icon ? (
        <span className="shrink-0 inline-flex items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  )
}
