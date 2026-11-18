import { forwardRef } from "react"
import { cn } from "../../utils/cn"
import { inputVariants } from "./variants"

/**
 * Text/number input primitive with optional leading/trailing icons and tabular numbers mode.
 * @param {Omit<import("react").InputHTMLAttributes<HTMLInputElement>, "size"> & {
 *   size?: "sm" | "md" | "lg",
 *   invalid?: boolean,
 *   tabular?: boolean,
 *   leading?: import("react").ReactNode,
 *   trailing?: import("react").ReactNode,
 *   wrapperClassName?: string,
 * }} props
 */
export const Input = forwardRef(function Input(
  {
    size = "md",
    invalid = false,
    tabular = false,
    leading,
    trailing,
    className,
    wrapperClassName,
    ...rest
  },
  ref,
) {
  if (!leading && !trailing) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(inputVariants({ size, invalid }), tabular && "tabular-nums", className)}
        {...rest}
      />
    )
  }

  return (
    <div className={cn("relative flex items-center w-full", wrapperClassName)}>
      {leading ? (
        <span
          className="pointer-events-none absolute left-3 inline-flex items-center text-ink-muted"
          aria-hidden="true"
        >
          {leading}
        </span>
      ) : null}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputVariants({ size, invalid }),
          tabular && "tabular-nums",
          leading && "pl-9",
          trailing && "pr-9",
          className,
        )}
        {...rest}
      />
      {trailing ? (
        <span className="absolute right-2.5 inline-flex items-center text-ink-muted">
          {trailing}
        </span>
      ) : null}
    </div>
  )
})
