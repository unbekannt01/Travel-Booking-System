/**
 * Migration Script: Normalize legacy Expense tourRef into tourName and departureKey (Part 4b)
 *
 * Usage (from the project root, D:\Travel-Booking-System):
 *   node scripts/migrate-expense-tourref.mjs --dry-run
 *   node scripts/migrate-expense-tourref.mjs
 *
 * Safe & Idempotent: Old rows work via read-time normalization (parseTourRef).
 * This one-off script explicitly backfills tourName and departureKey fields for existing rows.
 */

import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import mongoose from "../backend/node_modules/mongoose/index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, "../backend/.env") })
dotenv.config({ path: path.join(__dirname, "../.env") })

const { parseTourRef } = await import("../shared/profitLoss.js")
const { default: Expense } = await import("../backend/models/Expense.js")

const isDryRun = process.argv.includes("--dry-run")
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub"

async function run() {
  console.log(`Connecting to MongoDB at: ${mongoUri}`)
  console.log(`Dry-run mode: ${isDryRun ? "ENABLED (no changes will be written)" : "DISABLED"}`)

  await mongoose.connect(mongoUri)
  console.log("Connected successfully.")

  const expenses = await Expense.find({})
  console.log(`Found ${expenses.length} expenses to inspect.`)

  let modifiedCount = 0
  let unchangedCount = 0

  for (const exp of expenses) {
    let modified = false
    const parsed = parseTourRef(exp.tourRef || exp.departureKey || exp.tourName)

    if (parsed.isDeparture) {
      if (!exp.departureKey) {
        exp.departureKey = parsed.departureKey
        modified = true
      }
      if (!exp.tourName) {
        exp.tourName = parsed.tourName
        modified = true
      }
    } else if (!parsed.isGeneral) {
      if (!exp.tourName) {
        exp.tourName = parsed.tourName
        modified = true
      }
    }

    if (modified) {
      modifiedCount++
      if (!isDryRun) {
        await exp.save()
      }
    } else {
      unchangedCount++
    }
  }

  console.log("--- Migration Complete ---")
  console.log(`Total inspected: ${expenses.length}`)
  console.log(`Modified: ${modifiedCount} ${isDryRun ? "(simulated)" : "(written to DB)"}`)
  console.log(`Unchanged: ${unchangedCount}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
