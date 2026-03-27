import { app, BrowserWindow, ipcMain, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'
import { TRACKER_PATH } from './config'
import { assemblePrompt } from './promptAssembler'
import { launchInWarp } from './warpLauncher'
import { runPipeline, cancelPipeline } from './pipelineRunner'
import type { TrackerState, PipelineStepName } from './parser'

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

// ─── Prompt Assembly IPC ─────────────────────────────────────────────────────

ipcMain.handle('prompt:assemble', (_event, subtaskId: string) => {
  const trackerJson = readTrackerFile()
  if (!trackerJson) return { error: 'Tracker file not found' }
  try {
    const trackerState = JSON.parse(trackerJson) as TrackerState
    return assemblePrompt(subtaskId, trackerState)
  } catch (err) {
    return { error: `Failed to parse tracker: ${String(err)}` }
  }
})

ipcMain.handle('prompt:assembleForStep', (_event, subtaskId: string, step: string) => {
  const trackerJson = readTrackerFile()
  if (!trackerJson) return { error: 'Tracker file not found' }
  try {
    const trackerState = JSON.parse(trackerJson) as TrackerState
    return assemblePrompt(subtaskId, trackerState, step as 'explorer' | 'planner' | 'builder')
  } catch (err) {
    return { error: `Failed to parse tracker: ${String(err)}` }
  }
})

ipcMain.handle('prompt:copyToClipboard', (_event, text: string) => {
  clipboard.writeText(text)
  return { success: true }
})

// ─── Dispatch IPC ───────────────────────────────────────────────────────────

ipcMain.handle('dispatch:launchInWarp', async (_event, subtaskId: string, step: string | null) => {
  const trackerJson = readTrackerFile()
  if (!trackerJson) return { success: false, error: 'Tracker file not found' }

  let trackerState: TrackerState
  try {
    trackerState = JSON.parse(trackerJson) as TrackerState
  } catch (err) {
    return { success: false, error: `Failed to parse tracker: ${err}` }
  }

  // Find subtask for label
  let subtaskLabel = subtaskId
  let milestoneId = ''
  for (const m of trackerState.milestones) {
    const s = m.subtasks.find((s) => s.id === subtaskId)
    if (s) {
      subtaskLabel = s.label
      milestoneId = m.id
      break
    }
  }

  // Assemble prompt with reporting protocol
  const pipelineStep = step as PipelineStepName | undefined
  const result = assemblePrompt(subtaskId, trackerState, pipelineStep, true)
  if ('error' in result) {
    return { success: false, error: result.error }
  }

  // Launch in Warp
  const launchResult = await launchInWarp({
    subtaskId,
    subtaskLabel,
    stepName: (step as PipelineStepName) || null,
    promptText: result.fullText,
  })

  if (!launchResult.success) {
    return { success: false, error: launchResult.error }
  }

  // Update tracker: set status to in_progress, log dispatch
  try {
    const freshJson = readTrackerFile()
    if (freshJson) {
      const fresh = JSON.parse(freshJson) as TrackerState
      const runId = `run_${Date.now()}`

      for (const m of fresh.milestones) {
        const task = m.subtasks.find((s) => s.id === subtaskId)
        if (task) {
          if (task.status === 'todo') task.status = 'in_progress'
          task.last_run_id = runId

          if (step && task.pipeline?.steps[step as PipelineStepName]) {
            task.pipeline.steps[step as PipelineStepName].status = 'dispatched'
            task.pipeline.steps[step as PipelineStepName].dispatched_at = new Date().toISOString()
            task.pipeline.steps[step as PipelineStepName].run_id = runId
          }
          break
        }
      }

      fresh.agent_log.push({
        id: runId,
        agent_id: step || 'command_center',
        action: step ? 'pipeline_dispatch' : 'dispatch',
        target_type: 'subtask',
        target_id: subtaskId,
        description: `Launched in Warp (${result.layerSummary.totalChars.toLocaleString()} chars${result.layerSummary.trimmed ? ', trimmed' : ''}). Profile: ${result.agentProfile}.`,
        timestamp: new Date().toISOString(),
        tags: ['dispatch', 'warp', step || 'single'].filter(Boolean),
      })

      lastWriteTime = Date.now()
      fs.writeFileSync(TRACKER_PATH, JSON.stringify(fresh, null, 2), 'utf-8')
    }
  } catch {
    // Non-fatal: dispatch succeeded even if tracker update fails
  }

  return { success: true, promptFilePath: launchResult.promptFilePath }
})

// ─── Pipeline IPC ────────────────────────────────────────────────────────────

ipcMain.handle('pipeline:run', async (_event, subtaskId: string) => {
  if (!mainWindow) return { success: false, error: 'No window available' }
  try {
    // Fire-and-forget — progress delivered via events
    runPipeline(subtaskId, mainWindow).catch((err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pipeline:error', {
          subtaskId,
          step: null,
          error: String(err),
        })
      }
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('pipeline:cancel', (_event, subtaskId: string) => {
  cancelPipeline(subtaskId)
  return { success: true }
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
