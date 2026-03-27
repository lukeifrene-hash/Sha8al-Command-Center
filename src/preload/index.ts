import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,

  // Tracker file operations
  tracker: {
    read: (): Promise<string | null> => ipcRenderer.invoke('tracker:read'),
    write: (json: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tracker:write', json),
    getPath: (): Promise<string> => ipcRenderer.invoke('tracker:path'),
    getFileInfo: (): Promise<{
      exists: boolean
      size: number
      lastModified: string | null
      watcherActive: boolean
    }> => ipcRenderer.invoke('tracker:fileInfo'),

    // Listen for external file changes
    onUpdated: (callback: (json: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, json: string) => callback(json)
      ipcRenderer.on('tracker:updated', handler)
      return () => ipcRenderer.removeListener('tracker:updated', handler)
    },
  },

  // Prompt assembly for agentic dispatch
  prompt: {
    assemble: (subtaskId: string) => ipcRenderer.invoke('prompt:assemble', subtaskId),
    assembleForStep: (subtaskId: string, step: string) =>
      ipcRenderer.invoke('prompt:assembleForStep', subtaskId, step),
    copyToClipboard: (text: string) => ipcRenderer.invoke('prompt:copyToClipboard', text),
  },

  // Dispatch to Warp terminal
  dispatch: {
    launchInWarp: (
      subtaskId: string,
      step: string | null
    ): Promise<{ success: boolean; promptFilePath?: string; error?: string }> =>
      ipcRenderer.invoke('dispatch:launchInWarp', subtaskId, step),
  },

  // Automated pipeline execution
  pipeline: {
    run: (subtaskId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('pipeline:run', subtaskId),
    cancel: (subtaskId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pipeline:cancel', subtaskId),
    onStepStarted: (cb: (data: any) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any) => cb(data)
      ipcRenderer.on('pipeline:step_started', handler)
      return () => ipcRenderer.removeListener('pipeline:step_started', handler)
    },
    onStepOutput: (cb: (data: any) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any) => cb(data)
      ipcRenderer.on('pipeline:step_output', handler)
      return () => ipcRenderer.removeListener('pipeline:step_output', handler)
    },
    onStepCompleted: (cb: (data: any) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any) => cb(data)
      ipcRenderer.on('pipeline:step_completed', handler)
      return () => ipcRenderer.removeListener('pipeline:step_completed', handler)
    },
    onCompleted: (cb: (data: any) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any) => cb(data)
      ipcRenderer.on('pipeline:completed', handler)
      return () => ipcRenderer.removeListener('pipeline:completed', handler)
    },
    onError: (cb: (data: any) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any) => cb(data)
      ipcRenderer.on('pipeline:error', handler)
      return () => ipcRenderer.removeListener('pipeline:error', handler)
    },
  },
})
