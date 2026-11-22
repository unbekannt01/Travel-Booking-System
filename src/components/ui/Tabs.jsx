import { useState, useRef, useId } from "react"
import { cn } from "../../utils/cn"
import { FOCUS_RING_CLASS } from "./variants"

/**
 * Accessible Tabs component with WAI-ARIA tablist/tab/tabpanel roles and ArrowLeft/ArrowRight/Home/End keyboard navigation.
 * @param {{
 *   items: Array<{ id: string, label: import("react").ReactNode, icon?: import("react").ReactNode, badge?: import("react").ReactNode, disabled?: boolean, content?: import("react").ReactNode }>,
 *   value?: string,
 *   defaultValue?: string,
 *   onChange?: (id: string) => void,
 *   ariaLabel?: string,
 *   className?: string,
 *   panelClassName?: string,
 * }} props
 */
export function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  ariaLabel = "Tabs",
  className,
  panelClassName,
}) {
  const baseId = useId()
  const tabRefs = useRef({})
  const firstEnabled = items.find((item) => !item.disabled)?.id || items[0]?.id || ""
  const [internalValue, setInternalValue] = useState(defaultValue || firstEnabled)
  const activeId = value !== undefined ? value : internalValue

  const selectTab = (nextId) => {
    if (value === undefined) setInternalValue(nextId)
    if (onChange) onChange(nextId)
  }

  const enabledItems = items.filter((item) => !item.disabled)

  const handleKeyDown = (event, currentId) => {
    if (enabledItems.length === 0) return
    const currentIdx = enabledItems.findIndex((item) => item.id === currentId)
    let nextItem = null

    if (event.key === "ArrowRight") {
      nextItem = enabledItems[(currentIdx + 1) % enabledItems.length]
    } else if (event.key === "ArrowLeft") {
      nextItem = enabledItems[(currentIdx - 1 + enabledItems.length) % enabledItems.length]
    } else if (event.key === "Home") {
      nextItem = enabledItems[0]
    } else if (event.key === "End") {
      nextItem = enabledItems[enabledItems.length - 1]
    }

    if (nextItem) {
      event.preventDefault()
      selectTab(nextItem.id)
      tabRefs.current[nextItem.id]?.focus()
    }
  }

  const activeItem = items.find((item) => item.id === activeId) || items[0]

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-[var(--yh-radius-md)] bg-surface-muted border border-border-subtle"
      >
        {items.map((item) => {
          const isSelected = item.id === activeId
          const tabId = `${baseId}-tab-${item.id}`
          const panelId = item.panelId || `${baseId}-panel-${item.id}`
          const hasPanel = isSelected && (item.content !== undefined || item.panelId !== undefined)

          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={hasPanel ? panelId : undefined}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => !item.disabled && selectTab(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              className={cn(
                "inline-flex items-center gap-2 min-h-11 sm:min-h-9 px-3.5 py-1.5 text-sm font-semibold rounded-[var(--yh-radius-sm)] transition-colors duration-150 cursor-pointer",
                "disabled:opacity-45 disabled:cursor-not-allowed",
                isSelected
                  ? "bg-surface text-ink shadow-[var(--yh-shadow-xs)]"
                  : "text-ink-muted hover:text-ink hover:bg-surface-hover/60",
                FOCUS_RING_CLASS,
              )}
            >
              {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
              <span>{item.label}</span>
              {item.badge !== undefined ? item.badge : null}
            </button>
          )
        })}
      </div>

      {activeItem && activeItem.content !== undefined ? (
        <div
          id={`${baseId}-panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeItem.id}`}
          tabIndex={0}
          className={cn("mt-4 focus:outline-none", panelClassName)}
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  )
}
