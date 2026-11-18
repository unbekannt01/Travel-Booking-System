import { forwardRef, useId } from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "../../utils/cn"
import { FOCUS_RING_CLASS } from "./variants"

/**
 * Accessible checkbox with optional label, description, indeterminate state, and 44px mobile hit target.
 * @param {Omit<import("react").InputHTMLAttributes<HTMLInputElement>, "type"> & {
 *   label?: import("react").ReactNode,
 *   description?: import("react").ReactNode,
 *   indeterminate?: boolean,
 * }} props
 */
export const Checkbox = forwardRef(function Checkbox(
  {
    id,
    label,
    description,
    checked,
    defaultChecked,
    indeterminate = false,
    disabled = false,
    className,
    onChange,
    ...rest
  },
  ref,
) {
  const autoId = useId()
  const inputId = id || autoId

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex items-start gap-2.5 min-h-11 sm:min-h-0 py-1.5 sm:py-0.5 select-none",
        disabled ? "opacity-55 cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative inline-flex items-center justify-center mt-0.5 shrink-0">
        <input
          ref={(node) => {
            if (node) node.indeterminate = Boolean(indeterminate)
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
          }}
          id={inputId}
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={onChange}
          className={cn(
            "peer sr-only",
          )}
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            "h-5 w-5 rounded-[var(--yh-radius-xs)] border flex items-center justify-center transition-colors duration-150",
            "border-border-strong bg-surface text-brand-fg",
            "peer-checked:bg-brand peer-checked:border-brand peer-checked:[&>svg]:opacity-100",
            "peer-indeterminate:bg-brand peer-indeterminate:border-brand peer-indeterminate:[&>svg]:opacity-100",
            "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-focus-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface",
            FOCUS_RING_CLASS,
          )}
        >
          {indeterminate ? (
            <Minus size={13} strokeWidth={3} />
          ) : (
            <Check
              size={13}
              strokeWidth={3}
              className="opacity-0 transition-opacity duration-150"
            />
          )}
        </span>
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label ? <span className="text-sm font-medium text-ink leading-snug">{label}</span> : null}
          {description ? (
            <span className="text-xs text-ink-muted leading-snug mt-0.5">{description}</span>
          ) : null}
        </span>
      )}
    </label>
  )
})
