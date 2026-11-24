import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

describe("Design System v2 Token Guard (Step 0)", () => {
  it("enforces that all --yh- tokens referenced in src/ are defined in src/index.css", () => {
    const rootDir = process.cwd()
    const indexCssPath = path.join(rootDir, "src/index.css")
    assert.ok(fs.existsSync(indexCssPath), "src/index.css must exist")

    const cssContent = fs.readFileSync(indexCssPath, "utf8")
    const definedVars = new Set()
    const varDefRegex = /(--yh-[a-zA-Z0-9_-]+)\s*:/g
    let match
    while ((match = varDefRegex.exec(cssContent)) !== null) {
      definedVars.add(match[1])
    }

    assert.ok(definedVars.size >= 50, `Expected at least 50 defined tokens, found ${definedVars.size}`)

    function scanDir(dir) {
      let results = []
      const entries = fs.readdirSync(dir)
      for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          results = results.concat(scanDir(fullPath))
        } else if (/\.(jsx?|css)$/.test(entry)) {
          results.push(fullPath)
        }
      }
      return results
    }

    const srcFiles = scanDir(path.join(rootDir, "src"))
    const violations = []
    const yhRefRegex = /--yh-[a-zA-Z0-9_-]+/g

    for (const filePath of srcFiles) {
      // Skip the source definition file itself
      if (path.normalize(filePath) === path.normalize(indexCssPath)) continue

      const content = fs.readFileSync(filePath, "utf8")
      let tokenMatch
      while ((tokenMatch = yhRefRegex.exec(content)) !== null) {
        const token = tokenMatch[0]
        if (!definedVars.has(token)) {
          const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/")
          violations.push(`${relPath} references undefined token "${token}"`)
        }
      }
    }

    if (violations.length > 0) {
      assert.fail(`Token Guard failed with ${violations.length} undefined token references:\n${violations.join("\n")}`)
    }

    assert.equal(violations.length, 0, "All referenced tokens must be defined")
  })
})
