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

interface AgentExecution {
  id: string
  agentId: string
  agentName: string
  taskId: string | null
  milestoneId: string | null
  status: 'idle' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted'
  command: string
  args: string[]
  pid: number | null
  startTime: string | null
  endTime: string | null
  exitCode: number | null
  stdout: string[]
  stderr: string[]
  reasoningTrace: string[]
  tokenEstimate: number
  costEstimate: number
  progress: number
}

interface WaveState {
  waveId: string
  milestoneId: string
  currentStep: number
  totalSteps: number
  status: 'running' | 'paused' | 'completed' | 'failed'
  executionIds: string[]
}

interface AgentAPI {
  listExecutions(): Promise<AgentExecution[]>
  getExecution(id: string): Promise<AgentExecution | null>
  spawn(params: {
    agentId: string
    agentName: string
    command: string
    args?: string[]
    taskId?: string
    milestoneId?: string
  }): Promise<{ executionId: string }>
  abort(id: string): Promise<boolean>
  retry(id: string): Promise<string | null>
}

interface WaveAPI {
  start(config: {
    waveId: string
    milestoneId: string
    agentSequence: string[]
    parallel: boolean
    autoApprove: boolean
  }): Promise<{ waveId: string }>
  pause(waveId: string): Promise<boolean>
  resume(waveId: string): Promise<boolean>
  abort(waveId: string): Promise<boolean>
  status(waveId: string): Promise<WaveState | null>
}

interface EventAPI {
  onEvent(callback: (event: { type: string; payload: unknown }) => void): () => void
  dispatch(event: { type: string; payload: unknown }): Promise<{ success: boolean }>
}

interface Window {
  api: {
    platform: string
    tracker: TrackerAPI
    workspace: WorkspaceAPI
    git: GitAPI
    agent: AgentAPI
    wave: WaveAPI
    events: EventAPI
  }
}
