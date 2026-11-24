import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatTabLabel, formatScreenSummary } from "../scripts/smokeFormatter.mjs"

describe("UI Smoke Formatter Unit Tests (Step 0)", () => {
  describe("formatTabLabel", () => {
    it("formats multi-line tab button text with numeric badge into label (count)", () => {
      assert.equal(formatTabLabel("Bookings Table\n4"), "Bookings Table (4)")
      assert.equal(formatTabLabel("Customers\n12"), "Customers (12)")
      assert.equal(formatTabLabel("All\n0"), "All (0)")
    })

    it("formats single-line text ending with count badge into label (count)", () => {
      assert.equal(formatTabLabel("Bookings Table 4"), "Bookings Table (4)")
      assert.equal(formatTabLabel("Customers 12"), "Customers (12)")
    })

    it("preserves standard labels without count badge", () => {
      assert.equal(formatTabLabel("General"), "General")
      assert.equal(formatTabLabel("Profit & Loss"), "Profit & Loss")
      assert.equal(formatTabLabel("Bookings Table (4)"), "Bookings Table (4)")
      assert.equal(formatTabLabel(""), "")
    })
  })

  describe("formatScreenSummary", () => {
    it("formats successful screen summary with checkmark and timing", () => {
      const line = formatScreenSummary({
        screenLabel: "Trash",
        viewportCount: 4,
        themeCount: 2,
        tabLabel: "5 tabs",
        statesCount: 40,
        errorCount: 0,
        breachCount: 0,
        durationMs: 12340,
        budgetExceeded: false,
      })
      assert.equal(line, "[ui:smoke] ✓ Trash (4 viewports, 2 themes, 5 tabs): 40 states, 0 errors, 12.3s")
    })

    it("formats failure screen summary with cross and error counts", () => {
      const line = formatScreenSummary({
        screenLabel: "Overview",
        viewportCount: 2,
        themeCount: 1,
        tabLabel: "1 tab",
        statesCount: 2,
        errorCount: 2,
        breachCount: 1,
        durationMs: 8500,
        budgetExceeded: true,
      })
      assert.equal(line, "[ui:smoke] ✗ Overview (2 viewports, 1 themes, 1 tab): 2 states, 2 errors, 1 budget breach, 8.5s")
    })
  })
})
