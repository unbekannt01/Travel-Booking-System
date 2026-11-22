import { chromium } from "playwright"
import AxeBuilder from "@axe-core/playwright"
import fs from "node:fs"
import path from "node:path"

const TARGET_URL = process.env.UI_SMOKE_URL || "http://localhost:5173"
const EMAIL = process.env.UI_SMOKE_EMAIL
const PASSWORD = process.env.UI_SMOKE_PASSWORD

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
  process.exit(1)
}

const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots")
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
]

const THEMES = ["light", "dark"]

const SCREENS = [
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

async function run() {
  console.log(`[ui:smoke] Launching browser smoke test on ${TARGET_URL}...`)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleEntries = []
  const failedRequests = []
  const overflowFindings = []
  const fallbackFindings = []
  const groupedAxeViolations = new Map()

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

  // 1. Authenticate through the real login screen
  console.log("[ui:smoke] Step 1: Logging in...")
  await page.goto(TARGET_URL, { waitUntil: "networkidle" })

  const isAuthVisible = await page.$('input[type="password"]')
  if (isAuthVisible) {
    // Fill credentials
    const emailInput = (await page.$('input[type="email"]')) || (await page.$('input[autocomplete="username"]')) || (await page.$('input[type="text"]'))
    if (emailInput) await emailInput.fill(EMAIL)

    const passInput = await page.$('input[type="password"]')
    if (passInput) await passInput.fill(PASSWORD)

    const submitBtn = await page.$('button[type="submit"]')
    if (submitBtn) {
      await submitBtn.click()
      await page.waitForTimeout(1500)
    }
  }

  // Verify dashboard navigation exists
  try {
    await page.waitForSelector("#main-content", { timeout: 10000 })
    console.log("[ui:smoke] Logged in successfully.")
  } catch (loginErr) {
    console.error(`[ui:smoke] Login failed or #main-content not found: ${loginErr.message}`)
    console.error("[ui:smoke] Diagnostic checklist:")
    console.error("  1. Is backend running? (http://localhost:5000)")
    console.error("  2. Is frontend running? (http://localhost:5173)")
    console.error("  3. Are UI_SMOKE_EMAIL and UI_SMOKE_PASSWORD pointing to an active operator?")
    await browser.close()
    process.exit(1)
  }

  // 2. Iterate through screens, themes, and viewports (READ-ONLY)
  let totalScreenshots = 0

  for (const screen of SCREENS) {
    console.log(`[ui:smoke] Visiting screen: ${screen.label}...`)

    // Navigate to target screen read-only
    if (screen.isRoute) {
      await page.goto(`${TARGET_URL}/${screen.isRoute}`, { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(600)
    } else if (screen.isSettingsTab) {
      if (page.url().includes("#/ui-kit")) {
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
        await page.waitForTimeout(600)
      }
      const settingsNav = await page.$('button:has-text("Settings")')
      if (settingsNav) {
        await settingsNav.click()
        await page.waitForTimeout(600)
      }
      const studioTab = await page.$('button:has-text("Invoice Studio")')
      if (studioTab) {
        await studioTab.click()
        await page.waitForTimeout(600)
      }
    } else if (screen.isAnalyticsTab) {
      if (page.url().includes("#/ui-kit")) {
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
        await page.waitForTimeout(600)
      }
      const analyticsNav = await page.$('button:has-text("Analytics")')
      if (analyticsNav) {
        await analyticsNav.click()
        await page.waitForTimeout(600)
      }
      const pnlTab = await page.$('button:has-text("Profit & Loss")')
      if (pnlTab) {
        await pnlTab.click()
        await page.waitForTimeout(600)
      }
    } else if (screen.isAction === "new-booking") {
      // Return to main app if on hash route
      if (page.url().includes("#/ui-kit")) {
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
        await page.waitForTimeout(600)
      }
      const newBookingBtn = await page.$('button:has-text("New Booking")')
      if (newBookingBtn) {
        await newBookingBtn.click()
        await page.waitForTimeout(600)
      }
    } else {
      // Return to main app if on hash route
      if (page.url().includes("#/ui-kit")) {
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" })
        await page.waitForTimeout(600)
      }
      // Click sidebar or bottom nav item
      const navBtn = await page.$(`button:has-text("${screen.label}")`)
      if (navBtn) {
        await navBtn.click()
        await page.waitForTimeout(600)
      }
    }

    for (const theme of THEMES) {
      // Set theme via data-theme and localStorage
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t)
        try {
          localStorage.setItem("yatrahub-theme", t)
        } catch {}
      }, theme)

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.waitForTimeout(300)

        // Query tabs present on the active screen
        const tabLocators = page.locator('[role="tab"]')
        const tabCount = await tabLocators.count().catch(() => 0)
        const tabsToCrawl = []

        if (tabCount === 0) {
          tabsToCrawl.push({ id: "main", label: "Main", locator: null })
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
            tabsToCrawl.push({ id: clean, label: raw.trim() || `Tab ${i + 1}`, locator: tabLoc })
          }
        }

        for (const t of tabsToCrawl) {
          if (t.locator) {
            try {
              await t.locator.click({ timeout: 3000 })
              await page.waitForTimeout(350)
            } catch (clickErr) {
              console.warn(`[ui:smoke] Could not click tab "${t.label}": ${clickErr.message}`)
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

          // Run axe-core accessibility analysis
          try {
            const axeResults = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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
  }

  await browser.close()
  console.log(`[ui:smoke] Captured ${totalScreenshots} screenshots.`)

  // 3. Write summary report to docs/screenshots/report.md
  const reportPath = path.join(SCREENSHOTS_DIR, "report.md")
  const reportLines = [
    "# YatraHub (TBS) — UI Smoke & Accessibility Report",
    "",
    `**Execution Timestamp**: ${new Date().toISOString()}`,
    `**Target URL**: ${TARGET_URL}`,
    `**Total Screenshots Captured**: ${totalScreenshots}`,
    "",
    "## 1. Horizontal Overflow Checks (360px – 1440px)",
  ]

  if (overflowFindings.length === 0) {
    reportLines.push("✅ **Zero horizontal overflow detected across all screens, viewports, and themes.**")
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
  if (groupedAxeViolations.size === 0) {
    reportLines.push("✅ **Zero accessibility violations detected across all screens, viewports, and themes.**")
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
  reportLines.push("## 3. Console Errors & Warnings")
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
  if (warningsOnly.length > 0) {
    const groupedWarnings = new Map()
    for (const w of warningsOnly) {
      const key = w.text
      if (!groupedWarnings.has(key)) {
        groupedWarnings.set(key, { text: w.text, urls: new Set() })
      }
      groupedWarnings.get(key).urls.add(w.url)
    }
    for (const [, w] of groupedWarnings) {
      reportLines.push(`  - **Warning**: \`${w.text}\``)
      reportLines.push(`    - **Pages**: ${Array.from(w.urls).join(", ")}`)
    }
  }
  reportLines.push(`- **Failed Requests**: ${failedRequests.length}`)
  if (failedRequests.length > 0) {
    for (const req of failedRequests.slice(0, 10)) {
      reportLines.push(`  - \`${req}\``)
    }
  }

  reportLines.push("")
  reportLines.push("## 4. UI Error Fallback Checks")
  if (fallbackFindings.length === 0) {
    reportLines.push("✅ **Zero UI error fallbacks triggered across all screens, tabs, and viewports.**")
  } else {
    reportLines.push(`❌ **${fallbackFindings.length} UI error fallbacks detected:**`)
    reportLines.push("| Screen | Tab | Viewport | Theme | Triggered Error |")
    reportLines.push("| :--- | :--- | :---: | :---: | :--- |")
    for (const fb of fallbackFindings) {
      reportLines.push(
        `| ${fb.screen} | ${fb.tab} | ${fb.viewport}px | ${fb.theme} | ${fb.indicator} |`,
      )
    }
  }

  fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8")
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
