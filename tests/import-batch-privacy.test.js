import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import mongoose from "../backend/node_modules/mongoose/index.js"
import ImportBatch from "../backend/models/ImportBatch.js"

const TEST_DB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/yatrahub_test"

describe("ImportBatch Privacy & Zero-FileName Migration Tests (Part 6c-fix)", () => {
  let isMongoAvailable = false

  before(async () => {
    const parsedUri = new URL(TEST_DB_URI.replace("mongodb://", "http://"))
    const dbName = parsedUri.pathname.replace(/^\//, "")
    if (!dbName.endsWith("_test")) {
      throw new Error(`SAFETY: Target DB "${dbName}" is not a test database.`)
    }

    try {
      await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 })
      isMongoAvailable = true
    } catch {
      console.warn("MongoDB offline, skipping tests")
      isMongoAvailable = false
      return
    }

    await ImportBatch.deleteMany({})
  })

  after(async () => {
    if (isMongoAvailable) {
      await ImportBatch.deleteMany({})
      await mongoose.disconnect()
    }
  })

  it("1. ImportBatch schema sanitizes and discards fileName from records", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const fakeUserId = new mongoose.Types.ObjectId()
    const batch = await ImportBatch.create({
      userId: fakeUserId,
      type: "customers",
      status: "committed",
      totalRows: 10,
      successCount: 10,
      fileName: "Confidential_Customer_Export_2026.csv", // Should not be in schema
    })

    assert.equal(batch.fileName, undefined, "Schema property fileName must be undefined")

    // Check raw MongoDB document via native collection driver
    const rawDoc = await ImportBatch.collection.findOne({ _id: batch._id })
    assert.equal(rawDoc.fileName, undefined, "MongoDB document must not store fileName property")
    assert.equal(rawDoc.status, "committed")
    assert.equal(rawDoc.successCount, 10)
  })

  it("2. migrate-import-batch-privacy.mjs removes legacy fileName fields with --apply --allow-test", async (t) => {
    if (!isMongoAvailable) return t.skip("MongoDB offline")

    const fakeUserId = new mongoose.Types.ObjectId()

    // Insert legacy document directly with fileName bypass schema
    await ImportBatch.collection.insertOne({
      userId: fakeUserId,
      type: "expenses",
      status: "committed",
      totalRows: 5,
      successCount: 5,
      fileName: "Legacy_Operator_Expenses.csv",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const legacyBefore = await ImportBatch.collection.countDocuments({ fileName: { $exists: true } })
    assert.equal(legacyBefore, 1, "Should have 1 legacy document with fileName")

    // Run migration script with --apply --allow-test
    const scriptPath = path.resolve(process.cwd(), "scripts/migrate-import-batch-privacy.mjs")
    const proc = spawn("node", [scriptPath, "--apply", "--allow-test"], {
      env: { ...process.env, MONGODB_URI: TEST_DB_URI, NODE_ENV: "test" },
      stdio: "pipe",
    })

    const exitCode = await new Promise((resolve) => {
      proc.on("close", resolve)
    })

    assert.equal(exitCode, 0, "Migration script must exit with 0")

    const legacyAfter = await ImportBatch.collection.countDocuments({ fileName: { $exists: true } })
    assert.equal(legacyAfter, 0, "All fileName fields must be unset after migration")
  })
})
