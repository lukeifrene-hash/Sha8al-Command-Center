/// <reference types="vite/client" />

interface TrackerAPI {
  read(): Promise<string | null>
  write(json: string): Promise<{ success: boolean; error?: string }>
  getPath(): Promise<string | null>
  getFileInfo(): Promise<{
    exists: boolean
    size: number
    lastModified: string | null
    watcherActive: boolean
  }>
  onUpdated(callback: (json: string) => void): () => void
}

interface WorkspaceStatus {
  configured: boolean
  source: 'workspace-config' | 'env' | null
  profile: 'generic' | 'talkstore' | null
  projectRoot: string | null
  trackerPath: string | null
  trackerExists: boolean
  roadmapPath: string | null
  roadmapExists: boolean
  manifestoPath: string | null
  manifestoExists: boolean
}

interface WorkspaceAPI {
  getStatus(): Promise<WorkspaceStatus>
  chooseProjectFolder(): Promise<{ canceled: boolean; status: WorkspaceStatus }>
  createStarterRoadmap(): Promise<{ created: string[]; status: WorkspaceStatus }>
  importRoadmap(): Promise<{ canceled: boolean; imported?: string; status: WorkspaceStatus }>
  generateTracker(): Promise<{
    state: unknown
    counts: { milestones: number; subtasks: number; categories: number; checklistItems: number }
    status: WorkspaceStatus
  }>
}

type GitResult =
  | { status: 'success'; message: string; branch: string; filesChanged: number }
  | { status: 'nothing' }
  | { status: 'error'; error: string }

interface GitAPI {
  commitAndPush(): Promise<GitResult>
}

interface Window {
  api: {
    platform: string
    tracker: TrackerAPI
    workspace: WorkspaceAPI
    git: GitAPI
  }
}
