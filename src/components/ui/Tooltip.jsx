import { useState, useId, useEffect } from "react"
import { cn } from "../../utils/cn"

const SIDE_CLASSES = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
}

/**
 * Accessible hover & keyboard-focus tooltip (`role="tooltip"`, Escape dismissible).
 * @param {{
 *   content: import("react").ReactNode,
 *   side?: "top" | "bottom" | "left" | "right",
 *   className?: string,
 *   children: import("react").ReactNode,
 * }} props
 */
export function Tooltip({ content, side = "top", className, children }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  if (!content) return children

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[var(--yh-z-tooltip)] whitespace-nowrap",
            "rounded-[var(--yh-radius-sm)] px-2.5 py-1.5 text-xs font-medium",
            "bg-ink text-surface shadow-[var(--yh-shadow-md)]",
            SIDE_CLASSES[side] || SIDE_CLASSES.top,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
