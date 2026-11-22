import { useId } from "react"
import { cn } from "../../utils/cn"

/**
 * Form field wrapper pairing a label, optional required mark, hint text, and accessible error message.
 * Supports passing a render function `children({ id, describedBy, invalid })` or standard JSX children.
 * @param {{
 *   id?: string,
 *   label?: import("react").ReactNode,
 *   hint?: import("react").ReactNode,
 *   error?: import("react").ReactNode,
 *   required?: boolean,
 *   className?: string,
 *   children: import("react").ReactNode | ((attrs: { id: string, describedBy?: string, invalid: boolean }) => import("react").ReactNode),
 * }} props
 */
export function Field({
  id,
  htmlFor,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}) {
  const autoId = useId()
  const fieldId = id || htmlFor || autoId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  const describedByParts = []
  if (hint) describedByParts.push(hintId)
  if (error) describedByParts.push(errorId)
  const describedBy = describedByParts.length > 0 ? describedByParts.join(" ") : undefined
  const invalid = Boolean(error)

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {label ? (
        <label
          htmlFor={fieldId}
          className="text-xs font-semibold text-ink-secondary tracking-wide flex items-center gap-1"
        >
          <span>{label}</span>
          {required ? (
            <span className="text-danger-text" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {typeof children === "function" ? children({ id: fieldId, describedBy, invalid }) : children}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
