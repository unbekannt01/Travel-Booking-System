import { useState, useRef, useEffect, useCallback } from "react"
import {
  LayoutDashboard,
  Users,
  Contact,
  MapPin,
  Bus,
  TrendingUp,
  ReceiptText,
  ReceiptIndianRupee,
  BookOpen,
  Settings,
  LogOut,
  Plus,
  AlertTriangle,
} from "lucide-react"
import { cn } from "../../utils/cn"
import { formatINR } from "../../utils/formatters"
import { Avatar, Button, Drawer, PageHeader, FOCUS_RING_CLASS } from "../ui"
import { subscribeApiStatus, checkApiHealth } from "../../data/client"
import {
  NAV_ITEMS,
  SHOW_THEME_TOGGLE,
  resolvePageMeta,
  isNavItemActive,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "./shellConfig"
import { AppSidebar } from "./AppSidebar"
import { AppTopBar } from "./AppTopBar"
import { MobileBottomNav } from "./MobileBottomNav"
import { ThemeSwitcher } from "./ThemeSwitcher"

const DRAWER_ICONS = {
  LayoutDashboard,
  Users,
  Contact,
  MapPin,
  Bus,
  TrendingUp,
  ReceiptText,
  ReceiptIndianRupee,
  BookOpen,
  Settings,
}

/**
 * Accessible YatraHub application shell with skip link, landmarks, collapsible desktop sidebar,
 * mobile Drawer + bottom nav, top bar with New Booking CTA, and live route announcements.
 * @param {{
 *   activeTab: string,
 *   onSelectTab: (tabId: string) => void,
 *   onPrefetchTab?: (tabId: string) => void,
 *   isEditingBooking?: boolean,
 *   searchTerm: string,
 *   setSearchTerm: (val: string) => void,
 *   onNewBooking: () => void,
 *   user: { userName?: string, email?: string, companyName?: string, companyLogo?: string } | null,
 *   companySettings?: { companyName?: string, companyTagline?: string, companyLogo?: string },
 *   totalRevenue?: number,
 *   onLogout: () => void,
 *   children: import("react").ReactNode,
 * }} props
 */
export function AppShell({
  activeTab,
  onSelectTab,
  onPrefetchTab,
  isEditingBooking = false,
  searchTerm,
  setSearchTerm,
  onNewBooking,
  user,
  companySettings,
  totalRevenue = 0,
  onLogout,
  children,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [isApiReachable, setIsApiReachable] = useState(true)
  const [retryingApi, setRetryingApi] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeApiStatus((reachable) => {
      setIsApiReachable(reachable)
    })
    return () => unsubscribe()
  }, [])

  const handleRetryApi = useCallback(async () => {
    setRetryingApi(true)
    try {
      const ok = await checkApiHealth()
      setIsApiReachable(ok)
    } finally {
      setRetryingApi(false)
    }
  }, [])

  const mainRef = useRef(null)
  const isFirstRenderRef = useRef(true)

  const pageMeta = resolvePageMeta(activeTab, { isEditingBooking })
  const companyName = companySettings?.companyName || user?.companyName || "YatraHub"
  const displayName = user?.userName || "Operator"
  const displayEmail = user?.email || ""

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      writeSidebarCollapsed(next)
      return next
    })
  }, [])

  const handleSelectDestination = useCallback(
    (tabId) => {
      setDrawerOpen(false)
      onSelectTab(tabId)
    },
    [onSelectTab],
  )

  const handleTriggerNewBooking = useCallback(() => {
    setDrawerOpen(false)
    onNewBooking()
  }, [onNewBooking])

  // Move focus & scroll top on route change + announce new page title to screen readers
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    setAnnouncement(`Navigated to ${pageMeta.title}`)
    const mainEl = mainRef.current
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: "smooth" })
      mainEl.focus({ preventScroll: true })
    }
  }, [activeTab, pageMeta.title])

  return (
    <div className="flex h-screen bg-canvas text-ink font-sans overflow-hidden">
      {/* Skip to main content — first focusable element */}
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[var(--yh-z-tooltip)]",
          "px-4 py-2.5 rounded-[var(--yh-radius-md)] bg-brand text-brand-fg text-sm font-bold shadow-[var(--yh-shadow-lg)]",
          FOCUS_RING_CLASS,
        )}
      >
        Skip to main content
      </a>

      {/* Live region announcing navigation changes */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Desktop Collapsible Sidebar */}
      <AppSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectDestination}
        onPrefetchTab={onPrefetchTab}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={handleToggleSidebar}
        user={user}
        companySettings={companySettings}
        totalRevenue={totalRevenue}
        onLogout={onLogout}
      />

      {/* Right Column: Sticky Top Bar + Scrollable Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <AppTopBar
          pageTitle={pageMeta.title}
          hideTitleOnDesktop={!pageMeta.hasOwnHeading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showSearch={activeTab === "dashboard"}
          onOpenMobileMenu={() => setDrawerOpen(true)}
          onNewBooking={handleTriggerNewBooking}
          onPrefetchNewBooking={() => onPrefetchTab && onPrefetchTab("form")}
          onOpenSettings={() => handleSelectDestination("settings")}
          onLogout={onLogout}
          user={user}
        />

        {/* API-unreachable status banner (Task F) */}
        {!isApiReachable && (
          <div
            role="status"
            aria-live="polite"
            className="bg-warning-soft border-b border-warning-border px-4 py-2.5 text-xs font-semibold text-warning-text flex items-center justify-between gap-3 shrink-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={15} className="text-warning-text shrink-0" />
              <span className="truncate">Cannot connect to server. Please verify local MongoDB and backend service.</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs px-2.5 shrink-0"
              disabled={retryingApi}
              onClick={handleRetryApi}
            >
              {retryingApi ? "Retrying..." : "Retry Connection"}
            </Button>
          </div>
        )}

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-canvas focus:outline-none pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8"
        >
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {!pageMeta.hasOwnHeading ? (
              <PageHeader title={pageMeta.title} subtitle={pageMeta.description} />
            ) : null}
            {children}
          </div>
        </main>
      </div>

      {/* Mobile & Tablet Navigation Drawer (focus-trapped, Escape-dismissible) */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="left"
        title={companyName}
        description={companySettings?.companyTagline || "Tour Operations"}
        footer={
          <Button variant="danger" size="md" fullWidth leftIcon={<LogOut size={16} />} onClick={onLogout}>
            Sign Out
          </Button>
        }
      >
        <div className="space-y-5">
          <Button
            variant="accent"
            size="md"
            fullWidth
            leftIcon={<Plus size={18} strokeWidth={2.5} />}
            onClick={handleTriggerNewBooking}
          >
            New Booking
          </Button>

          <nav aria-label="Mobile drawer navigation" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = DRAWER_ICONS[item.iconName] || LayoutDashboard
              const active = isNavItemActive(item.id, activeTab)
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => handleSelectDestination(item.id)}
                  className={cn(
                    "relative w-full flex items-center gap-3 px-3.5 min-h-11 rounded-[var(--yh-radius-md)] text-sm transition-colors cursor-pointer",
                    active
                      ? "bg-brand-soft text-brand font-bold"
                      : "text-ink-secondary font-medium hover:bg-surface-hover hover:text-ink",
                    FOCUS_RING_CLASS,
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent-warm"
                    />
                  ) : null}
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {SHOW_THEME_TOGGLE ? (
            <div className="pt-3 border-t border-border-subtle">
              <p className="text-xs font-semibold text-ink-muted mb-2">Appearance</p>
              <ThemeSwitcher />
            </div>
          ) : null}

          <div className="rounded-[var(--yh-radius-md)] bg-surface-muted border border-border-subtle px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Total Bookings Value
            </p>
            <p className="text-lg font-bold text-ink tabular-nums mt-0.5">
              {formatINR(totalRevenue, 0)}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-border-subtle">
            <Avatar name={displayName} size="md" tone="primary" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink truncate">{displayName}</p>
              {displayEmail ? (
                <p className="text-xs text-ink-muted truncate">{displayEmail}</p>
              ) : null}
            </div>
          </div>
        </div>
      </Drawer>

      {/* Mobile & Tablet Bottom Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectDestination}
        onNewBooking={handleTriggerNewBooking}
        onOpenMore={() => setDrawerOpen(true)}
      />
    </div>
  )
}
