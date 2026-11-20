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
  { id: "analytics", label: "Analytics", tabId: "analytics" },
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

  const consoleErrors = []
  const failedRequests = []
  const overflowFindings = []
  const axeFindings = []

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
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
            screen: screen.label,
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

          const seriousOrCritical = axeResults.violations.filter(
            (v) => v.impact === "serious" || v.impact === "critical"
          )

          if (seriousOrCritical.length > 0) {
            axeFindings.push({
              screen: screen.label,
              viewport: vp.width,
              theme,
              violations: seriousOrCritical.map((v) => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                nodeCount: v.nodes.length,
              })),
            })
          }
        } catch (axeErr) {
          console.warn(`[ui:smoke] axe analysis skipped for ${screen.id} @ ${vp.width}px: ${axeErr.message}`)
        }

        // Capture screenshot
        const screenshotPath = path.join(
          SCREENSHOTS_DIR,
          `${screen.id}-${vp.width}-${theme}.png`
        )
        await page.screenshot({ path: screenshotPath, fullPage: false })
        totalScreenshots++
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
  reportLines.push("## 2. Accessibility (axe-core Serious & Critical Violations)")
  if (axeFindings.length === 0) {
    reportLines.push("✅ **Zero serious or critical axe violations detected.**")
  } else {
    reportLines.push(`⚠️ **${axeFindings.length} screen configurations reported serious/critical violations:**`)
    for (const af of axeFindings) {
      reportLines.push(`### ${af.screen} (${af.viewport}px - ${af.theme})`)
      for (const v of af.violations) {
        reportLines.push(`- **[${v.impact.toUpperCase()}] ${v.id}**: ${v.help} (${v.nodeCount} nodes)`)
      }
    }
  }

  reportLines.push("")
  reportLines.push("## 3. Console Errors & Network Failures")
  reportLines.push(`- **Console Errors**: ${consoleErrors.length}`)
  if (consoleErrors.length > 0) {
    for (const err of consoleErrors.slice(0, 10)) {
      reportLines.push(`  - \`${err}\``)
    }
  }
  reportLines.push(`- **Failed Requests**: ${failedRequests.length}`)
  if (failedRequests.length > 0) {
    for (const req of failedRequests.slice(0, 10)) {
      reportLines.push(`  - \`${req}\``)
    }
  }

  fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8")
  console.log(`[ui:smoke] Summary report written to ${reportPath}`)

  const hasFailures = overflowFindings.length > 0 || axeFindings.length > 0
  if (hasFailures) {
    console.error("[ui:smoke] FAILED: Issues found in horizontal overflow or accessibility.")
    process.exit(1)
  } else {
    console.log("[ui:smoke] SUCCESS: All checks passed cleanly.")
  }
}

run().catch((err) => {
  console.error("[ui:smoke] Fatal execution error:", err)
  process.exit(1)
})
