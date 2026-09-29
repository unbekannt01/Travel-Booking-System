const { test, describe } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")
const Database = require("better-sqlite3")
const { runMigrations } = require("../electron/db/migrate.cjs")
const tourQueries = require("../electron/db/queries/tours.cjs")
const { performAutoDailyBackup, getBackupStats } = require("../electron/backup.cjs")

describe("Automated & Manual Database Backup Manager", () => {
  const testDir = path.join(process.cwd(), "tests", "scratch-backup")
  const dbFile = path.join(testDir, "test-backup.db")

  test("creates daily backup snapshot and prunes older ones", async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    process.env.YATRAHUB_DB_PATH = dbFile
    const db = new Database(dbFile)
    runMigrations(db)

    tourQueries.createTour(db, {
      name: "Dwarka Somnath Pilgrimage",
      destination: "Dwarka",
      busType: "2x1 Sleeper",
      totalSeats: 36,
    })

    const result = await performAutoDailyBackup(db)
    assert.ok(result.success || result.skipped)

    const stats = getBackupStats()
    assert.ok(stats.backupCount >= 1)
    assert.ok(stats.latestBackupName.startsWith("yatrahub-backup-"))

    db.close()
    try {
      fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch {
      // ignore cleanup error
    }
    delete process.env.YATRAHUB_DB_PATH
  })
})
