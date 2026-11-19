/**
 * App shell configuration, navigation items, page metadata, and sidebar persistence.
 * Pure JS (no JSX) so it can be unit-tested directly with node:test.
 */

/**
 * Single feature flag gating the user-facing Light/Dark/System theme switcher in the shell.
 * Kept false until Part 3.5 finishes migrating inner screens to Design System v2 tokens.
 */
export const SHOW_THEME_TOGGLE = false

export const SIDEBAR_STORAGE_KEY = "yatrahub-sidebar-collapsed"

/**
 * Primary navigation destinations preserving exact Dashboard activeTab IDs.
 */
export const NAV_ITEMS = Object.freeze([
  {
    id: "dashboard",
    label: "Overview",
    title: "Overview",
    description: "Daily bookings, collections, and upcoming departures.",
    iconName: "LayoutDashboard",
    hasOwnHeading: false,
    mobilePrimary: true,
  },
  {
    id: "passengers",
    label: "Travelers",
    title: "Travelers",
    description: "Manage passenger rosters, Aadhaar details, and booking edits.",
    iconName: "Users",
    hasOwnHeading: false,
    mobilePrimary: true,
  },
  {
    id: "journey",
    label: "Journeys",
    title: "Journeys",
    description: "Coordinate departures, boarding check-ins, and coach manifests.",
    iconName: "MapPin",
    hasOwnHeading: false,
    mobilePrimary: true,
  },
  {
    id: "tours",
    label: "Destinations",
    title: "Destinations",
    description: "Configure tour routes, bus layouts, and berth pricing.",
    iconName: "Bus",
    hasOwnHeading: false,
    mobilePrimary: false,
  },
  {
    id: "analytics",
    label: "Analytics",
    title: "Analytics",
    description: "Track tour revenue, occupancy, and seasonal performance.",
    iconName: "TrendingUp",
    hasOwnHeading: true,
    mobilePrimary: false,
  },
  {
    id: "settings",
    label: "Settings",
    title: "Settings",
    description: "Company branding, GST details, ticket templates, and 2FA security.",
    iconName: "Settings",
    hasOwnHeading: true,
    mobilePrimary: false,
  },
])

export const FORM_ROUTE_META = Object.freeze({
  id: "form",
  label: "New Booking",
  title: "New Booking",
  editTitle: "Edit Booking",
  description: "Create or update a passenger reservation and allocate seats.",
  hasOwnHeading: false,
})

/**
 * Resolves metadata (title, description, hasOwnHeading) for the active tab.
 * @param {string} activeTab
 * @param {{ isEditingBooking?: boolean }} [options]
 * @returns {{ id: string, title: string, description: string, hasOwnHeading: boolean }}
 */
export function resolvePageMeta(activeTab, options = {}) {
  if (activeTab === "form") {
    return {
      id: "form",
      title: options.isEditingBooking ? FORM_ROUTE_META.editTitle : FORM_ROUTE_META.title,
      description: FORM_ROUTE_META.description,
      hasOwnHeading: FORM_ROUTE_META.hasOwnHeading,
    }
  }
  const found = NAV_ITEMS.find((item) => item.id === activeTab)
  if (found) {
    return {
      id: found.id,
      title: found.title,
      description: found.description,
      hasOwnHeading: found.hasOwnHeading,
    }
  }
  const fallback = NAV_ITEMS[0]
  return {
    id: fallback.id,
    title: fallback.title,
    description: fallback.description,
    hasOwnHeading: fallback.hasOwnHeading,
  }
}

/**
 * Checks whether a given nav item matches the active tab.
 * @param {string} itemId
 * @param {string} activeTab
 * @returns {boolean}
 */
export function isNavItemActive(itemId, activeTab) {
  return itemId === activeTab
}

/**
 * Checks whether the mobile "More" drawer holds the currently active tab.
 * @param {string} activeTab
 * @returns {boolean}
 */
export function isMoreDestinationActive(activeTab) {
  return NAV_ITEMS.some((item) => !item.mobilePrimary && item.id === activeTab)
}

/**
 * Safely reads sidebar collapsed state from storage. Falls back to false on error.
 * @param {Pick<Storage, "getItem"> | null | undefined} [storage]
 * @returns {boolean}
 */
export function readSidebarCollapsed(storage) {
  const store = storage === undefined ? getDefaultStorage() : storage
  if (!store || typeof store.getItem !== "function") return false
  try {
    return store.getItem(SIDEBAR_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Safely persists sidebar collapsed state to storage. Never throws if storage is blocked.
 * @param {boolean} collapsed
 * @param {Pick<Storage, "setItem"> | null | undefined} [storage]
 * @returns {boolean}
 */
export function writeSidebarCollapsed(collapsed, storage) {
  const store = storage === undefined ? getDefaultStorage() : storage
  if (!store || typeof store.setItem !== "function") return false
  try {
    store.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "true" : "false")
    return true
  } catch {
    return false
  }
}

/**
 * Maps a Dashboard tab ID to the most appropriate PageSkeleton shape.
 * @param {string} activeTab
 * @returns {"dashboard" | "table" | "form" | "analytics" | "settings"}
 */
export function getSkeletonVariant(activeTab) {
  switch (activeTab) {
    case "form":
      return "form"
    case "settings":
      return "settings"
    case "analytics":
      return "analytics"
    case "passengers":
    case "tours":
    case "journey":
      return "table"
    case "dashboard":
    default:
      return "dashboard"
  }
}

function getDefaultStorage() {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
