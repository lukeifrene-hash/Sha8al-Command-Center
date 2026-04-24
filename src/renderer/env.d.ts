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

interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  hooks: string[]
  configSchema?: Record<string, unknown>
  enabled: boolean
  builtIn: boolean
}

interface PluginAPI {
  list(): Promise<PluginManifest[]>
  get(id: string): Promise<PluginManifest | null>
  setEnabled(id: string, enabled: boolean): Promise<boolean>
  updateConfig(id: string, config: Record<string, unknown>): Promise<boolean>
  getConfig(id: string): Promise<Record<string, unknown>>
}

interface TaskContext {
  taskId: string
  taskLabel: string
  milestoneTitle: string
  domain: string
  complexity: string
  relatedFiles: string[]
  recentGitActivity: GitActivityEntry[]
  similarTasks: SimilarTaskEntry[]
  agentMemory: AgentMemoryEntry[]
  suggestedPrompt: string
  contextSummary: string
}

interface GitActivityEntry {
  hash: string
  message: string
  author: string
  date: string
  files: string[]
}

interface SimilarTaskEntry {
  taskId: string
  label: string
  similarity: number
  outcome: 'completed' | 'failed' | 'blocked'
  completionTime?: string
}

interface AgentMemoryEntry {
  agentId: string
  pattern: string
  learnedAt: string
  relevance: number
  context: string
}

interface PromptSuggestion {
  original: string
  improved: string
  reason: string
}

interface ContextAPI {
  build(params: {
    taskId: string
    taskLabel: string
    milestoneTitle: string
    domain: string
    complexity: string
    prompt?: string
    contextFiles?: string[]
  }): Promise<TaskContext>
  storeMemory(agentId: string, pattern: string, context: string, relevance: number): Promise<{ success: boolean }>
  suggestPrompt(prompt: string, failurePatterns: string[]): Promise<PromptSuggestion[]>
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
    plugin: PluginAPI
    context: ContextAPI
  }
}
