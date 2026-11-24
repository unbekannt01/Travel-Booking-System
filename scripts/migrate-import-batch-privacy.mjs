/**
 * YatraHub (TBS) — ImportBatch Privacy Migration Script (6c-fix)
 *
 * Removes the legacy `fileName` field from all ImportBatch records ($unset fileName)
 * to ensure zero file paths, user names, or potentially hostile filenames persist in the database.
 *
 * SAFETY GUARANTEES:
 * - Default mode is DRY-RUN (NO database writes unless --apply is passed).
 * - Guard against accidental test database corruption: refuses test DB without --allow-test.
 * - Idempotent: can be run repeatedly safely.
 *
 * Usage:
 *   node scripts/migrate-import-batch-privacy.mjs               # Dry-run inspection
 *   node scripts/migrate-import-batch-privacy.mjs --apply       # Apply $unset to database
 *   node scripts/migrate-import-batch-privacy.mjs --apply --allow-test  # Apply to test DB
 */

import path from "node:path"
import dotenv from "dotenv"
import ImportBatch from "../backend/models/ImportBatch.js"

dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") })
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub"
const isApply = process.argv.includes("--apply")
const isAllowTest = process.argv.includes("--allow-test")

async function runMigration() {
  console.log(`[Privacy Migration] Starting ImportBatch privacy migration (${isApply ? "APPLY MODE" : "DRY-RUN MODE"})...`)

  const parsedUri = new URL(MONGODB_URI.replace("mongodb://", "http://"))
  const dbName = parsedUri.pathname.replace(/^\//, "")
  if (dbName.endsWith("_test") && !isAllowTest && process.env.NODE_ENV !== "test") {
    console.error(`[Privacy Migration] BLOCKED: Target database "${dbName}" is a test database. Pass --allow-test to execute on test DB.`)
    process.exit(1)
  }

  console.log(`[Privacy Migration] Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`)
  const mongooseInstance = ImportBatch.base
  await mongooseInstance.connect(MONGODB_URI)

  try {
    const totalBatches = await ImportBatch.countDocuments({})
    // Query directly via collection driver in case schema has already removed fileName property
    const batchesWithFileName = await ImportBatch.collection.countDocuments({ fileName: { $exists: true } })

    console.log("\n================ PRIVACY MIGRATION SUMMARY ================")
    console.log(`Target Database          : ${dbName}`)
    console.log(`Execution Mode           : ${isApply ? "APPLY ($unset fileName)" : "DRY-RUN (No writes)"}`)
    console.log(`Total Import Batches     : ${totalBatches}`)
    console.log(`Batches With fileName    : ${batchesWithFileName}`)
    console.log("============================================================\n")

    if (batchesWithFileName === 0) {
      console.log("[Privacy Migration] All ImportBatch records are already clean (zero fileName fields found).")
      return
    }

    if (!isApply) {
      console.log("[Privacy Migration] Dry-run complete. To strip fileName from these records, run:")
      console.log("  node scripts/migrate-import-batch-privacy.mjs --apply\n")
    } else {
      const updateResult = await ImportBatch.collection.updateMany(
        { fileName: { $exists: true } },
        { $unset: { fileName: "" } }
      )
      console.log(`[Privacy Migration] SUCCESS: Stripped fileName from ${updateResult.modifiedCount} ImportBatch record(s).`)
    }
  } catch (err) {
    console.error("[Privacy Migration] ERROR:", err.message)
    process.exit(1)
  } finally {
    await mongooseInstance.disconnect()
  }
}

runMigration()
