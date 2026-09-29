const path = require("path")
const fs = require("fs")
const { dialog } = require("electron")
const { getDbPath, initDatabase, closeDatabase } = require("./db/database.cjs")
const { runMigrations } = require("./db/migrate.cjs")

function getBackupsDir() {
  const dbPath = getDbPath()
  const baseDir = path.dirname(dbPath)
  const backupsDir = path.join(baseDir, "backups")
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }
  return backupsDir
}

async function performAutoDailyBackup(db) {
  if (!db) return null
  const backupsDir = getBackupsDir()
  const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const backupFileName = `yatrahub-backup-${todayStr}.db`
  const backupPath = path.join(backupsDir, backupFileName)

  if (fs.existsSync(backupPath)) {
    return { skipped: true, reason: "Today's backup already exists", path: backupPath }
  }

  try {
    await db.backup(backupPath)
    console.log(`[YatraHub Backup] Auto daily backup created: ${backupPath}`)

    // Prune backups keeping the last 7
    pruneOldBackups(backupsDir, 7)

    return { success: true, path: backupPath, date: todayStr }
  } catch (err) {
    console.error("[YatraHub Backup] Auto backup failed:", err)
    return { success: false, error: err.message }
  }
}

function pruneOldBackups(backupsDir, keepCount = 7) {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith("yatrahub-backup-") && f.endsWith(".db"))
      .map((f) => {
        const full = path.join(backupsDir, f)
        const stat = fs.statSync(full)
        return { name: f, path: full, mtime: stat.mtime }
      })
      .sort((a, b) => b.mtime - a.mtime)

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount)
      for (const item of toDelete) {
        fs.unlinkSync(item.path)
        console.log(`[YatraHub Backup] Pruned older backup: ${item.name}`)
      }
    }
  } catch (err) {
    console.error("[YatraHub Backup] Error pruning backups:", err)
  }
}

function getBackupStats() {
  const backupsDir = getBackupsDir()
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith("yatrahub-backup-") && f.endsWith(".db"))
      .map((f) => {
        const full = path.join(backupsDir, f)
        const stat = fs.statSync(full)
        return { name: f, path: full, size: stat.size, mtime: stat.mtime }
      })
      .sort((a, b) => b.mtime - a.mtime)

    return {
      backupsDir,
      backupCount: files.length,
      lastBackupTime: files.length > 0 ? files[0].mtime : null,
      latestBackupName: files.length > 0 ? files[0].name : null,
      files,
    }
  } catch {
    return {
      backupsDir,
      backupCount: 0,
      lastBackupTime: null,
      latestBackupName: null,
      files: [],
    }
  }
}

async function exportDatabaseBackup(db, browserWindow) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const result = await dialog.showSaveDialog(browserWindow, {
    title: "Export YatraHub Database Backup",
    defaultPath: `yatrahub-backup-${todayStr}.db`,
    filters: [
      { name: "SQLite Database", extensions: ["db", "sqlite"] },
      { name: "All Files", extensions: ["*"] },
    ],
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  try {
    await db.backup(result.filePath)
    return { success: true, filePath: result.filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function restoreDatabaseBackup(getDb, setDb, browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: "Select YatraHub Backup to Restore",
    filters: [
      { name: "SQLite Database", extensions: ["db", "sqlite"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  })

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const selectedPath = result.filePaths[0]

  try {
    const activeDb = getDb()
    const targetDbPath = getDbPath()

    // 1. Close active db connection
    closeDatabase()

    // 2. Overwrite target db file with selected backup
    fs.copyFileSync(selectedPath, targetDbPath)

    // 3. Remove existing WAL / SHM auxiliary files if present
    const walPath = `${targetDbPath}-wal`
    const shmPath = `${targetDbPath}-shm`
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)

    // 4. Reopen database and run any migrations
    const newDb = initDatabase()
    runMigrations(newDb)
    setDb(newDb)

    // 5. Reload BrowserWindow
    if (browserWindow) {
      browserWindow.reload()
    }

    return { success: true }
  } catch (err) {
    console.error("[YatraHub Backup] Restore failed:", err)
    // Attempt recovery
    initDatabase()
    return { success: false, error: err.message }
  }
}

module.exports = {
  getBackupsDir,
  performAutoDailyBackup,
  getBackupStats,
  exportDatabaseBackup,
  restoreDatabaseBackup,
}
