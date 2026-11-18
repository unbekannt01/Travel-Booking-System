import { LayoutDashboard, Users, Plus, MapPin, MoreHorizontal } from "lucide-react"
import { cn } from "../../utils/cn"
import { FOCUS_RING_CLASS } from "../ui"
import { isNavItemActive, isMoreDestinationActive } from "./shellConfig"

/**
 * Mobile & tablet bottom navigation bar with 4 primary actions + center New Booking button.
 * All touch targets meet >= 44px height & width.
 * @param {{
 *   activeTab: string,
 *   onSelectTab: (tabId: string) => void,
 *   onNewBooking: () => void,
 *   onOpenMore: () => void,
 * }} props
 */
export function MobileBottomNav({ activeTab, onSelectTab, onNewBooking, onOpenMore }) {
  const moreActive = isMoreDestinationActive(activeTab)
  const formActive = activeTab === "form"

  const renderTab = (id, label, iconRenderer) => {
    const active = isNavItemActive(id, activeTab)
    return (
      <button
        key={id}
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => onSelectTab(id)}
        className={cn(
          "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-14 py-1.5 text-[11px] transition-colors cursor-pointer",
          active ? "text-brand font-bold" : "text-ink-muted font-medium hover:text-ink",
          FOCUS_RING_CLASS,
        )}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent-warm"
          />
        ) : null}
        {iconRenderer(active)}
        <span className="truncate">{label}</span>
      </button>
    )
  }

  return (
    <nav
      aria-label="Mobile quick navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-[var(--yh-z-sticky)] bg-surface/95 backdrop-blur border-t border-border-subtle pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-1">
        {renderTab("dashboard", "Overview", (active) => (
          <LayoutDashboard size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
        ))}
        {renderTab("passengers", "Travelers", (active) => (
          <Users size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
        ))}

        {/* Center Primary Action: New Booking */}
        <div className="flex flex-col items-center justify-center flex-1 py-1">
          <button
            type="button"
            aria-label="New Booking"
            aria-current={formActive ? "page" : undefined}
            onClick={onNewBooking}
            className={cn(
              "inline-flex items-center justify-center h-11 w-11 rounded-full shadow-[var(--yh-shadow-md)] transition-transform duration-150 active:scale-95 cursor-pointer",
              "bg-accent-warm text-accent-warm-fg hover:bg-accent-warm-hover",
              FOCUS_RING_CLASS,
            )}
          >
            <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <span className="text-[10px] font-bold text-accent-warm-text leading-tight mt-0.5">
            Book
          </span>
        </div>

        {renderTab("journey", "Journeys", (active) => (
          <MapPin size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
        ))}

        <button
          type="button"
          aria-label="More destinations"
          onClick={onOpenMore}
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-14 py-1.5 text-[11px] transition-colors cursor-pointer",
            moreActive ? "text-brand font-bold" : "text-ink-muted font-medium hover:text-ink",
            FOCUS_RING_CLASS,
          )}
        >
          {moreActive ? (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent-warm"
            />
          ) : null}
          <MoreHorizontal size={20} strokeWidth={moreActive ? 2.4 : 2} aria-hidden="true" />
          <span>More</span>
        </button>
      </div>
    </nav>
  )
}
