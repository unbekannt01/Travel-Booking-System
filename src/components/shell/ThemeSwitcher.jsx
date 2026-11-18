import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "../../theme"
import { cn } from "../../utils/cn"
import { FOCUS_RING_CLASS } from "../ui"

const OPTIONS = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
]

/**
 * Accessible segmented Light / Dark / System theme switcher wired to useTheme().
 * @param {{ compact?: boolean, className?: string }} props
 */
export function ThemeSwitcher({ compact = false, className }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center gap-0.5 p-1 rounded-[var(--yh-radius-md)] bg-surface-muted border border-border-subtle",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const IconComp = opt.Icon
        const active = theme === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            aria-label={`${opt.label} theme`}
            onClick={() => setTheme(opt.id)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors duration-150 cursor-pointer",
              compact ? "min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 px-2" : "min-h-11 sm:min-h-8 px-2.5",
              active
                ? "bg-surface text-ink shadow-[var(--yh-shadow-xs)]"
                : "text-ink-muted hover:text-ink hover:bg-surface-hover/60",
              FOCUS_RING_CLASS,
            )}
          >
            <IconComp size={14} aria-hidden="true" />
            {!compact ? <span>{opt.label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
