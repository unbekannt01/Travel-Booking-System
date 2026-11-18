import { forwardRef } from "react"
import { Search, X } from "lucide-react"
import { Input } from "./Input"
import { FOCUS_RING_CLASS } from "./variants"
import { cn } from "../../utils/cn"

/**
 * Search input primitive with magnifying-glass icon, clear button, and Escape-to-clear keyboard behavior.
 * @param {Omit<import("react").InputHTMLAttributes<HTMLInputElement>, "size"> & {
 *   value: string,
 *   onChange: (event: import("react").ChangeEvent<HTMLInputElement>) => void,
 *   onClear?: () => void,
 *   size?: "sm" | "md" | "lg",
 *   clearLabel?: string,
 *   wrapperClassName?: string,
 * }} props
 */
export const SearchInput = forwardRef(function SearchInput(
  {
    value = "",
    onChange,
    onClear,
    placeholder = "Search...",
    size = "md",
    clearLabel = "Clear search",
    onKeyDown,
    className,
    wrapperClassName,
    ...rest
  },
  ref,
) {
  const handleClear = () => {
    if (onClear) {
      onClear()
    } else if (onChange) {
      onChange({ target: { value: "" } })
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && value) {
      event.stopPropagation()
      handleClear()
    }
    if (onKeyDown) onKeyDown(event)
  }

  return (
    <Input
      ref={ref}
      type="search"
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      size={size}
      leading={<Search size={16} />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label={clearLabel}
            className={cn(
              "inline-flex items-center justify-center rounded-full p-1 text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors cursor-pointer",
              FOCUS_RING_CLASS,
            )}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null
      }
      className={cn("[&::-webkit-search-cancel-button]:hidden", className)}
      wrapperClassName={wrapperClassName}
      {...rest}
    />
  )
})
