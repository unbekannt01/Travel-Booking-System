const { app, BrowserWindow } = require("electron")
const path = require("path")
const { initDatabase, closeDatabase, getDbPath } = require("./db/database.cjs")
const { runMigrations } = require("./db/migrate.cjs")
const { registerIpcHandlers } = require("./ipc.cjs")

let mainWindow = null
let db = null

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: "YatraHub - Bus & Tour Management",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  // Remove default menu bar for clean app feel (can be toggled in dev)
  mainWindow.setMenuBarVisibility(false)

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production"
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173"

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Retry loading if dev server is still starting
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL(devUrl)
      }, 1500)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  try {
    // 1. Initialize SQLite Database
    db = initDatabase()
    console.log(`[YatraHub DB] Initialized at: ${getDbPath()}`)

    // 2. Run Database Migrations
    const version = runMigrations(db)
    console.log(`[YatraHub DB] Schema at version: ${version}`)

    // 3. Register IPC Handlers
    registerIpcHandlers(db, app)

    // 4. Create Window
    createWindow()
  } catch (err) {
    console.error("[YatraHub Main] Failed to initialize application:", err)
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("will-quit", () => {
  closeDatabase()
})
