import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  SHOW_THEME_TOGGLE,
  SIDEBAR_STORAGE_KEY,
  NAV_ITEMS,
  resolvePageMeta,
  isNavItemActive,
  isMoreDestinationActive,
  getSkeletonVariant,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "../src/components/shell/shellConfig.js"

describe("App Shell & Navigation Configuration (Part 3.2)", () => {
  describe("Navigation destinations & theme toggle flag", () => {
    it("preserves all 6 exact Dashboard tab IDs and labels", () => {
      assert.deepEqual(
        NAV_ITEMS.map((item) => ({ id: item.id, label: item.label })),
        [
          { id: "dashboard", label: "Overview" },
          { id: "passengers", label: "Travelers" },
          { id: "journey", label: "Journeys" },
          { id: "tours", label: "Destinations" },
          { id: "analytics", label: "Analytics" },
          { id: "settings", label: "Settings" },
        ],
      )
    })

    it("enables SHOW_THEME_TOGGLE (true) now that all inner screens have migrated to tokens", () => {
      assert.equal(SHOW_THEME_TOGGLE, true)
    })
  })

  describe("Page metadata & active-route resolution", () => {
    it("maps each tab ID to its title and description and falls back to Overview", () => {
      assert.equal(resolvePageMeta("dashboard").title, "Overview")
      assert.equal(resolvePageMeta("passengers").title, "Travelers")
      assert.equal(resolvePageMeta("journey").title, "Journeys")
      assert.equal(resolvePageMeta("tours").title, "Destinations")
      assert.equal(resolvePageMeta("analytics").title, "Analytics")
      assert.equal(resolvePageMeta("settings").title, "Settings")
      assert.equal(resolvePageMeta("nonexistent").title, "Overview")
    })

    it("distinguishes New Booking vs Edit Booking titles on the form route", () => {
      assert.equal(resolvePageMeta("form", { isEditingBooking: false }).title, "New Booking")
      assert.equal(resolvePageMeta("form", { isEditingBooking: true }).title, "Edit Booking")
    })

    it("resolves active nav items and mobile More drawer highlight accurately", () => {
      assert.equal(isNavItemActive("dashboard", "dashboard"), true)
      assert.equal(isNavItemActive("dashboard", "tours"), false)

      // Mobile primary items do NOT highlight "More"
      assert.equal(isMoreDestinationActive("dashboard"), false)
      assert.equal(isMoreDestinationActive("passengers"), false)
      assert.equal(isMoreDestinationActive("journey"), false)
      assert.equal(isMoreDestinationActive("form"), false)

      // Secondary destinations DO highlight "More"
      assert.equal(isMoreDestinationActive("tours"), true)
      assert.equal(isMoreDestinationActive("analytics"), true)
      assert.equal(isMoreDestinationActive("settings"), true)
    })

    it("maps each tab to its appropriate PageSkeleton layout variant", () => {
      assert.equal(getSkeletonVariant("dashboard"), "dashboard")
      assert.equal(getSkeletonVariant("form"), "form")
      assert.equal(getSkeletonVariant("settings"), "settings")
      assert.equal(getSkeletonVariant("analytics"), "analytics")
      assert.equal(getSkeletonVariant("passengers"), "table")
      assert.equal(getSkeletonVariant("tours"), "table")
      assert.equal(getSkeletonVariant("journey"), "table")
      assert.equal(getSkeletonVariant("unknown"), "dashboard")
    })
  })

  describe("Sidebar collapsed-state persistence", () => {
    it("reads and writes collapsed boolean using storage mock", () => {
      const store = new Map()
      const mockStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, v),
      }

      assert.equal(readSidebarCollapsed(mockStorage), false)
      assert.equal(writeSidebarCollapsed(true, mockStorage), true)
      assert.equal(store.get(SIDEBAR_STORAGE_KEY), "true")
      assert.equal(readSidebarCollapsed(mockStorage), true)

      assert.equal(writeSidebarCollapsed(false, mockStorage), true)
      assert.equal(readSidebarCollapsed(mockStorage), false)
    })

    it("degrades safely to false when localStorage throws", () => {
      const throwingStorage = {
        getItem() {
          throw new Error("SecurityError: storage unavailable")
        },
        setItem() {
          throw new Error("QuotaExceededError: storage full")
        },
      }

      assert.doesNotThrow(() => {
        assert.equal(readSidebarCollapsed(throwingStorage), false)
        assert.equal(writeSidebarCollapsed(true, throwingStorage), false)
        assert.equal(readSidebarCollapsed(null), false)
        assert.equal(writeSidebarCollapsed(true, null), false)
      })
    })
  })
})
