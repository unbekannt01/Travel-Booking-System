import { forwardRef } from "react"
import { cn } from "../../utils/cn"
import { iconButtonVariants } from "./variants"
import { Spinner } from "./Spinner"

/**
 * Accessible icon-only button. Always requires `aria-label` (44px min touch target on mobile).
 * @param {import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
 *   "aria-label": string,
 *   variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger",
 *   size?: "sm" | "md" | "lg",
 *   loading?: boolean,
 * }} props
 */
export const IconButton = forwardRef(function IconButton(
  {
    "aria-label": ariaLabel,
    variant = "ghost",
    size = "md",
    loading = false,
    disabled,
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  if (import.meta.env?.DEV && !ariaLabel) {
    console.warn("IconButton requires a non-empty aria-label for screen-reader accessibility.")
  }

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      disabled={Boolean(disabled || loading)}
      aria-busy={loading || undefined}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" label={ariaLabel || "Loading"} />
      ) : (
        <span className="inline-flex items-center justify-center" aria-hidden="true">
          {children}
        </span>
      )}
    </button>
  )
})
