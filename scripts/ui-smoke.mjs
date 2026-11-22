import { chromium } from "playwright"
import AxeBuilder from "@axe-core/playwright"
import fs from "node:fs"
import path from "node:path"

// --- CLI ARGUMENTS & CONFIGURATION ---
const args = process.argv.slice(2)
const isQuick = args.includes("--quick")
const isSkipAxe = args.includes("--skip-axe")

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
const SCREEN_BUDGET_MS = 90000 // 90 seconds per screen

// Enforce local-only target
try {
  const parsed = new URL(TARGET_URL)
  if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    console.error(`[ui:smoke] Refusing to run: Target host must be localhost or 127.0.0.1, got "${parsed.hostname}".`)
    process.exit(1)
  }
} catch (e) {
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
  { id: "journey", label: "Journeys", tabId: "journey" },
  { id: "tours", label: "Destinations", tabId: "tours" },
  { id: "expenses", label: "Expenses", tabId: "expenses" },
  { id: "analytics", label: "Analytics", tabId: "analytics" },
  { id: "profit-loss", label: "Profit & Loss", isAnalyticsTab: "pnl" },
  { id: "settings", label: "Settings", tabId: "settings" },
  { id: "invoice-studio", label: "Invoice Studio", isSettingsTab: "studio" },
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
console.log(`  Step Timeout: ${STEP_TIMEOUT_MS}ms | Screen Budget: ${SCREEN_BUDGET_MS}ms`)
console.log(`  Screens (${activeScreens.length}): ${activeScreens.map((s) => s.label).join(", ")}`)
console.log(`  Viewports (${activeViewports.length}): ${activeViewports.map((v) => `${v.width}px`).join(", ")}`)
console.log(`  Themes (${activeThemes.length}): ${activeThemes.join(", ")}`)
console.log(`  axe-core analysis: ${isSkipAxe ? "SKIPPED (--skip-axe)" : "ENABLED (excluding iframe)"}`)

let browserInstance = null
let isInterrupted = false

async function run() {
  console.log(`[ui:smoke] Launching browser smoke test on ${TARGET_URL}...`)
  const browser = await chromium.launch({ headless: true })
  browserInstance = browser

  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(STEP_TIMEOUT_MS)

  const consoleEntries = []
  const failedRequests = []
  const httpFailures = [] // 429 and 5xx responses
  const overflowFindings = []
  const fallbackFindings = []
  const budgetBreaches = []
  const groupedAxeViolations = new Map()
  const completedScreens = []
  let totalScreenshots = 0
  let currentScreenLabel = "Init"

  page.on("console", (msg) => {
    const type = msg.type()
    if (type === "error" || type === "warning") {
      consoleEntries.push({
        type,
        text: msg.text(),
        url: page.url(),
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
          screen: currentScreenLabel,
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
    reportLines.push("## 4. Console Errors & Warnings")
    const errorsOnly = consoleEntries.filter((c) => c.type === "error")
    const warningsOnly = consoleEntries.filter((c) => c.type === "warning")
    reportLines.push(`- **Console Errors**: ${errorsOnly.length}`)
    if (errorsOnly.length > 0) {
      const groupedErrors = new Map()
      for (const err of errorsOnly) {
        const key = err.text
        if (!groupedErrors.has(key)) {
          groupedErrors.set(key, { text: err.text, urls: new Set() })
        }
        groupedErrors.get(key).urls.add(err.url)
      }
      for (const [, err] of groupedErrors) {
        reportLines.push(`  - **Error**: \`${err.text}\``)
        reportLines.push(`    - **Pages**: ${Array.from(err.urls).join(", ")}`)
      }
    }
    reportLines.push(`- **Console Warnings**: ${warningsOnly.length}`)
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

    if (budgetBreaches.length > 0) {
      reportLines.push("")
      reportLines.push("## 6. Budget Breaches (> 90s per screen)")
      for (const b of budgetBreaches) {
        reportLines.push(`- ⚠️ **${b.screen}**: took ${Math.round(b.durationMs / 1000)}s (budget 90s)`)
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
  currentScreenLabel = "Login"
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

  // 2. Iterate through screens, themes, and viewports (READ-ONLY)
  for (const screen of activeScreens) {
    if (isInterrupted) break
    const screenStart = Date.now()
    currentScreenLabel = screen.label
    console.log(`[ui:smoke] Visiting screen: ${screen.label}...`)

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
        if (settingsNav) {
          await settingsNav.click()
          await page.waitForTimeout(300)
        }
        const studioTab = await page.$('button:has-text("Invoice Studio")')
        if (studioTab) {
          await studioTab.click()
          await page.waitForTimeout(300)
        }
      } else if (screen.isAnalyticsTab) {
        if (page.url().includes("#/ui-kit")) {
          await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
          await page.waitForTimeout(300)
        }
        const analyticsNav = await page.$('button:has-text("Analytics")')
        if (analyticsNav) {
          await analyticsNav.click()
          await page.waitForTimeout(300)
        }
        const pnlTab = await page.$('button:has-text("Profit & Loss")')
        if (pnlTab) {
          await pnlTab.click()
          await page.waitForTimeout(300)
        }
      } else if (screen.isAction === "new-booking") {
        if (page.url().includes("#/ui-kit")) {
          await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
          await page.waitForTimeout(300)
        }
        const newBookingBtn = await page.$('button:has-text("New Booking")')
        if (newBookingBtn) {
          await newBookingBtn.click()
          await page.waitForTimeout(300)
        }
      } else {
        if (page.url().includes("#/ui-kit")) {
          await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
          await page.waitForTimeout(300)
        }
        const navBtn = await page.$(`button:has-text("${screen.label}")`)
        if (navBtn) {
          await navBtn.click()
          await page.waitForTimeout(300)
        }
      }
    } catch (navErr) {
      console.warn(`[ui:smoke] Navigation error on ${screen.label}: ${navErr.message}`)
    }

    let screenBudgetExceeded = false

    for (const theme of activeThemes) {
      if (screenBudgetExceeded || isInterrupted) break

      // Set theme via data-theme and localStorage
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t)
        try {
          localStorage.setItem("yatrahub-theme", t)
        } catch {}
      }, theme)

      for (const vp of activeViewports) {
        if (Date.now() - screenStart > SCREEN_BUDGET_MS) {
          console.warn(`[ui:smoke] Screen budget (90s) exceeded on "${screen.label}". Moving to next screen.`)
          budgetBreaches.push({ screen: screen.label, durationMs: Date.now() - screenStart })
          screenBudgetExceeded = true
          break
        }
        if (isInterrupted) break

        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.waitForTimeout(200)

        // Query tabs present on the active screen
        const tabLocators = page.locator('[role="tab"]')
        const tabCount = await tabLocators.count().catch(() => 0)
        const tabsToCrawl = []

        if (tabCount === 0) {
          tabsToCrawl.push({ id: "main", label: "Main", locator: null, disabled: false })
        } else {
          for (let i = 0; i < tabCount; i++) {
            const tabLoc = tabLocators.nth(i)
            const raw = (await tabLoc.innerText().catch(() => "")) || ""
            const clean =
              raw
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") || `tab-${i + 1}`
            const isDisabled = await tabLoc.evaluate((el) => {
              return el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true"
            }).catch(() => false)
            tabsToCrawl.push({ id: clean, label: raw.trim() || `Tab ${i + 1}`, locator: tabLoc, disabled: isDisabled })
          }
        }

        for (const t of tabsToCrawl) {
          if (Date.now() - screenStart > SCREEN_BUDGET_MS) {
            screenBudgetExceeded = true
            break
          }
          if (isInterrupted) break

          if (t.locator) {
            if (t.disabled) {
              console.log(`[ui:smoke] Skipped disabled tab "${t.label}"`)
              continue
            }
            try {
              await t.locator.click({ timeout: 5000 })
              await page.waitForTimeout(250)
            } catch (clickErr) {
              console.warn(`[ui:smoke] Could not click tab "${t.label}": ${clickErr.message.split("\n")[0]}`)
            }
          }

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
            console.error(
              `[ui:smoke] ERROR FALLBACK DETECTED: "${fallbackIndicator}" on screen "${screen.label}", tab "${t.label}" (${vp.width}px, ${theme})`,
            )
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
            } catch (axeErr) {
              console.warn(
                `[ui:smoke] axe analysis skipped for ${screen.id} > ${t.id} @ ${vp.width}px: ${axeErr.message}`,
              )
            }
          }

          // Capture screenshot with <screen>-<tab>-<width>-<theme>.png format
          const screenshotPath = path.join(
            SCREENSHOTS_DIR,
            `${screen.id}-${t.id}-${vp.width}-${theme}.png`,
          )
          await page.screenshot({ path: screenshotPath, fullPage: false })
          totalScreenshots++
        }
      }
    }

    completedScreens.push(screen.label)
    // Write report incrementally after each screen!
    writeReport(false)
  }

  await browser.close()
  console.log(`[ui:smoke] Completed. Captured ${totalScreenshots} screenshots.`)
  writeReport(false)
  console.log(`[ui:smoke] Summary report written to ${reportPath}`)

  const hasFailures =
    overflowFindings.length > 0 ||
    groupedAxeViolations.size > 0 ||
    fallbackFindings.length > 0
  if (hasFailures) {
    console.error(
      "[ui:smoke] FAILED: Issues found in horizontal overflow, accessibility, or UI error fallbacks.",
    )
    process.exit(1)
  } else {
    console.log("[ui:smoke] SUCCESS: All checks passed cleanly.")
  }
}

run().catch((err) => {
  console.error("[ui:smoke] Fatal execution error:", err)
  process.exit(1)
})
