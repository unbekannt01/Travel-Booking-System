import { chromium } from "playwright"
import AxeBuilder from "@axe-core/playwright"
import fs from "node:fs"
import path from "node:path"
import { formatTabLabel, formatScreenSummary } from "./smokeFormatter.mjs"

export { formatTabLabel, formatScreenSummary }

// --- CLI ARGUMENTS & CONFIGURATION ---
const args = process.argv.slice(2)
const isQuick = args.includes("--quick")
const isSkipAxe = args.includes("--skip-axe")
const isStrict = args.includes("--strict")

let onlyScreen = null
const onlyArg = args.find((a) => a.startsWith("--only="))
if (onlyArg) {
  onlyScreen = onlyArg.split("=")[1].trim().toLowerCase()
}

let customWidths = null
const widthsArg = args.find((a) => a.startsWith("--widths="))
if (widthsArg) {
  customWidths = widthsArg
    .split("=")[1]
    .split(",")
    .map((w) => parseInt(w.trim(), 10))
    .filter((w) => !isNaN(w) && w > 0)
}

let customThemes = null
const themesArg = args.find((a) => a.startsWith("--themes="))
if (themesArg) {
  customThemes = themesArg
    .split("=")[1]
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t === "light" || t === "dark")
}

const TARGET_URL = process.env.UI_SMOKE_URL || "http://localhost:5173"
const EMAIL = process.env.UI_SMOKE_EMAIL
const PASSWORD = process.env.UI_SMOKE_PASSWORD
const STEP_TIMEOUT_MS = parseInt(process.env.UI_SMOKE_STEP_TIMEOUT_MS, 10) || 20000

// Dynamic budget config (Task C.2)
const BASE_BUDGET_MS = parseInt(process.env.UI_SMOKE_SCREEN_BUDGET_MS, 10) || 90000
const PER_TAB_BUDGET_MS = 2500

// Enforce local-only target
try {
  const parsed = new URL(TARGET_URL)
  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    console.error(`[ui:smoke] Refusing to run: Target host must be localhost or 127.0.0.1, got "${parsed.hostname}".`)
    process.exit(1)
  }
} catch {
  console.error(`[ui:smoke] Invalid TARGET_URL: ${TARGET_URL}`)
  process.exit(1)
}

if (!EMAIL || !PASSWORD) {
  console.error("[ui:smoke] Missing credentials: Set UI_SMOKE_EMAIL and UI_SMOKE_PASSWORD environment variables.")
  console.error("  Example (PowerShell):")
  console.error('    $env:UI_SMOKE_EMAIL="operator@example.com"')
  console.error('    $env:UI_SMOKE_PASSWORD="YourPassword123!"')
  console.error("    npm run ui:smoke")
  console.error("  Optional flags:")
  console.error("    npm run ui:smoke -- --quick")
  console.error("    npm run ui:smoke -- --only=profit-loss")
  console.error("    npm run ui:smoke -- --widths=360,1440 --themes=light --skip-axe")
  process.exit(1)
}

const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots")
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const ALL_VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]

let activeViewports = ALL_VIEWPORTS
if (isQuick) {
  activeViewports = [
    { name: "mobile-360", width: 360, height: 740 },
    { name: "desktop-1440", width: 1440, height: 900 },
  ]
} else if (customWidths && customWidths.length > 0) {
  activeViewports = customWidths.map((w) => {
    const known = ALL_VIEWPORTS.find((v) => v.width === w)
    return known || { name: `custom-${w}`, width: w, height: 800 }
  })
}

let activeThemes = ["light", "dark"]
if (isQuick) {
  activeThemes = ["light"]
} else if (customThemes && customThemes.length > 0) {
  activeThemes = customThemes
}

const ALL_SCREENS = [
  { id: "dashboard", label: "Overview", tabId: "dashboard" },
  { id: "passengers", label: "Travelers", tabId: "passengers" },
  { id: "customers", label: "Customers", tabId: "customers" },
  { id: "outstanding", label: "Outstanding", tabId: "outstanding" },
  { id: "journey", label: "Journeys", tabId: "journey" },
  { id: "tours", label: "Destinations", tabId: "tours" },
  { id: "expenses", label: "Expenses", tabId: "expenses" },
  { id: "cashbook", label: "Cash Book", tabId: "cashbook" },
  { id: "trash", label: "Trash", tabId: "trash" },
  { id: "data", label: "Import & Export", tabId: "data" },
  { id: "analytics", label: "Analytics", tabId: "analytics" },
  { id: "profit-loss", label: "Profit & Loss", isAnalyticsTab: "pnl" },
  { id: "settings", label: "Settings", tabId: "settings" },
  { id: "invoice-studio", label: "Invoice Studio", isSettingsTab: "studio" },
  { id: "reminder-settings", label: "Reminder Settings", isSettingsTab: "reminders" },
  { id: "new-booking", label: "New Booking", isAction: "new-booking" },
  { id: "ui-kit", label: "Dev UI Kit", isRoute: "#/ui-kit" },
]

let activeScreens = ALL_SCREENS
if (onlyScreen) {
  activeScreens = ALL_SCREENS.filter(
    (s) =>
      s.id.toLowerCase() === onlyScreen ||
      s.label.toLowerCase() === onlyScreen ||
      s.tabId?.toLowerCase() === onlyScreen ||
      s.isSettingsTab?.toLowerCase() === onlyScreen ||
      s.isAnalyticsTab?.toLowerCase() === onlyScreen,
  )
  if (activeScreens.length === 0) {
    console.error(`[ui:smoke] Error: No screen found matching "--only=${onlyScreen}".`)
    console.error(`Available screens: ${ALL_SCREENS.map((s) => s.id).join(", ")}`)
    process.exit(1)
  }
}

