import { forwardRef } from "react"
import { cn } from "../../utils/cn"
import { buttonVariants } from "./variants"
import { Spinner } from "./Spinner"

/**
 * Primary interactive button primitive with variants, sizes, loading state, and 44px mobile touch targets.
 * @param {import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
 *   variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "success",
 *   size?: "sm" | "md" | "lg",
 *   fullWidth?: boolean,
 *   loading?: boolean,
 *   loadingText?: string,
 *   leftIcon?: import("react").ReactNode,
 *   rightIcon?: import("react").ReactNode,
 * }} props
 */
export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    loadingText,
    leftIcon,
    rightIcon,
    disabled,
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = Boolean(disabled || loading)

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" label={loadingText || "Loading"} />
      ) : leftIcon ? (
        <span className="shrink-0 inline-flex items-center" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && rightIcon ? (
        <span className="shrink-0 inline-flex items-center" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </button>
  )
})
