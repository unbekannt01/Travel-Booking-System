import { cn } from "../../utils/cn"
import { cardVariants } from "./variants"

/**
 * Surface container card with elevation, padding, and interactive variants.
 * @param {import("react").HTMLAttributes<HTMLDivElement> & {
 *   elevation?: "flat" | "sm" | "md" | "lg",
 *   padding?: "none" | "sm" | "md" | "lg",
 *   interactive?: boolean,
 * }} props
 */
export function Card({ elevation = "sm", padding = "md", interactive = false, className, children, ...rest }) {
  return (
    <div className={cn(cardVariants({ elevation, padding, interactive }), className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Header block inside a Card.
 * @param {import("react").HTMLAttributes<HTMLDivElement>} props
 */
export function CardHeader({ className, children, ...rest }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-3 border-b border-border-subtle", className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Card heading title.
 * @param {import("react").HTMLAttributes<HTMLHeadingElement>} props
 */
export function CardTitle({ className, children, ...rest }) {
  return (
    <h3 className={cn("text-base font-bold text-ink tracking-tight leading-snug", className)} {...rest}>
      {children}
    </h3>
  )
}

/**
 * Secondary description text inside CardHeader.
 * @param {import("react").HTMLAttributes<HTMLParagraphElement>} props
 */
export function CardDescription({ className, children, ...rest }) {
  return (
    <p className={cn("text-xs text-ink-muted mt-0.5 leading-relaxed", className)} {...rest}>
      {children}
    </p>
  )
}

/**
 * Body content block inside a Card.
 * @param {import("react").HTMLAttributes<HTMLDivElement>} props
 */
export function CardContent({ className, children, ...rest }) {
  return (
    <div className={cn("pt-4", className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Footer action bar inside a Card.
 * @param {import("react").HTMLAttributes<HTMLDivElement>} props
 */
export function CardFooter({ className, children, ...rest }) {
  return (
    <div className={cn("pt-4 mt-4 border-t border-border-subtle flex items-center justify-end gap-2", className)} {...rest}>
      {children}
    </div>
  )
}