console.log("[ui:smoke] Configuration:")
console.log(`  Target: ${TARGET_URL}`)
console.log(`  Step Timeout: ${STEP_TIMEOUT_MS}ms | Base Screen Budget: ${BASE_BUDGET_MS}ms`)
console.log(`  Screens (${activeScreens.length}): ${activeScreens.map((s) => s.label).join(", ")}`)
console.log(`  Viewports (${activeViewports.length}): ${activeViewports.map((v) => `${v.width}px`).join(", ")}`)
console.log(`  Themes (${activeThemes.length}): ${activeThemes.join(", ")}`)
console.log(`  Strict Mode: ${isStrict ? "ENABLED (--strict: warnings fatal)" : "DISABLED"}`)
console.log(`  axe-core analysis: ${isSkipAxe ? "SKIPPED (--skip-axe)" : "ENABLED (excluding iframe)"}`)

let isInterrupted = false

async function run() {
  console.log(`[ui:smoke] Launching browser smoke test on ${TARGET_URL}...`)
  const browser = await chromium.launch({ headless: true })

  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(STEP_TIMEOUT_MS)

  // Current execution context for attribution
  const currentContext = {
    screen: "Init",
    tab: "Init",
    viewport: 0,
    theme: "light",
  }

  const pageErrors = []
  const consoleEntries = []
  const failedRequests = []
  const httpFailures = [] // 429 and 5xx responses
  const overflowFindings = []
  const fallbackFindings = []
  const coverageRecords = [] // { screen, viewport, theme, tabsFound, tabsClicked, tabsSkipped, unvisitedTabs, status }
  const budgetBreaches = [] // { screen, durationMs, budgetMs, skippedTabs }
  const tabVisitDurations = [] // { screen, tab, viewport, theme, durationMs }
  const groupedAxeViolations = new Map()
  const completedScreens = []
  const extraCheckFailures = []
  let totalScreenshots = 0

  // Capture uncaught page errors (Task C.1)
  page.on("pageerror", (err) => {
    const rawMsg = err.message || String(err)
    const trimmedMsg = rawMsg.length > 600 ? rawMsg.slice(0, 597) + "..." : rawMsg
    pageErrors.push({
      message: trimmedMsg,
      stack: (err.stack || "").slice(0, 1000),
      screen: currentContext.screen,
      tab: currentContext.tab,
      viewport: currentContext.viewport,
      theme: currentContext.theme,
    })
  })

  // Capture console warnings and errors with attribution (Task C.1)
  page.on("console", (msg) => {
    const type = msg.type()
    if (type === "error" || type === "warning") {
      const loc = msg.location()
      let locStr = ""
      if (loc && loc.url) {
        try {
          const u = new URL(loc.url)
          locStr = `${u.pathname}:${loc.lineNumber || 0}`
        } catch {
          locStr = `${loc.url}:${loc.lineNumber || 0}`
        }
      }

      // Trim message text to max 600 chars
      let text = msg.text() || ""
      if (text.length > 600) {
        text = text.slice(0, 597) + "..."
      }

      consoleEntries.push({
        type,
        text,
        location: locStr || null,
        screen: currentContext.screen,
        tab: currentContext.tab,
        viewport: currentContext.viewport,
        theme: currentContext.theme,
      })
    }
  })

  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText || "failed"}`)
  })

  page.on("response", (res) => {
    const status = res.status()
    if (status === 429 || status >= 500) {
      try {
        const u = new URL(res.url())
        const cleanPath = u.pathname // Exclude query params for security
        const retryAfter = res.headers()["retry-after"] || null
        httpFailures.push({
          status,
          path: cleanPath,
          retryAfter,
          screen: currentContext.screen,
        })
      } catch {}
    }
  })

  // Function to write report incrementally
  const reportPath = path.join(SCREENSHOTS_DIR, "report.md")
  const writeReport = (isPartial = false, reason = "") => {
    const reportLines = [
      "# YatraHub (TBS) — UI Smoke & Accessibility Report",
      "",
      `**Execution Status**: ${
        isPartial
          ? `⚠️ PARTIAL RUN (${reason || "Interrupted"})`
          : "✅ COMPLETED"
      }`,
      `**Execution Timestamp**: ${new Date().toISOString()}`,
      `**Target URL**: ${TARGET_URL}`,
      `**Screens Processed**: ${completedScreens.length} of ${activeScreens.length}`,
      `**Total Screenshots Captured**: ${totalScreenshots}`,
      `**Configuration**: ${[
        isQuick ? "--quick" : null,
        isSkipAxe ? "--skip-axe" : null,
        isStrict ? "--strict" : null,
        onlyScreen ? `--only=${onlyScreen}` : null,
      ]
        .filter(Boolean)
        .join(" ") || "default full run"}`,
      "",
      "## Completed Screens",
      completedScreens.length > 0
        ? completedScreens.map((s) => `- ${s}`).join("\n")
        : "_None completed yet._",
      "",
      "## 1. Horizontal Overflow Checks (360px – 1440px)",
    ]

    if (overflowFindings.length === 0) {
      reportLines.push("✅ **Zero horizontal overflow detected across evaluated viewports.**")
    } else {
      reportLines.push(`⚠️ **${overflowFindings.length} overflow findings detected:**`)
      reportLines.push("| Screen | Viewport | Theme | scrollWidth | clientWidth |")
      reportLines.push("| :--- | :---: | :---: | :---: | :---: |")
      for (const f of overflowFindings) {
        reportLines.push(`| ${f.screen} | ${f.viewport}px | ${f.theme} | ${f.scrollWidth}px | ${f.clientWidth}px |`)
      }
    }

    reportLines.push("")
    reportLines.push("## 2. Accessibility (axe-core WCAG Violations)")
    if (isSkipAxe) {
      reportLines.push("ℹ️ **axe-core accessibility analysis was skipped (--skip-axe).**")
    } else if (groupedAxeViolations.size === 0) {
      reportLines.push("✅ **Zero accessibility violations detected across evaluated screens.**")
    } else {
      reportLines.push(`⚠️ **${groupedAxeViolations.size} unique accessibility violations detected:**\n`)
      let vIdx = 1
      for (const [, v] of groupedAxeViolations) {
        const uniqueOccurrences = Array.from(new Set(v.occurrences))
        reportLines.push(`### ${vIdx}. [${v.impact.toUpperCase()}] ${v.id}: ${v.help}`)
        if (v.helpUrl) {
          reportLines.push(`- **Rule Reference**: [${v.id}](${v.helpUrl})`)
        }
        reportLines.push(`- **Target Selector**: \`${v.selector}\``)
        reportLines.push(`- **Occurrences (${uniqueOccurrences.length})**: ${uniqueOccurrences.join(", ")}`)
        if (v.failureSummary) {
          reportLines.push(`- **Failure Summary**: \`${v.failureSummary}\``)
        }
        reportLines.push("- **HTML Snippet**:")
        reportLines.push("  ```html")
        reportLines.push(`  ${v.snippet}`)
        reportLines.push("  ```")
        reportLines.push("")
        vIdx++
      }
    }

    reportLines.push("")
    reportLines.push("## 3. HTTP 429 & 5xx Responses")
    if (httpFailures.length === 0) {
      reportLines.push("✅ **Zero HTTP 429 (Rate Limit) or 5xx server errors recorded.**")
    } else {
      reportLines.push(`⚠️ **${httpFailures.length} rate limit or server error responses recorded:**`)
      reportLines.push("| Status | Endpoint Path | Retry-After | Triggering Screen |")
      reportLines.push("| :---: | :--- | :---: | :--- |")
      for (const h of httpFailures) {
        reportLines.push(`| ${h.status} | \`${h.path}\` | ${h.retryAfter || "N/A"} | ${h.screen} |`)
      }
    }

    reportLines.push("")
    reportLines.push("## 4. Console Errors & Warnings (with Attribution)")

    // Subsection 4a: Uncaught Page Errors
    if (pageErrors.length > 0) {
      reportLines.push(`### Uncaught Page Errors (${pageErrors.length})`)
      const groupedPageErrors = new Map()
      for (const pe of pageErrors) {
        const key = pe.message
        if (!groupedPageErrors.has(key)) {
          groupedPageErrors.set(key, { message: pe.message, occurrences: [] })
        }
        groupedPageErrors
          .get(key)
          .occurrences.push(`${pe.screen} > ${pe.tab} (${pe.viewport}px, ${pe.theme})`)
      }
      for (const [, pe] of groupedPageErrors) {
        const uniqueOcc = Array.from(new Set(pe.occurrences))
        reportLines.push(`- ❌ **Uncaught Error**: \`${pe.message}\``)
        reportLines.push(`  - **Occurrences**: ${uniqueOcc.join(", ")}`)
      }
      reportLines.push("")
    }

    // Subsection 4b: Console Errors
    const errorsOnly = consoleEntries.filter((c) => c.type === "error")
    reportLines.push(`- **Console Errors**: ${errorsOnly.length}`)
    if (errorsOnly.length > 0) {
      const groupedErrors = new Map()
      for (const err of errorsOnly) {
        const key = err.text
        if (!groupedErrors.has(key)) {
          groupedErrors.set(key, { text: err.text, locations: new Set(), occurrences: [] })
        }
        if (err.location) groupedErrors.get(key).locations.add(err.location)
        groupedErrors
          .get(key)
          .occurrences.push(`${err.screen} > ${err.tab} (${err.viewport}px, ${err.theme})`)
      }
      for (const [, err] of groupedErrors) {
        const locStr =
          err.locations.size > 0 ? ` [at ${Array.from(err.locations).join(", ")}]` : ""
        reportLines.push(`  - ❌ **Error**: \`${err.text}\`${locStr}`)
        const uniqueOcc = Array.from(new Set(err.occurrences))
        reportLines.push(`    - **Occurrences**: ${uniqueOcc.join(", ")}`)
      }
    }

    // Subsection 4c: Console Warnings
    const warningsOnly = consoleEntries.filter((c) => c.type === "warning")
    reportLines.push(`- **Console Warnings**: ${warningsOnly.length}`)
    if (warningsOnly.length > 0) {
      const groupedWarnings = new Map()
      for (const w of warningsOnly) {
        const key = w.text
        if (!groupedWarnings.has(key)) {
          groupedWarnings.set(key, { text: w.text, locations: new Set(), occurrences: [] })
        }
        if (w.location) groupedWarnings.get(key).locations.add(w.location)
        groupedWarnings
          .get(key)
          .occurrences.push(`${w.screen} > ${w.tab} (${w.viewport}px, ${w.theme})`)
      }
      for (const [, w] of groupedWarnings) {
        const locStr =
          w.locations.size > 0 ? ` [at ${Array.from(w.locations).join(", ")}]` : ""
        reportLines.push(`  - ⚠️ **Warning**: \`${w.text}\`${locStr}`)
        const uniqueOcc = Array.from(new Set(w.occurrences))
        reportLines.push(`    - **Occurrences**: ${uniqueOcc.join(", ")}`)
      }
    }

    // Subsection 4d: Failed Requests
    reportLines.push(`- **Failed Requests**: ${failedRequests.length}`)
    if (failedRequests.length > 0) {
      for (const req of failedRequests.slice(0, 10)) {
        reportLines.push(`  - \`${req}\``)
      }
    }

    reportLines.push("")
    reportLines.push("## 5. UI Error Fallback Checks")
    if (fallbackFindings.length === 0) {
      reportLines.push("✅ **Zero UI error fallbacks triggered across evaluated screens.**")
    } else {
      reportLines.push(`❌ **${fallbackFindings.length} UI error fallbacks detected:**`)
      reportLines.push("| Screen | Tab | Viewport | Theme | Triggered Error |")
      reportLines.push("| :--- | :--- | :---: | :---: | :--- |")
      for (const fb of fallbackFindings) {
        reportLines.push(`| ${fb.screen} | ${fb.tab} | ${fb.viewport}px | ${fb.theme} | ${fb.indicator} |`)
      }
    }

    reportLines.push("")
    reportLines.push("## 6. Tab Coverage")
    const coverageFailures = coverageRecords.filter((r) => r.status === "FAIL")
    if (coverageFailures.length === 0 && coverageRecords.length > 0) {
      reportLines.push("✅ **All non-disabled tabs were successfully clicked across evaluated screens.**")
    } else if (coverageFailures.length > 0) {
      reportLines.push(`❌ **Tab coverage failures detected (${coverageFailures.length} combinations with unvisited tabs):**`)
    }

    reportLines.push("")
    reportLines.push("| Screen | Viewport | Theme | Tabs Found | Tabs Clicked | Tabs Skipped | Unvisited Tabs | Status |")
    reportLines.push("| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: |")
    for (const r of coverageRecords) {
      const unvisitedStr = r.unvisitedTabs.length > 0 ? r.unvisitedTabs.join(", ") : "—"
      reportLines.push(
        `| ${r.screen} | ${r.viewport}px | ${r.theme} | ${r.tabsFound} | ${r.tabsClicked} | ${r.tabsSkipped} | ${unvisitedStr} | ${r.status} |`,
      )
    }

    reportLines.push("")
    reportLines.push("## 7. Budget Breaches & Performance")
    if (budgetBreaches.length === 0) {
      reportLines.push("✅ **Zero screen budget breaches. All screens executed within dynamic budgets.**")
    } else {
      reportLines.push(`❌ **${budgetBreaches.length} screen budget breach(es) detected:**`)
      for (const b of budgetBreaches) {
        const skippedStr =
          b.skippedTabs && b.skippedTabs.length > 0
            ? ` | Skipped tabs: ${b.skippedTabs.join(", ")}`
            : ""
        reportLines.push(
          `- ❌ **${b.screen}**: took ${(b.durationMs / 1000).toFixed(1)}s (dynamic budget ${(b.budgetMs / 1000).toFixed(1)}s)${skippedStr}`,
        )
      }
    }

    // Subsection: Slowest Views (Top 5) (Task C.4)
    if (tabVisitDurations.length > 0) {
      reportLines.push("")
      reportLines.push("### Slowest Views (Top 5)")
      const sortedDurations = [...tabVisitDurations].sort((a, b) => b.durationMs - a.durationMs)
      reportLines.push("| Screen | Tab | Viewport | Theme | Duration | Flag |")
      reportLines.push("| :--- | :--- | :---: | :---: | :---: | :---: |")
      for (const td of sortedDurations.slice(0, 5)) {
        const flag = td.durationMs > 5000 ? "⚠️ > 5000ms" : "OK"
        reportLines.push(
          `| ${td.screen} | ${td.tab} | ${td.viewport}px | ${td.theme} | ${td.durationMs.toLocaleString()}ms | ${flag} |`,
        )
      }
    }

    reportLines.push("")
    reportLines.push("## 8. Extra Workflow Checks")
    if (extraCheckFailures.length === 0) {
      reportLines.push("✅ **All extra workflow checks passed cleanly.**")
    } else {
      reportLines.push(`❌ **${extraCheckFailures.length} extra check failure(s) detected:**`)
      for (const ef of extraCheckFailures) {
        reportLines.push(`- ❌ **${ef.name}** (${ef.screen}): ${ef.error}`)
      }
    }

    fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8")
  }

  // Handle SIGINT gracefully
  process.on("SIGINT", async () => {
    if (isInterrupted) return
    isInterrupted = true
    console.warn("\n[ui:smoke] Caught SIGINT (Ctrl+C). Saving partial report...")
    writeReport(true, "Aborted by user via SIGINT")
    console.log(`[ui:smoke] Partial report written to ${reportPath}`)
    try {
      await browser.close()
    } catch {}
    process.exit(130)
  })

  // 1. Authenticate through the real login screen
  console.log("[ui:smoke] Step 1: Logging in...")
  currentContext.screen = "Login"
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS })

  const isAuthVisible = await page.$('input[type="password"]')
  if (isAuthVisible) {
    const emailInput =
      (await page.$('input[type="email"]')) ||
      (await page.$('input[autocomplete="username"]')) ||
      (await page.$('input[type="text"]'))
    if (emailInput) await emailInput.fill(EMAIL)

    const passInput = await page.$('input[type="password"]')
    if (passInput) await passInput.fill(PASSWORD)

    const submitBtn = await page.$('button[type="submit"]')
    if (submitBtn) {
      await submitBtn.click()
      await page.waitForTimeout(1000)
    }
  }

  // Verify dashboard navigation exists
  try {
    await page.waitForSelector("#main-content", { timeout: STEP_TIMEOUT_MS })
    console.log("[ui:smoke] Logged in successfully.")
  } catch (loginErr) {
    console.error(`[ui:smoke] Login failed or #main-content not found: ${loginErr.message}`)
    console.error("[ui:smoke] Diagnostic checklist:")
    console.error("  1. Is backend running? (http://localhost:5000)")
    console.error("  2. Is frontend running? (http://localhost:5173)")
    console.error("  3. Are UI_SMOKE_EMAIL and UI_SMOKE_PASSWORD pointing to an active operator?")
    writeReport(true, `Login failed: ${loginErr.message}`)
    await browser.close()
    process.exit(1)
  }

  // Step 1.1: Backend API preflight check
  console.log("[ui:smoke] Running backend API preflight checks...")
  const preflightEndpoints = [
    "/api/health",
    "/api/customers?limit=1",
    "/api/expenses?limit=1",
    "/api/cashbook?from=2026-01-01&to=2026-01-01",
    "/api/reminder-templates",
    "/api/reports/outstanding?limit=1",
    "/api/reports/tour-pnl?limit=1",
    "/api/document-templates",
    "/api/documents?limit=1",
  ]
  for (const ep of preflightEndpoints) {
    try {
      const res = await page.request.get(`${TARGET_URL}${ep}`)
      if (res.status() === 404) {
        console.error(`\n[ui:smoke] FATAL PREFLIGHT ERROR: Route GET ${ep} returned HTTP 404 Not Found!`)
        console.error("[ui:smoke] The backend server does not have this route mounted.")
        console.error("[ui:smoke] Please restart the backend server ('npm run server' or node backend/index.js) so recently added routes take effect.")
        writeReport(true, `Preflight check 404 on ${ep}`)
        await browser.close()
        process.exit(1)
      }
    } catch (preErr) {
      console.warn(`[ui:smoke] Preflight check warning for ${ep}: ${preErr.message}`)
    }
  }
  console.log("[ui:smoke] Backend API preflight passed.")

  // 2. Iterate through screens, themes, and viewports (READ-ONLY)
  async function dismissAnyOpenModals() {
    try {
      const dialogs = await page.$$('[role="dialog"]')
      const hasOverlay = (await page.$$('.fixed.inset-0')).length > 0
      if (dialogs.length > 0 || hasOverlay) {
        await page.keyboard.press("Escape").catch(() => {})
        await page.waitForTimeout(200)

        const remaining = await page.$$('[role="dialog"]')
        if (remaining.length > 0) {
          const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Close")').first()
          if (await cancelBtn.isVisible().catch(() => false)) {
            await cancelBtn.click({ timeout: 1000 }).catch(() => {})
            await page.waitForTimeout(200)
          }
        }
      }
    } catch {}
  }

  async function safeNavClick(buttonHandle, label) {
    if (!buttonHandle) return false
    try {
      await buttonHandle.click({ timeout: 5000 })
      await page.waitForTimeout(300)
      return true
    } catch (clickErr) {
      const msg = clickErr.message || ""
      if (msg.includes("intercepts pointer events") || msg.includes("Timeout")) {
        console.warn(`[ui:smoke] Click on "${label}" intercepted/timed out. Dismissing overlays and retrying once...`)
        await dismissAnyOpenModals()
        await page.keyboard.press("Escape").catch(() => {})
        await page.waitForTimeout(200)
        await buttonHandle.click({ timeout: 4000, force: true }).catch(() => {})
        await page.waitForTimeout(300)
        return true
      }
      throw clickErr
    }
  }

  for (const screen of activeScreens) {
    if (isInterrupted) break
    const screenStart = Date.now()
    currentContext.screen = screen.label
    currentContext.tab = "Main"

    // Ensure clean state before starting each screen
    await dismissAnyOpenModals()

    // Track baseline console error count before visiting screen
    const initialConsoleErrors = consoleEntries.filter(
      (c) => c.type === "error" && c.screen === screen.label,
    ).length
    const initialPageErrors = pageErrors.filter((p) => p.screen === screen.label).length

    // Navigate to target screen read-only
    try {
      if (screen.isRoute) {
        await page.goto(`${TARGET_URL}/${screen.isRoute}`, { waitUntil: "domcontentloaded" })
        await page.waitForTimeout(300)
      } else if (screen.isSettingsTab) {
        if (page.url().includes("#/ui-kit")) {
          await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
          await page.waitForTimeout(300)
        }
        const settingsNav = await page.$('button:has-text("Settings")')
        await safeNavClick(settingsNav, "Settings")
        if (screen.isSettingsTab === "studio") {
          const studioTab = await page.$('button:has-text("Invoice Studio")')
          await safeNavClick(studioTab, "Invoice Studio")
        } else if (screen.isSettingsTab === "reminders") {
          const remindersTab = await page.$('button:has-text("Reminders")')
          await safeNavClick(remindersTab, "Reminders")
        }
      } else if (screen.isAnalyticsTab) {
        if (page.url().includes("#/ui-kit")) {
          await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
          await page.waitForTimeout(300)
        }
        const analyticsNav = await page.$('button:has-text("Analytics")')
        await safeNavClick(analyticsNav, "Analytics")
        const pnlTab = await page.$('button:has-text("Profit & Loss")')
        await safeNavClick(pnlTab, "Profit & Loss")
      } else if (screen.isAction === "new-booking") {
        if (page.url().includes("#/ui-kit")) {
          await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
          await page.waitForTimeout(300)
        }
        const newBookingBtn = await page.$('button:has-text("New Booking")')
        await safeNavClick(newBookingBtn, "New Booking")
      } else {
        if (page.url().includes("#/ui-kit")) {
          await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
          await page.waitForTimeout(300)
        }
        const navBtn = await page.$(`button:has-text("${screen.label}")`)
        await safeNavClick(navBtn, screen.label)
      }
    } catch (navErr) {
      console.warn(`[ui:smoke] Navigation error on ${screen.label}: ${navErr.message}`)
    }

    // Probe initial tab count on screen to compute dynamic budget (Task C.2)
    let initialTabsCount = await page.locator('[role="tab"]').count().catch(() => 0)
    if (screen.isSettingsTab) {
      initialTabsCount = 1
    }
    const discoveredTabCount = initialTabsCount
    const budgetTabCount = Math.max(1, discoveredTabCount)
    const screenBudgetMs = Math.max(
      BASE_BUDGET_MS,
      BASE_BUDGET_MS +
        PER_TAB_BUDGET_MS * budgetTabCount * activeViewports.length * activeThemes.length,
    )

    let screenBudgetExceeded = false
    let screenBreachRecorded = false
    let totalStatesEvaluated = 0

    for (const theme of activeThemes) {
      if (screenBudgetExceeded || isInterrupted) break
      currentContext.theme = theme

      // Set theme via data-theme and localStorage
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t)
        try {
          localStorage.setItem("yatrahub-theme", t)
        } catch {}
      }, theme)

      for (const vp of activeViewports) {
        currentContext.viewport = vp.width

        if (Date.now() - screenStart > screenBudgetMs) {
          screenBudgetExceeded = true
          break
        }
        if (isInterrupted) break

        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.waitForTimeout(200)

        // Query tabs present on the active screen
        await page.waitForTimeout(300)
        const tabLocators = page.locator('[role="tab"]')
        const totalTabs = await tabLocators.count().catch(() => 0)
        let tabsToCrawl = []
        let tabsFound = 0
        let tabsClicked = 0
        let tabsSkipped = 0

        for (let i = 0; i < totalTabs; i++) {
          const tabLoc = tabLocators.nth(i)
          const isVisible = await tabLoc.isVisible().catch(() => false)
          if (!isVisible) continue
          tabsFound++
          const raw = (await tabLoc.innerText().catch(() => "")) || ""
          const singleLineLabel = formatTabLabel(raw) || `Tab ${i + 1}`
          const clean =
            singleLineLabel
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || `tab-${i + 1}`
          const isDisabled = await tabLoc
            .evaluate((el) => {
              return el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true"
            })
            .catch(() => false)
          tabsToCrawl.push({
            id: clean,
            label: singleLineLabel,
            locator: tabLoc,
            disabled: isDisabled,
          })
        }

        // If screen is a dedicated single-tab view (e.g. Invoice Studio or Reminder Settings)
        if (screen.isSettingsTab) {
          const kw = screen.isSettingsTab === "studio" ? "studio" : "reminder"
          const matched = tabsToCrawl.filter(
            (t) => t.id.toLowerCase().includes(kw) || t.label.toLowerCase().includes(kw),
          )
          if (matched.length > 0) {
            tabsToCrawl = matched
            tabsFound = matched.length
          }
        }

        if (tabsToCrawl.length === 0) {
          tabsToCrawl.push({ id: "main", label: "Main", locator: null, disabled: false })
          tabsFound = 0
        }

        const unvisitedTabsForCombo = []

        for (let tabIdx = 0; tabIdx < tabsToCrawl.length; tabIdx++) {
          const t = tabsToCrawl[tabIdx]
          currentContext.tab = t.label

          // Check dynamic budget before visiting each tab
          if (Date.now() - screenStart > screenBudgetMs) {
            screenBudgetExceeded = true
            const remainingTabs = tabsToCrawl.slice(tabIdx).map((rem) => rem.label)
            unvisitedTabsForCombo.push(...remainingTabs)
            if (!screenBreachRecorded) {
              budgetBreaches.push({
                screen: screen.label,
                durationMs: Date.now() - screenStart,
                budgetMs: screenBudgetMs,
                skippedTabs: remainingTabs,
              })
              screenBreachRecorded = true
            }
            break
          }
          if (isInterrupted) break

          const tabStart = Date.now()

          if (t.locator) {
            if (t.disabled) {
              tabsSkipped++
              continue
            }
            try {
              await t.locator.click({ timeout: 5000 })
              await page.waitForTimeout(250)
              tabsClicked++
            } catch (clickErr) {
              const errMsg = clickErr.message.split("\n")[0]
              unvisitedTabsForCombo.push(t.label)
            }
          } else {
            // Screen without sub-tabs (main view)
            tabsClicked++
          }

          totalStatesEvaluated++

          // Error fallback detection: check if screen or panel rendered error boundary cards
          const fallbackIndicator = await page.evaluate(() => {
            const body = document.body ? document.body.innerText || "" : ""
            const errorPhrases = [
              "Could not load this page",
              "Something went wrong in this panel",
              "Section Unavailable",
            ]
            for (const phrase of errorPhrases) {
              if (body.includes(phrase)) return phrase
            }
            return null
          })

          if (fallbackIndicator) {
            fallbackFindings.push({
              screen: screen.label,
              tab: t.label,
              viewport: vp.width,
              theme,
              indicator: fallbackIndicator,
            })
          }

          // Check horizontal overflow
          const overflow = await page.evaluate(() => {
            const docEl = document.documentElement
            return {
              scrollWidth: docEl.scrollWidth,
              clientWidth: docEl.clientWidth,
              hasOverflow: docEl.scrollWidth > docEl.clientWidth + 1, // 1px rounding tolerance
            }
          })

          if (overflow.hasOverflow) {
            overflowFindings.push({
              screen: `${screen.label} > ${t.label}`,
              viewport: vp.width,
              theme,
              scrollWidth: overflow.scrollWidth,
              clientWidth: overflow.clientWidth,
            })
          }

          // Run axe-core accessibility analysis excluding iframes
          if (!isSkipAxe) {
            try {
              const axeResults = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
                .exclude("iframe")
                .analyze()

              if (axeResults.violations && axeResults.violations.length > 0) {
                for (const v of axeResults.violations) {
                  for (const node of v.nodes) {
                    const targetSelector = Array.isArray(node.target)
                      ? node.target.join(" ")
                      : String(node.target || "")
                    const groupKey = `${v.id}::${targetSelector}`

                    if (!groupedAxeViolations.has(groupKey)) {
                      const cleanHtml = (node.html || "")
                        .replace(/\r?\n/g, " ")
                        .replace(/\s+/g, " ")
                        .trim()
                      const snippet =
                        cleanHtml.length > 200 ? `${cleanHtml.slice(0, 197)}...` : cleanHtml
                      const safeSnippet = snippet.replace(/\|/g, "\\|")

                      const cleanSummary = (node.failureSummary || "")
                        .replace(/\r?\n/g, " ")
                        .replace(/\s+/g, " ")
                        .trim()
                        .replace(/\|/g, "\\|")

                      groupedAxeViolations.set(groupKey, {
                        id: v.id,
                        impact: v.impact || "moderate",
                        help: v.help,
                        helpUrl: v.helpUrl || "",
                        selector: targetSelector,
                        snippet: safeSnippet,
                        failureSummary: cleanSummary,
                        occurrences: [],
                      })
                    }

                    groupedAxeViolations
                      .get(groupKey)
                      .occurrences.push(`${screen.label} > ${t.label} (${vp.width}px, ${theme})`)
                  }
                }
              }
            } catch {
              // axe analysis error suppressed
            }
          }

          // Capture screenshot with <screen>-<tab>-<width>-<theme>.png format
          const screenshotPath = path.join(
            SCREENSHOTS_DIR,
            `${screen.id}-${t.id}-${vp.width}-${theme}.png`,
          )
          await page.screenshot({ path: screenshotPath, fullPage: false })
          totalScreenshots++

          const tabDurationMs = Date.now() - tabStart
          tabVisitDurations.push({
            screen: screen.label,
            tab: t.label,
            viewport: vp.width,
            theme,
            durationMs: tabDurationMs,
          })
        }

        // Record Tab Coverage for this (screen, viewport, theme) combo (Task C.3)
        const expectedClicks = tabsFound - tabsSkipped
        const comboStatus =
          tabsClicked >= expectedClicks && unvisitedTabsForCombo.length === 0 ? "PASS" : "FAIL"
        coverageRecords.push({
          screen: screen.label,
          viewport: vp.width,
          theme,
          tabsFound,
          tabsClicked,
          tabsSkipped,
          unvisitedTabs: unvisitedTabsForCombo,
          status: comboStatus,
        })
      }
    }

    // Navigation check for Customers and Expenses: verify Import CSV button navigates to #data?tab=import
    if (["customers", "expenses"].includes(screen.id)) {
      try {
        const importCsvBtn = page.getByRole("button", { name: "Import CSV" }).first()
        if (await importCsvBtn.isVisible().catch(() => false)) {
          await importCsvBtn.click()
          await page.waitForTimeout(300)
          const currentUrl = page.url()
          const isDataHash = currentUrl.includes("#data")
          const isStep1Visible = await page.getByText(/Step 1: Choose Data Type/i).isVisible().catch(() => false)
          if (!isDataHash || !isStep1Visible) {
            throw new Error(`Import CSV did not navigate to #data?tab=import (url: ${currentUrl}, step1: ${isStep1Visible})`)
          }
          console.log(`[ui:smoke] Verified 'Import CSV' navigation from ${screen.label} to #data?tab=import (wizard step 1 visible).`)
          // Navigate back to restore screen
          await page.goto(`${TARGET_URL}#${screen.tabId || screen.id}`)
          await page.waitForTimeout(300)
        }
      } catch (err) {
        console.error(`[ui:smoke] Extra check failed - Import CSV nav check error on ${screen.label}: ${err.message}`)
        extraCheckFailures.push({
          name: "Import CSV navigation",
          screen: screen.label,
          error: err.message,
        })
      }
    }

    // Extra Check: Payment History opens one dialog (Overview screen)
    if (screen.id === "dashboard") {
      let historyOpened = false
      try {
        const historyBtn = page.getByRole("button", { name: /payment history/i }).first()
        if (await historyBtn.isVisible().catch(() => false)) {
          await historyBtn.click()
          historyOpened = true
          await page.waitForTimeout(500)
          const dialogs = await page.$$('[role="dialog"]')
          if (dialogs.length !== 1) {
            throw new Error(`Expected exactly 1 dialog open on Payment History, found ${dialogs.length}`)
          }
          await page.keyboard.press("Escape")
          await page.waitForTimeout(300)
          const remainingDialogs = await page.$$('[role="dialog"]')
          if (remainingDialogs.length !== 0) {
            throw new Error(`Dialog remained open after Escape, count: ${remainingDialogs.length}`)
          }
          historyOpened = false
          console.log(`[ui:smoke] Verified 'Payment History opens one dialog' on ${screen.label}.`)
        }
      } catch (err) {
        console.error(`[ui:smoke] Extra check failed - Payment History dialog on ${screen.label}: ${err.message}`)
        extraCheckFailures.push({
          name: "Payment History opens one dialog",
          screen: screen.label,
          error: err.message,
        })
      } finally {
        if (historyOpened) {
          try {
            await page.keyboard.press("Escape").catch(() => {})
            await page.waitForTimeout(300)
          } catch {}
        }
      }
    }

    // Extra Check: Manifest modal check (Journeys screen)
    if (screen.id === "journey") {
      let manifestOpened = false
      try {
        const manifestMenuBtn = page.getByRole("button", { name: /print manifest/i }).first()
        if (await manifestMenuBtn.isVisible().catch(() => false)) {
          await manifestMenuBtn.click()
          await page.waitForTimeout(300)
          const withoutAadhaarOption = page.locator('button:has-text("Print Manifest (Without Aadhaar)")').first()
          if (await withoutAadhaarOption.isVisible().catch(() => false)) {
            await withoutAadhaarOption.click()
            manifestOpened = true
            await page.waitForTimeout(500)
            const modal = page.locator('[role="dialog"]')
            if (!(await modal.isVisible().catch(() => false))) {
              throw new Error("Manifest Print modal did not open")
            }

            // Wait for loading preview/manifest to resolve (up to 8s)
            const loadingIndicator = page.locator('[role="dialog"]').getByText(/Preparing manifest preview.../i)
            if (await loadingIndicator.isVisible().catch(() => false)) {
              await loadingIndicator.waitFor({ state: "detached", timeout: 8000 }).catch(() => {})
            }
            await page.waitForTimeout(300)

            const iframe = page.locator('iframe[title="Manifest Print Preview"]')
            if (!(await iframe.isVisible().catch(() => false))) {
              throw new Error("Manifest live print preview iframe not found or not visible")
            }

            // Check loaded passenger count
            const paxText = await page.locator('[role="dialog"]').getByText(/Passengers loaded/i).textContent().catch(() => "0 Passengers loaded")
            const paxMatch = paxText.match(/(\d+)\s+Passengers loaded/i)
            const paxCount = paxMatch ? parseInt(paxMatch[1], 10) : 0

            const printBtn = page.locator('[role="dialog"] button:has-text("Print Manifest")')
            const isPrintDisabled = await printBtn.isDisabled().catch(() => true)

            if (paxCount > 0) {
              if (isPrintDisabled) {
                throw new Error(`Print Manifest button is unexpectedly disabled for departure with ${paxCount} passengers`)
              }
              console.log(`[ui:smoke] Verified 'Manifest modal check (Without Aadhaar preset with ${paxCount} pax)' on ${screen.label}.`)
            } else {
              // 0 passengers: verify Print button is disabled and reason text is present
              if (!isPrintDisabled) {
                throw new Error("Print Manifest button should be disabled for departure with 0 passengers")
              }
              const reasonEl = page.locator('[role="dialog"] #manifest-print-disabled-reason')
              const reasonText = (await reasonEl.textContent().catch(() => "")) || ""
              console.log(`[ui:smoke] Verified 'Manifest modal check (0 passengers, disabled with reason text: "${reasonText}")' on ${screen.label}.`)
            }
          }
        }
      } catch (err) {
        console.error(`[ui:smoke] Extra check failed - Manifest modal check on ${screen.label}: ${err.message}`)
        extraCheckFailures.push({
          name: "Manifest modal check",
          screen: screen.label,
          error: err.message,
        })
      } finally {
        if (manifestOpened) {
          try {
            const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")')
            if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await cancelBtn.click().catch(() => {})
            } else {
              await page.keyboard.press("Escape").catch(() => {})
            }
            await page.waitForTimeout(300)
            const remaining = page.locator('[role="dialog"]')
            if (await remaining.isVisible().catch(() => false)) {
              await page.keyboard.press("Escape").catch(() => {})
              await page.waitForTimeout(200)
            }
          } catch {}
        }
      }
    }

    completedScreens.push(screen.label)
    const screenDuration = Date.now() - screenStart

    // Count errors attributed to this screen
    const screenConsoleErrors =
      consoleEntries.filter((c) => c.type === "error" && c.screen === screen.label).length -
      initialConsoleErrors
    const screenPageErrors =
      pageErrors.filter((p) => p.screen === screen.label).length - initialPageErrors
    const totalScreenErrors = screenConsoleErrors + screenPageErrors
    const screenBreaches = budgetBreaches.filter((b) => b.screen === screen.label).length

    const maxTabsFound = coverageRecords
      .filter((r) => r.screen === screen.label)
      .reduce((max, r) => Math.max(max, r.tabsFound || 0), 0)
    const tabLabel = maxTabsFound === 1 ? "1 tab" : `${maxTabsFound} tabs`

    // Task C.4 Terminal Summary: 1 summary line per screen, single write
    const summaryLine = formatScreenSummary({
      screenLabel: screen.label,
      viewportCount: activeViewports.length,
      themeCount: activeThemes.length,
      tabLabel,
      statesCount: totalStatesEvaluated,
      errorCount: totalScreenErrors,
      breachCount: screenBreaches,
      durationMs: screenDuration,
      budgetExceeded: screenBudgetExceeded,
    })
    process.stdout.write(summaryLine + "\n")

    // Write report incrementally after each screen!
    writeReport(false)
  }

  await browser.close()
  console.log(`[ui:smoke] Completed. Captured ${totalScreenshots} screenshots.`)
  writeReport(false)
  console.log(`[ui:smoke] Summary report written to ${reportPath}`)

  const consoleErrors = consoleEntries.filter((c) => c.type === "error")
  const consoleWarnings = consoleEntries.filter((c) => c.type === "warning")
  const hasCoverageFailures = coverageRecords.some((r) => r.status === "FAIL")
  const hasErrors = pageErrors.length > 0 || consoleErrors.length > 0
  const hasStrictWarnings = isStrict && consoleWarnings.length > 0

  const hasFailures =
    overflowFindings.length > 0 ||
    groupedAxeViolations.size > 0 ||
    fallbackFindings.length > 0 ||
    hasCoverageFailures ||
    budgetBreaches.length > 0 ||
    hasErrors ||
    hasStrictWarnings ||
    extraCheckFailures.length > 0

  if (hasFailures) {
    const reasons = []
    if (hasErrors) reasons.push(`${consoleErrors.length} console error(s), ${pageErrors.length} page error(s)`)
    if (hasStrictWarnings) reasons.push(`${consoleWarnings.length} console warning(s) (--strict)`)
    if (overflowFindings.length > 0) reasons.push(`${overflowFindings.length} overflow finding(s)`)
    if (groupedAxeViolations.size > 0) reasons.push(`${groupedAxeViolations.size} axe violation(s)`)
    if (fallbackFindings.length > 0) reasons.push(`${fallbackFindings.length} UI fallback(s)`)
    if (hasCoverageFailures) reasons.push("tab coverage failure(s)")
    if (budgetBreaches.length > 0) reasons.push(`${budgetBreaches.length} budget breach(es)`)
    if (extraCheckFailures.length > 0) reasons.push(`${extraCheckFailures.length} extra check failure(s)`)

    console.error(`[ui:smoke] FAILED: Issues found in ${reasons.join(", ")}.`)
    process.exit(1)
  } else {
    console.log("[ui:smoke] SUCCESS: All checks passed cleanly.")
  }
}

run().catch((err) => {
  console.error("[ui:smoke] Fatal execution error:", err)
  process.exit(1)
})
