import { forwardRef } from "react"
import { cn } from "../../utils/cn"
import { inputVariants } from "./variants"

/**
 * Multi-line textarea primitive with consistent border, focus ring, and error states.
 * @param {import("react").TextareaHTMLAttributes<HTMLTextAreaElement> & {
 *   invalid?: boolean,
 * }} props
 */
export const Textarea = forwardRef(function Textarea(
  { invalid = false, rows = 3, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        inputVariants({ size: "md", invalid }),
        "min-h-[88px] py-2.5 resize-y leading-relaxed",
        className,
      )}
      {...rest}
    />
  )
})
