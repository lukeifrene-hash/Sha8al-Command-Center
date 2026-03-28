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

})
