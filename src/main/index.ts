import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'

import { mergeCanonicalAgentRoster } from './canonical-agents'
import { commitAndPush } from './git'
import {
  configureWorkspace,
  createStarterRoadmap,
  generateTrackerForWorkspace,
  getWorkspaceStatus,
  importRoadmap,
} from './workspace'

let mainWindow: BrowserWindow | null = null
let fileWatcher: fs.FSWatcher | null = null
let watchedTrackerPath: string | null = null
let lastWriteTime = 0

function readTrackerFile(trackerPath: string | null): string | null {
  if (!trackerPath) return null

  try {
    const raw = fs.readFileSync(trackerPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.agents)) {
      parsed.agents = mergeCanonicalAgentRoster(parsed.agents)
    }
    return JSON.stringify(parsed, null, 2)
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

function stopFileWatcher(): void {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
  }
  watchedTrackerPath = null
}

async function restartFileWatcher(): Promise<void> {
  stopFileWatcher()

  const status = await getWorkspaceStatus()
  if (!status.trackerExists || !status.trackerPath) return

  try {
    watchedTrackerPath = status.trackerPath
    fileWatcher = fs.watch(status.trackerPath, (eventType) => {
      if (eventType !== 'change') return
      if (Date.now() - lastWriteTime < 1000) return

      const content = readTrackerFile(watchedTrackerPath)
      if (content && mainWindow) {
        mainWindow.webContents.send('tracker:updated', content)
      }
    })
  } catch {
    stopFileWatcher()
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('tracker:read', async () => {
  const status = await getWorkspaceStatus()
  return status.trackerExists ? readTrackerFile(status.trackerPath) : null
})

ipcMain.handle('tracker:write', async (_event, jsonString: string) => {
  const status = await getWorkspaceStatus()
  if (!status.trackerPath) {
    return { success: false, error: 'No active tracker path is configured yet.' }
  }

  try {
    JSON.parse(jsonString)
    lastWriteTime = Date.now()
    fs.writeFileSync(status.trackerPath, jsonString, 'utf-8')
    await restartFileWatcher()
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('tracker:path', async () => {
  const status = await getWorkspaceStatus()
  return status.trackerPath
})

ipcMain.handle('tracker:fileInfo', async () => {
  const status = await getWorkspaceStatus()
  if (!status.trackerPath || !status.trackerExists) {
    return { exists: false, size: 0, lastModified: null, watcherActive: false }
  }

  try {
    const stat = fs.statSync(status.trackerPath)
    return {
      exists: true,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      watcherActive: fileWatcher !== null && watchedTrackerPath === status.trackerPath,
    }
  } catch {
    return { exists: false, size: 0, lastModified: null, watcherActive: false }
  }
})

ipcMain.handle('workspace:getStatus', async () => {
  return getWorkspaceStatus()
})

ipcMain.handle('workspace:chooseProjectFolder', async () => {
  if (!mainWindow) {
    return { canceled: true, status: await getWorkspaceStatus() }
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, status: await getWorkspaceStatus() }
  }

  const status = configureWorkspace(result.filePaths[0])
  await restartFileWatcher()
  return { canceled: false, status }
})

ipcMain.handle('workspace:createStarterRoadmap', async () => {
  const status = await getWorkspaceStatus()
  if (!status.projectRoot) {
    throw new Error('Choose a project folder before creating a roadmap.')
  }

  const result = createStarterRoadmap(status.projectRoot)
  await restartFileWatcher()
  return result
})

ipcMain.handle('workspace:importRoadmap', async () => {
  const status = await getWorkspaceStatus()
  if (!status.projectRoot || !mainWindow) {
    throw new Error('Choose a project folder before importing a roadmap.')
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, status }
  }

  const imported = importRoadmap(status.projectRoot, result.filePaths[0])
  await restartFileWatcher()
  return { canceled: false, ...imported }
})

ipcMain.handle('workspace:generateTracker', async () => {
  const status = await getWorkspaceStatus()
  const result = generateTrackerForWorkspace(status)
  await restartFileWatcher()
  return result
})

ipcMain.handle('git:commit-and-push', async () => {
  return commitAndPush()
})

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createWindow()
  await restartFileWatcher()

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
  stopFileWatcher()
})
