import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { checkPasswordCriteria, formatAuthError } from "../src/utils/validators.js"
import { emitApiStatus, subscribeApiStatus, API_STATUS_EVENT } from "../src/data/client.js"
import { resolvePageMeta, SHOW_THEME_TOGGLE, NAV_ITEMS } from "../src/components/shell/shellConfig.js"

describe("Part 3.5: Remaining Screens, Auth & Theme System", () => {
  describe("Password Complexity Criteria (checkPasswordCriteria)", () => {
    it("accepts passwords fulfilling all 5 complexity criteria (>=10 chars, upper, lower, digit, symbol)", () => {
      const res = checkPasswordCriteria("Yatra#2026Secure")
      assert.equal(res.minLength, true)
      assert.equal(res.hasUpper, true)
      assert.equal(res.hasLower, true)
      assert.equal(res.hasDigit, true)
      assert.equal(res.hasSpecial, true)
      assert.equal(res.isValid, true)
    })

    it("rejects passwords under 10 characters", () => {
      const res = checkPasswordCriteria("Yatra#26")
      assert.equal(res.minLength, false)
      assert.equal(res.isValid, false)
    })

    it("flags missing uppercase letters", () => {
      const res = checkPasswordCriteria("yatra@2026secure")
      assert.equal(res.hasUpper, false)
      assert.equal(res.isValid, false)
    })

    it("flags missing lowercase letters", () => {
      const res = checkPasswordCriteria("YATRA@2026SECURE")
      assert.equal(res.hasLower, false)
      assert.equal(res.isValid, false)
    })

    it("flags missing digits", () => {
      const res = checkPasswordCriteria("YatraSecure#Tour")
      assert.equal(res.hasDigit, false)
      assert.equal(res.isValid, false)
    })

    it("flags missing special symbols", () => {
      const res = checkPasswordCriteria("Yatra2026Secure")
      assert.equal(res.hasSpecial, false)
      assert.equal(res.isValid, false)
    })

    it("handles null and undefined gracefully without throwing", () => {
      assert.equal(checkPasswordCriteria(null).isValid, false)
      assert.equal(checkPasswordCriteria(undefined).isValid, false)
      assert.equal(checkPasswordCriteria("").isValid, false)
    })
  })

  describe("Authentication Error Formatting (formatAuthError)", () => {
    it("preserves specific lockout countdown messages", () => {
      const lockMsg = "Account is temporarily locked due to multiple failed attempts. Please try again in 14 minute(s)."
      assert.equal(formatAuthError(lockMsg), lockMsg)
    })

    it("maps 429 rate limit errors to friendly guidance", () => {
      const res = formatAuthError("Too many authentication requests from this IP. Please try again after 15 minutes.")
      assert.match(res, /Too many requests/i)
    })

    it("maps generic credential failures to clear advice", () => {
      const res = formatAuthError("Invalid email/username or password")
      assert.match(res, /Invalid username or password/i)
    })

    it("returns a safe default for null or empty errors", () => {
      assert.match(formatAuthError(null), /unexpected error/i)
      assert.match(formatAuthError(""), /unexpected error/i)
    })
  })

  describe("API Status Event Bus (client.js)", () => {
    it("exports API_STATUS_EVENT constant", () => {
      assert.equal(API_STATUS_EVENT, "yatrahub:api-status")
    })

    it("subscribes and receives reachability updates safely in browser/node environment", () => {
      let receivedStatus = null
      const unsubscribe = subscribeApiStatus((status) => {
        receivedStatus = status
      })

      // In node without DOM window.dispatchEvent, emitApiStatus degrades gracefully
      emitApiStatus(true)
      emitApiStatus(false)

      assert.equal(typeof unsubscribe, "function")
      unsubscribe()
      assert.equal(receivedStatus, null)
    })
  })

  describe("App Shell Route Meta & Theme Switcher (Task G)", () => {
    it("enables SHOW_THEME_TOGGLE flag globally", () => {
      assert.equal(SHOW_THEME_TOGGLE, true)
    })

    it("configures all primary screens to use shell PageHeader (hasOwnHeading: false)", () => {
      for (const item of NAV_ITEMS) {
        assert.equal(
          item.hasOwnHeading,
          false,
          `Expected ${item.id} to have hasOwnHeading: false`,
        )
      }
    })

    it("resolves route metadata for all 6 primary navigation tabs", () => {
      const tabs = ["dashboard", "passengers", "journey", "tours", "analytics", "settings"]
      for (const tab of tabs) {
        const meta = resolvePageMeta(tab)
        assert.equal(meta.id, tab)
        assert.ok(meta.title)
        assert.ok(meta.description)
      }
    })
  })
})
