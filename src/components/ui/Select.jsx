import { forwardRef } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../utils/cn"
import { inputVariants } from "./variants"

/**
 * Accessible native select control styled with YatraHub tokens and custom chevron.
 * @param {Omit<import("react").SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
 *   size?: "sm" | "md" | "lg",
 *   invalid?: boolean,
 *   wrapperClassName?: string,
 * }} props
 */
export const Select = forwardRef(function Select(
  { size = "md", invalid = false, className, wrapperClassName, children, ...rest },
  ref,
) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputVariants({ size, invalid }),
          "appearance-none pr-9 cursor-pointer",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
})
