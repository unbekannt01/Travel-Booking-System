/**
 * YatraHub (TBS) — Customer Master Backfill Script (Part 5a & 6c-fix)
 *
 * Scans active bookings without customerId, normalizes contact mobile numbers,
 * groups by (userId, normalizedMobile), and links or creates Customer records.
 * Reuses the canonical customerLinker utility from backend/utils/customerLinker.js.
 *
 * SAFETY GUARANTEES:
 * - Default mode is --dry-run (NO database writes unless --apply is passed).
 * - Idempotent: can be run repeatedly without duplicating customer records or corrupting data.
 * - Non-PII: outputs counts and aggregate metrics only; never dumps names or phone numbers.
 * - Uses exact backend database configuration and Mongoose instance.
 *
 * Usage:
 *   node scripts/backfill-customers.mjs           # Dry-run inspection
 *   node scripts/backfill-customers.mjs --apply   # Apply changes to database
 */

import path from "node:path"
import dotenv from "dotenv"
import Booking from "../backend/models/Booking.js"
import { linkUnlinkedBookings } from "../backend/utils/customerLinker.js"

// Load backend/.env if present, fallback to root .env
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") })
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub"
const isApply = process.argv.includes("--apply")

async function runBackfill() {
  console.log(`[Backfill] Starting Customer Master backfill (${isApply ? "APPLY MODE" : "DRY-RUN MODE"})...`)
  console.log(`[Backfill] Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`)

  const mongooseInstance = Booking.base
  await mongooseInstance.connect(MONGODB_URI)

  try {
    const result = await linkUnlinkedBookings({ apply: isApply })

    console.log("\n================ BACKFILL SUMMARY ================")
    console.log(`Execution Mode           : ${isApply ? "APPLIED TO DATABASE" : "DRY-RUN (No changes written)"}`)
    console.log(`Total Bookings Scanned   : ${result.scannedCount}`)
    console.log(`New Customers ${isApply ? "Created" : "To Create"}: ${result.createdCustomerCount}`)
    console.log(`Existing Customers Matched: ${result.existingCustomerCount}`)
    console.log(`Bookings ${isApply ? "Linked" : "To Link"}       : ${result.linkedCount}`)
    console.log(`Bookings Skipped (Bad No): ${result.skippedCount}`)
    console.log("===================================================\n")

    if (!isApply) {
      console.log("ℹ️  Dry-run completed successfully without modifying data.")
      console.log("👉 Run with '--apply' to commit these changes to your database.")
    } else {
      console.log("✅ Customer Master backfill completed successfully!")
    }
  } finally {
    await mongooseInstance.disconnect()
  }
}

runBackfill().catch((err) => {
  console.error("[Backfill Error]", err.name, err.code || err.message)
  process.exit(1)
})
