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
    isLoading = false,
    loadingText,
    leftIcon,
    rightIcon,
    icon,
    disabled,
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  const isBusy = Boolean(loading || isLoading)
  const resolvedLeftIcon = leftIcon || icon
  const isDisabled = Boolean(disabled || isBusy)

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isBusy || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {isBusy ? (
        <Spinner size="sm" label={loadingText || "Loading"} />
      ) : resolvedLeftIcon ? (
        <span className="shrink-0 inline-flex items-center" aria-hidden="true">
          {resolvedLeftIcon}
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
