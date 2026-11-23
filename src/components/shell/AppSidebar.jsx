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
  Trash2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "../../utils/cn"
import { formatINR } from "../../utils/formatters"
import { Avatar, IconButton, Tooltip, FOCUS_RING_CLASS } from "../ui"
import { NAV_ITEMS, isNavItemActive } from "./shellConfig"

const ICON_MAP = {
  LayoutDashboard,
  Users,
  Contact,
  MapPin,
  Bus,
  TrendingUp,
  ReceiptText,
  ReceiptIndianRupee,
  BookOpen,
  Trash2,
  Settings,
}

/**
 * Desktop collapsible navigation sidebar with company branding, accessible active state,
 * tooltips when collapsed, revenue summary, and operator profile footer.
 * @param {{
 *   activeTab: string,
 *   onSelectTab: (tabId: string) => void,
 *   onPrefetchTab?: (tabId: string) => void,
 *   collapsed: boolean,
 *   onToggleCollapsed: () => void,
 *   user: { userName?: string, email?: string } | null,
 *   companySettings?: { companyName?: string, companyTagline?: string, companyLogo?: string },
 *   totalRevenue?: number,
 *   onLogout: () => void,
 * }} props
 */
export function AppSidebar({
  activeTab,
  onSelectTab,
  onPrefetchTab,
  collapsed,
  onToggleCollapsed,
  user,
  companySettings,
  totalRevenue = 0,
  onLogout,
}) {
  const companyName = companySettings?.companyName || user?.companyName || "YatraHub"
  const companyTagline = companySettings?.companyTagline || "Tour Operations"
  const companyLogo = companySettings?.companyLogo || user?.companyLogo || ""
  const displayName = user?.userName || "Operator"
  const displayEmail = user?.email || ""

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        "hidden lg:flex flex-col shrink-0 h-full bg-surface border-r border-border-subtle",
        "transition-[width] duration-200 ease-out select-none",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      {/* Brand + Collapse Button */}
      <div
        className={cn(
          "h-16 px-3 flex items-center border-b border-border-subtle shrink-0",
          collapsed ? "justify-center" : "justify-between gap-2",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="h-9 w-9 rounded-[var(--yh-radius-md)] object-contain bg-surface-muted border border-border-subtle p-0.5 shrink-0"
              />
            ) : (
              <Avatar name={companyName} size="sm" tone="accent" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink truncate leading-tight">{companyName}</p>
              <p className="text-[11px] font-medium text-ink-muted truncate leading-tight mt-0.5">
                {companyTagline}
              </p>
            </div>
          </div>
        )}

        <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <IconButton
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </IconButton>
        </Tooltip>
      </div>

      {/* Collapsed Brand Avatar */}
      {collapsed && (
        <div className="py-3 flex justify-center border-b border-border-subtle">
          <Tooltip content={companyName} side="right">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="h-9 w-9 rounded-[var(--yh-radius-md)] object-contain bg-surface-muted border border-border-subtle p-0.5"
              />
            ) : (
              <Avatar name={companyName} size="sm" tone="accent" />
            )}
          </Tooltip>
        </div>
      )}

      {/* Primary Nav Links */}
      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.iconName] || LayoutDashboard
          const active = isNavItemActive(item.id, activeTab)

          const navButton = (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              onClick={() => onSelectTab(item.id)}
              onMouseEnter={() => onPrefetchTab && onPrefetchTab(item.id)}
              onFocus={() => onPrefetchTab && onPrefetchTab(item.id)}
              className={cn(
                "relative w-full flex items-center rounded-[var(--yh-radius-md)] min-h-11 transition-colors duration-150 cursor-pointer",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
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
              <Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden="true" className="shrink-0" />
              {!collapsed ? <span className="text-sm truncate">{item.label}</span> : null}
            </button>
          )

          return collapsed ? (
            <Tooltip key={item.id} content={item.label} side="right" className="w-full flex justify-center">
              {navButton}
            </Tooltip>
          ) : (
            navButton
          )
        })}
      </nav>

      {/* Revenue Summary Pill (expanded only) */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="rounded-[var(--yh-radius-md)] bg-surface-muted border border-border-subtle px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Total Bookings Value
            </p>
            <p className="text-lg font-bold text-ink tabular-nums mt-0.5 leading-tight">
              {formatINR(totalRevenue, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Operator Profile & Sign Out */}
      <div className="p-3 border-t border-border-subtle shrink-0">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip content={`${displayName}${displayEmail ? ` (${displayEmail})` : ""}`} side="right">
              <Avatar name={displayName} size="sm" tone="primary" />
            </Tooltip>
            <Tooltip content="Sign out" side="right">
              <IconButton aria-label="Sign out" variant="danger" size="sm" onClick={onLogout}>
                <LogOut size={16} />
              </IconButton>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Avatar name={displayName} size="sm" tone="primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink truncate leading-tight">{displayName}</p>
              {displayEmail ? (
                <p className="text-[11px] text-ink-muted truncate leading-tight mt-0.5">
                  {displayEmail}
                </p>
              ) : null}
            </div>
            <Tooltip content="Sign out" side="top">
              <IconButton aria-label="Sign out" variant="ghost" size="sm" onClick={onLogout}>
                <LogOut size={16} />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  )
}
