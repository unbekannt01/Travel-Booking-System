import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const srcFile = path.resolve(__dirname, "../shared/businessLogic.js")
const destFile = path.resolve(__dirname, "../shared/businessLogic.cjs")

function syncBusinessLogic() {
  const content = fs.readFileSync(srcFile, "utf-8")

  // Extract all exported function names
  const matches = [...content.matchAll(/export\s+function\s+([a-zA-Z0-9_]+)/g)]
  const fnNames = matches.map((m) => m[1])

  if (fnNames.length === 0) {
    throw new Error("No exported functions found in shared/businessLogic.js")
  }

  // Convert `export function foo(` to `function foo(`
  let cjsBody = content.replace(/export\s+function\s+/g, "function ")

  // Clean any existing module.exports or ESM export statement at the end if present
  cjsBody = cjsBody.replace(/export\s*\{[^}]*\}\s*;?/g, "")
  cjsBody = cjsBody.replace(/module\.exports\s*=\s*\{[^}]*\}\s*;?/g, "")

  const header = `/**
 * AUTO-GENERATED from shared/businessLogic.js - DO NOT EDIT MANUALLY.
 * Run 'npm run sync:logic' to regenerate from canonical ESM source.
 */
`

  const footer = `
module.exports = {
  ${fnNames.join(",\n  ")},
}
`

  const output = `${header}\n${cjsBody.trim()}\n${footer}`
  fs.writeFileSync(destFile, output, "utf-8")
  console.log(`[sync:logic] Successfully generated shared/businessLogic.cjs (${fnNames.length} functions synced).`)
}

syncBusinessLogic()
