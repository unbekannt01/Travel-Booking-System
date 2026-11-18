import { cn } from "../../utils/cn"

const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-[3px]",
}

/**
 * Accessible loading spinner.
 * @param {{ size?: "sm" | "md" | "lg", label?: string, className?: string }} props
 */
export function Spinner({ size = "md", label = "Loading", className }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block shrink-0 rounded-full border-current border-t-transparent animate-spin",
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className,
      )}
    />
  )
}
