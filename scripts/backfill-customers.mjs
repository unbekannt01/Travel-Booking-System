/**
 * YatraHub (TBS) — Customer Master Backfill Script (Part 5a)
 *
 * Scans active bookings without customerId, normalizes contact mobile numbers,
 * groups by (userId, normalizedMobile), and links or creates Customer records.
 *
 * SAFETY GUARANTEES:
 * - Default mode is --dry-run (NO database writes unless --apply is passed).
 * - Idempotent: can be run repeatedly without duplicating customer records or corrupting data.
 * - Non-PII: outputs counts and aggregate metrics only; never dumps names or phone numbers.
 * - Non-destructive: never alters booking financials, seats, tickets, or invoice numbers.
 *
 * Usage:
 *   node scripts/backfill-customers.mjs           # Dry-run inspection
 *   node scripts/backfill-customers.mjs --apply   # Apply changes to database
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import Booking from "../backend/models/Booking.js"
import Customer from "../backend/models/Customer.js"
import { normalizeIndianMobile, pickDisplayName } from "../shared/customers.js"

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub"
const isApply = process.argv.includes("--apply")

async function runBackfill() {
  console.log(`[Backfill] Starting Customer Master backfill (${isApply ? "APPLY MODE" : "DRY-RUN MODE"})...`)
  console.log(`[Backfill] Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`)

  await mongoose.connect(MONGODB_URI)

  try {
    // 1. Query active bookings where customerId is null or missing
    const unlinkedBookings = await Booking.find({
      $or: [{ customerId: null }, { customerId: { $exists: false } }],
      deletedAt: null,
    }).select("_id userId contactName contactPhone contactEmail createdAt")

    console.log(`[Backfill] Found ${unlinkedBookings.length} unlinked active bookings.`)

    if (unlinkedBookings.length === 0) {
      console.log("[Backfill] All active bookings already linked to Customer records. Nothing to do.")
      return
    }

    // 2. Group bookings by user + normalized phone
    let skippedInvalidPhone = 0
    const customerGroups = new Map() // key: `${userId}:${normalizedPhone}`

    for (const b of unlinkedBookings) {
      const { valid, normalized } = normalizeIndianMobile(b.contactPhone)
      if (!valid || !normalized) {
        skippedInvalidPhone++
        continue
      }

      const key = `${b.userId.toString()}:::${normalized}`
      if (!customerGroups.has(key)) {
        customerGroups.set(key, {
          userId: b.userId,
          phone: normalized,
          names: [],
          emails: [],
          bookingIds: [],
        })
      }

      const group = customerGroups.get(key)
      if (b.contactName) group.names.push(b.contactName.trim())
      if (b.contactEmail) group.emails.push(b.contactEmail.trim())
      group.bookingIds.push(b._id)
    }

    console.log(`[Backfill] Grouped into ${customerGroups.size} unique customer phone clusters across operators.`)
    if (skippedInvalidPhone > 0) {
      console.log(`[Backfill] Skipped ${skippedInvalidPhone} bookings due to missing/invalid Indian mobile numbers.`)
    }

    // 3. Process each group
    let createdCount = 0
    let existingLinkedCount = 0
    let totalBookingsLinked = 0

    for (const [, group] of customerGroups) {
      const displayName = pickDisplayName(group.names) || "Customer"
      const candidateEmail = group.emails.find(Boolean) || ""
      const uniqueAliases = Array.from(new Set(group.names.filter((n) => n && n !== displayName))).slice(0, 5)

      if (isApply) {
        // Find or create customer
        const existing = await Customer.findOne({
          userId: group.userId,
          phone: group.phone,
          deletedAt: null,
        })

        let customerId = null

        if (existing) {
          existingLinkedCount++
          customerId = existing._id

          // Add any new aliases if under limit
          if (uniqueAliases.length > 0) {
            const currentAliases = new Set(existing.aliases || [])
            for (const alias of uniqueAliases) {
              if (currentAliases.size < 5) currentAliases.add(alias)
            }
            existing.aliases = Array.from(currentAliases)
            await existing.save().catch(() => {})
          }
        } else {
          createdCount++
          const newCustomer = new Customer({
            userId: group.userId,
            phone: group.phone,
            name: displayName,
            email: candidateEmail,
            language: "en",
            tags: [],
            notes: "",
            whatsappOptOut: false,
            aliases: uniqueAliases,
            source: "backfill",
            deletedAt: null,
          })
          const saved = await newCustomer.save()
          customerId = saved._id
        }

        // Link bookings
        const updateRes = await Booking.updateMany(
          { _id: { $in: group.bookingIds } },
          { $set: { customerId } }
        )
        totalBookingsLinked += updateRes.modifiedCount || group.bookingIds.length
      } else {
        // Dry-run mode: check if customer already exists in DB
        const existing = await Customer.findOne({
          userId: group.userId,
          phone: group.phone,
          deletedAt: null,
        })
        if (existing) {
          existingLinkedCount++
        } else {
          createdCount++
        }
        totalBookingsLinked += group.bookingIds.length
      }
    }

    // 4. Output Summary Report
    console.log("\n================ BACKFILL SUMMARY ================")
    console.log(`Execution Mode           : ${isApply ? "APPLIED TO DATABASE" : "DRY-RUN (No changes written)"}`)
    console.log(`Total Bookings Scanned   : ${unlinkedBookings.length}`)
    console.log(`Unique Customers Found   : ${customerGroups.size}`)
    console.log(`New Customers ${isApply ? "Created" : "To Create"}: ${createdCount}`)
    console.log(`Existing Customers Matched: ${existingLinkedCount}`)
    console.log(`Bookings ${isApply ? "Linked" : "To Link"}       : ${totalBookingsLinked}`)
    console.log(`Bookings Skipped (Bad No): ${skippedInvalidPhone}`)
    console.log("===================================================\n")

    if (!isApply) {
      console.log("ℹ️  Dry-run completed successfully without modifying data.")
      console.log("👉 Run with '--apply' to commit these changes to your database.")
    } else {
      console.log("✅ Customer Master backfill completed successfully!")
    }
  } finally {
    await mongoose.disconnect()
  }
}

runBackfill().catch((err) => {
  console.error("[Backfill Error]", err.message)
  process.exit(1)
})
