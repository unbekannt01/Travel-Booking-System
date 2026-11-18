import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatINR } from "../src/utils/formatters.js"
import { cn } from "../src/utils/cn.js"
import {
  THEME_STORAGE_KEY,
  THEME_MODES,
  isValidThemeMode,
  readStoredTheme,
  writeStoredTheme,
  resolveEffectiveTheme,
  applyThemeToDocument,
} from "../src/theme/themeStorage.js"
import {
  STATUS_META,
  resolveStatusMeta,
  getInitials,
  getAvatarTone,
  buttonVariants,
  iconButtonVariants,
  inputVariants,
  badgeVariants,
  cardVariants,
} from "../src/components/ui/variants.js"

describe("UI Foundation — formatINR, Theme State & Variant Helpers (Part 3.1)", () => {
  describe("formatINR currency formatting", () => {
    it("formats Indian digit grouping for lakhs and crores", () => {
      assert.equal(formatINR(123456), "₹1,23,456")
      assert.equal(formatINR(10000000), "₹1,00,00,000")
      assert.equal(formatINR(500), "₹500")
    })

    it("supports explicit 0 and 2 decimal places via number or options object", () => {
      assert.equal(formatINR(1234.56, 0), "₹1,235")
      assert.equal(formatINR(1234, { decimals: 0 }), "₹1,234")
      assert.equal(formatINR(1234.5, 2), "₹1,234.50")
      assert.equal(formatINR(500, { decimals: 2 }), "₹500.00")
    })

    it("formats negative rupee amounts cleanly with leading minus sign", () => {
      assert.equal(formatINR(-12345), "-₹12,345")
      assert.equal(formatINR(-42.5, 2), "-₹42.50")
    })

    it("handles null, undefined, empty string, NaN, and Infinity safely", () => {
      assert.equal(formatINR(null), "₹0")
      assert.equal(formatINR(undefined), "₹0")
      assert.equal(formatINR(""), "₹0")
      assert.equal(formatINR("not-a-number"), "₹0")
      assert.equal(formatINR(Infinity), "₹0")
      assert.equal(formatINR(null, 2), "₹0.00")
    })
  })

  describe("Theme state resolution & resilient storage", () => {
    it("resolves explicit and system preferences accurately", () => {
      assert.deepEqual(THEME_MODES, ["system", "light", "dark"])
      assert.equal(isValidThemeMode("light"), true)
      assert.equal(isValidThemeMode("dark"), true)
      assert.equal(isValidThemeMode("system"), true)
      assert.equal(isValidThemeMode("sepia"), false)

      assert.equal(resolveEffectiveTheme("light", true), "light")
      assert.equal(resolveEffectiveTheme("dark", false), "dark")
      assert.equal(resolveEffectiveTheme("system", false), "light")
      assert.equal(resolveEffectiveTheme("system", true), "dark")
      assert.equal(resolveEffectiveTheme("unknown", true), "dark")
    })

    it("reads and writes valid modes using storage mock", () => {
      const store = new Map()
      const mockStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, v),
      }

      assert.equal(readStoredTheme(mockStorage), "system")
      assert.equal(writeStoredTheme("dark", mockStorage), true)
      assert.equal(store.get(THEME_STORAGE_KEY), "dark")
      assert.equal(readStoredTheme(mockStorage), "dark")

      // Rejects invalid writes and invalid stored entries
      assert.equal(writeStoredTheme("neon", mockStorage), false)
      store.set(THEME_STORAGE_KEY, "corrupted")
      assert.equal(readStoredTheme(mockStorage), "system")
    })

    it("degrades gracefully when localStorage throws SecurityError or QuotaExceededError", () => {
      const throwingStorage = {
        getItem() {
          throw new Error("SecurityError: storage disabled")
        },
        setItem() {
          throw new Error("QuotaExceededError: storage full")
        },
      }

      assert.doesNotThrow(() => {
        assert.equal(readStoredTheme(throwingStorage), "system")
        assert.equal(writeStoredTheme("dark", throwingStorage), false)
        assert.equal(readStoredTheme(null), "system")
        assert.equal(writeStoredTheme("light", null), false)
      })
    })

    it("applies resolved theme to document root dataset, classList, and colorScheme", () => {
      const classes = new Set()
      const mockDoc = {
        documentElement: {
          dataset: {},
          style: {},
          classList: {
            toggle(name, force) {
              if (force) classes.add(name)
              else classes.delete(name)
            },
          },
        },
      }

      const darkApplied = applyThemeToDocument("system", mockDoc, true)
      assert.equal(darkApplied, "dark")
      assert.equal(mockDoc.documentElement.dataset.theme, "dark")
      assert.equal(mockDoc.documentElement.style.colorScheme, "dark")
      assert.equal(classes.has("dark"), true)

      const lightApplied = applyThemeToDocument("light", mockDoc, true)
      assert.equal(lightApplied, "light")
      assert.equal(mockDoc.documentElement.dataset.theme, "light")
      assert.equal(mockDoc.documentElement.style.colorScheme, "light")
      assert.equal(classes.has("dark"), false)
    })
  })

  describe("UI variant helpers, StatusPill metadata & cn utility", () => {
    it("provides distinct semantic variant and icon metadata for all 6 canonical statuses", () => {
      const expected = ["Confirmed", "Cancelled", "Paid", "Partial", "Pending", "Boarded"]
      assert.deepEqual(Object.keys(STATUS_META), expected)

      for (const status of expected) {
        const meta = resolveStatusMeta(status.toLowerCase())
        assert.equal(meta.label, status)
        assert.ok(meta.variant.length > 0)
        assert.ok(meta.iconName.length > 0)
      }

      const fallback = resolveStatusMeta("CustomStatus")
      assert.equal(fallback.label, "CustomStatus")
      assert.equal(fallback.variant, "neutral")
    })

    it("computes initials and deterministic avatar tones safely", () => {
      assert.equal(getInitials("Rameshbhai Patel"), "RP")
      assert.equal(getInitials("Harish Kumar Sharma"), "HS")
      assert.equal(getInitials("YatraHub"), "YA")
      assert.equal(getInitials("  "), "?")
      assert.equal(getInitials(null), "?")

      assert.equal(getAvatarTone("Rameshbhai Patel"), getAvatarTone("Rameshbhai Patel"))
      assert.equal(getAvatarTone(null), "neutral")
    })

    it("generates token-based classes with mobile 44px touch targets and focus rings", () => {
      const btn = buttonVariants({ variant: "accent", size: "md" })
      assert.match(btn, /bg-accent-warm/)
      assert.match(btn, /min-h-11/)
      assert.match(btn, /focus-visible:ring-2/)

      const iconBtn = iconButtonVariants({ variant: "danger", size: "sm" })
      assert.match(iconBtn, /min-h-11/)
      assert.match(iconBtn, /min-w-11/)

      const inp = inputVariants({ invalid: true })
      assert.match(inp, /border-danger/)
      assert.match(inp, /min-h-11/)

      const badge = badgeVariants({ variant: "success" })
      assert.match(badge, /bg-success-soft/)
      assert.match(badge, /text-success-text/)

      const card = cardVariants({ interactive: true })
      assert.match(card, /bg-surface/)
      assert.match(card, /cursor-pointer/)
    })

    it("merges Tailwind classes and resolves conflicts via cn()", () => {
      const isHidden = false
      assert.equal(cn("px-2 py-1", isHidden && "hidden", "px-4"), "py-1 px-4")
    })
  })
})
