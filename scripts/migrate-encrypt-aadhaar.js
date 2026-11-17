/**
 * Migration Script: Encrypt Plaintext Aadhaar Numbers in MongoDB (SEC-012)
 *
 * Usage:
 *   node scripts/migrate-encrypt-aadhaar.js [--dry-run]
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { encryptAadhaar } from "../backend/utils/aadhaar.js"
import Booking from "../backend/models/Booking.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, "../backend/.env") })
dotenv.config({ path: path.join(__dirname, "../.env") })

const isDryRun = process.argv.includes("--dry-run")
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/sb_tourism"

async function run() {
  console.log(`Connecting to MongoDB at: ${mongoUri}`)
  console.log(`Dry-run mode: ${isDryRun ? "ENABLED (no changes will be written)" : "DISABLED"}`)

  await mongoose.connect(mongoUri)
  console.log("Connected successfully.")

  const bookings = await Booking.find({})
  console.log(`Found ${bookings.length} bookings to inspect.`)

  let inspectedCount = 0
  let encryptedPaxCount = 0

  for (const booking of bookings) {
    let modified = false

    if (Array.isArray(booking.passengers)) {
      for (const pax of booking.passengers) {
        if (pax.aadhar && !pax.aadharEncrypted) {
          const parts = pax.aadhar.split(":")
          // If already in 3-part hex format, skip
          if (parts.length === 3 && parts[0].length === 24) {
            pax.aadharEncrypted = true
            modified = true
            continue
          }

          const raw = pax.aadhar
          pax.aadhar = encryptAadhaar(raw)
          pax.aadharEncrypted = true
          modified = true
          encryptedPaxCount++
        }
      }
    }

    if (modified) {
      inspectedCount++
      if (!isDryRun) {
        await booking.save()
      }
    }
  }

  console.log("Migration summary:")
  console.log(`  Bookings inspected/updated: ${inspectedCount}`)
  console.log(`  Passengers encrypted: ${encryptedPaxCount}`)
  console.log(isDryRun ? "DRY-RUN completed. No records modified." : "Migration completed successfully.")

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
