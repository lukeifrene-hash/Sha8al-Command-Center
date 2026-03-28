import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { TRACKER_PATH } from './config'

let mainWindow: BrowserWindow | null = null
let fileWatcher: fs.FSWatcher | null = null
let lastWriteTime = 0

function readTrackerFile(): string | null {
  try {
    return fs.readFileSync(TRACKER_PATH, 'utf-8')
  } catch {
    return null
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#0A0A10',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function startFileWatcher(): void {
  if (fileWatcher) return

  try {
    fileWatcher = fs.watch(TRACKER_PATH, (eventType) => {
      if (eventType === 'change') {
        // Skip if we just wrote (500ms debounce window)
        if (Date.now() - lastWriteTime < 600) return

        const content = readTrackerFile()
        if (content && mainWindow) {
          try {
            JSON.parse(content) // Validate before sending
            mainWindow.webContents.send('tracker:updated', content)
          } catch {
            // Corrupt JSON — skip
          }
        }
      }
    })
  } catch {
    // File might not exist yet
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('tracker:read', () => {
  return readTrackerFile()
})

ipcMain.handle('tracker:write', (_event, jsonString: string) => {
  try {
    JSON.parse(jsonString) // Validate
    lastWriteTime = Date.now()
    fs.writeFileSync(TRACKER_PATH, jsonString, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('tracker:path', () => {
  return TRACKER_PATH
})

ipcMain.handle('tracker:fileInfo', () => {
  try {
    const stat = fs.statSync(TRACKER_PATH)
    return {
      exists: true,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      watcherActive: fileWatcher !== null,
    }
  } catch {
    return { exists: false, size: 0, lastModified: null, watcherActive: false }
  }
})

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  startFileWatcher()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
  }
})
