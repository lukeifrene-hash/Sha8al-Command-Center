/// <reference types="vite/client" />

interface TrackerAPI {
  read(): Promise<string | null>
  write(json: string): Promise<{ success: boolean; error?: string }>
  getPath(): Promise<string>
  getFileInfo(): Promise<{
    exists: boolean
    size: number
    lastModified: string | null
    watcherActive: boolean
  }>
  onUpdated(callback: (json: string) => void): () => void
}

interface Window {
  api: {
    platform: string
    tracker: TrackerAPI
  }
}
