import { useState, useRef, useEffect } from "react"
import { Menu, Plus, Settings, LogOut, ChevronDown } from "lucide-react"
import { cn } from "../../utils/cn"
import { Avatar, Button, IconButton, SearchInput, FOCUS_RING_CLASS } from "../ui"
import { SHOW_THEME_TOGGLE } from "./shellConfig"
import { ThemeSwitcher } from "./ThemeSwitcher"

/**
 * Sticky top bar with mobile drawer trigger, current page title, global booking search,
 * prominent New Booking CTA, gated ThemeSwitcher, and accessible user menu.
 * @param {{
 *   pageTitle: string,
 *   searchTerm: string,
 *   setSearchTerm: (val: string) => void,
 *   showSearch?: boolean,
 *   onOpenMobileMenu: () => void,
 *   onNewBooking: () => void,
 *   onPrefetchNewBooking?: () => void,
 *   onOpenSettings: () => void,
 *   onLogout: () => void,
 *   user: { userName?: string, email?: string } | null,
 * }} props
 */
export function AppTopBar({
  pageTitle,
  searchTerm,
  setSearchTerm,
  showSearch = true,
  onOpenMobileMenu,
  onNewBooking,
  onPrefetchNewBooking,
  onOpenSettings,
  onLogout,
  user,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuContainerRef = useRef(null)
  const displayName = user?.userName || "Operator"
  const displayEmail = user?.email || ""

  useEffect(() => {
    if (!menuOpen) return
    const handleOutside = (event) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const handleEsc = (event) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", handleOutside)
    document.addEventListener("keydown", handleEsc)
    return () => {
      document.removeEventListener("mousedown", handleOutside)
      document.removeEventListener("keydown", handleEsc)
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-[var(--yh-z-sticky)] bg-surface/95 backdrop-blur border-b border-border-subtle shrink-0">
      <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        {/* Left: Mobile Drawer Button + Current Page Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="lg:hidden">
            <IconButton
              aria-label="Open navigation menu"
              variant="ghost"
              size="md"
              onClick={onOpenMobileMenu}
            >
              <Menu size={20} />
            </IconButton>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-ink tracking-tight truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Center: Global Booking Search (desktop) */}
        {showSearch && (
          <div className="hidden md:block flex-1 max-w-md mx-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
              placeholder="Search invoices, tours, or traveler names..."
              size="sm"
              aria-label="Search bookings"
            />
          </div>
        )}

        {/* Right: Theme Switcher (gated), New Booking CTA, User Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {SHOW_THEME_TOGGLE ? <ThemeSwitcher compact className="hidden sm:inline-flex" /> : null}

          <Button
            variant="accent"
            size="sm"
            leftIcon={<Plus size={16} strokeWidth={2.5} />}
            onClick={onNewBooking}
            onMouseEnter={onPrefetchNewBooking}
            onFocus={onPrefetchNewBooking}
            className="hidden sm:inline-flex"
          >
            New Booking
          </Button>

          {/* Accessible User Dropdown Menu */}
          <div ref={menuContainerRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              onClick={() => setMenuOpen((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-2 min-h-11 sm:min-h-9 px-2 rounded-[var(--yh-radius-md)]",
                "hover:bg-surface-muted transition-colors duration-150 cursor-pointer",
                FOCUS_RING_CLASS,
              )}
            >
              <Avatar name={displayName} size="sm" tone="primary" />
              <span className="hidden xl:inline text-xs font-semibold text-ink max-w-[120px] truncate">
                {displayName}
              </span>
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn("hidden sm:inline text-ink-muted transition-transform duration-150", menuOpen && "rotate-180")}
              />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                aria-label="Account options"
                className="absolute right-0 mt-2 w-56 rounded-[var(--yh-radius-lg)] bg-surface-elevated border border-border-subtle shadow-[var(--yh-shadow-lg)] py-1.5 z-[var(--yh-z-dropdown)]"
              >
                <div className="px-3.5 py-2.5 border-b border-border-subtle">
                  <p className="text-xs font-bold text-ink truncate">{displayName}</p>
                  {displayEmail ? (
                    <p className="text-[11px] text-ink-muted truncate mt-0.5">{displayEmail}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenSettings()
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 min-h-11 sm:min-h-9 text-sm font-medium text-ink-secondary hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer",
                    FOCUS_RING_CLASS,
                  )}
                >
                  <Settings size={15} aria-hidden="true" />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onLogout()
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 min-h-11 sm:min-h-9 text-sm font-semibold text-danger-text hover:bg-danger-soft transition-colors cursor-pointer",
                    FOCUS_RING_CLASS,
                  )}
                >
                  <LogOut size={15} aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar (shown on overview when small screen) */}
      {showSearch && (
        <div className="md:hidden px-4 pb-3">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm("")}
            placeholder="Search bookings..."
            size="sm"
            aria-label="Search bookings"
          />
        </div>
      )}
    </header>
  )
}
