const Database = require("better-sqlite3")
const path = require("path")
const fs = require("fs")

let dbInstance = null

function getDbPath(customPath) {
  if (customPath) return customPath
  if (process.env.YATRAHUB_DB_PATH) return process.env.YATRAHUB_DB_PATH

  try {
    const { app } = require("electron")
    if (app && typeof app.getPath === "function") {
      const userData = app.getPath("userData")
      if (!fs.existsSync(userData)) {
        fs.mkdirSync(userData, { recursive: true })
      }
      return path.join(userData, "yatrahub.db")
    }
  } catch {
    // electron app not yet available or in standalone node
  }

  return path.join(process.cwd(), "yatrahub.db")
}

function initDatabase(customPath) {
  if (dbInstance) return dbInstance

  const dbPath = getDbPath(customPath)
  const dir = path.dirname(dbPath)
  if (dbPath !== ":memory:" && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  db.pragma("busy_timeout = 5000")

  dbInstance = db
  return db
}

function getDatabase() {
  if (!dbInstance) {
    return initDatabase()
  }
  return dbInstance
}

function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close()
    } catch {
      // ignore
    }
    dbInstance = null
  }
}

module.exports = {
  getDbPath,
  initDatabase,
  getDatabase,
  closeDatabase,
}
