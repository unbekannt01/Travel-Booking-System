import { forwardRef, useId } from "react"
import { cn } from "../../utils/cn"
import { FOCUS_RING_CLASS } from "./variants"

/**
 * Accessible toggle switch (`role="switch"`, `aria-checked`) with 44px mobile touch target.
 * @param {{
 *   checked?: boolean,
 *   onCheckedChange?: (checked: boolean) => void,
 *   disabled?: boolean,
 *   label?: import("react").ReactNode,
 *   description?: import("react").ReactNode,
 *   id?: string,
 *   className?: string,
 *   "aria-label"?: string,
 * }} props
 */
export const Switch = forwardRef(function Switch(
  {
    checked = false,
    onCheckedChange,
    disabled = false,
    label,
    description,
    id,
    className,
    "aria-label": ariaLabel,
    ...rest
  },
  ref,
) {
  const autoId = useId()
  const switchId = id || autoId
  const labelId = `${switchId}-label`
  const descId = `${switchId}-desc`

  const handleClick = () => {
    if (disabled) return
    if (onCheckedChange) onCheckedChange(!checked)
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 min-h-11 sm:min-h-0",
        disabled && "opacity-55",
        className,
      )}
    >
      <button
        ref={ref}
        id={switchId}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={!label ? ariaLabel : undefined}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          checked ? "bg-brand border-brand" : "bg-surface-muted border-border-strong",
          FOCUS_RING_CLASS,
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full shadow-[var(--yh-shadow-xs)] transition-transform duration-150",
            checked
              ? "translate-x-5 bg-brand-fg"
              : "translate-x-1 bg-ink-muted",
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label ? (
            <label
              id={labelId}
              htmlFor={switchId}
              className={cn(
                "text-sm font-medium text-ink leading-snug",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              {label}
            </label>
          ) : null}
          {description ? (
            <span id={descId} className="text-xs text-ink-muted leading-snug">
              {description}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
})
