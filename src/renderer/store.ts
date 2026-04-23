import { create } from 'zustand'
import type { TrackerState } from '../main/parser'

// Re-export the type so views can use it without reaching into main/
export type { TrackerState }

export type TabId = 'swim-lane' | 'task-board' | 'agent-hub' | 'calendar' | 'qa'
export type Theme = 'dark' | 'light'

// ─── Agent Execution Types (mirrors main/agent-runtime.ts) ────────────────

export type AgentExecutionStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted'

export interface AgentExecution {
  id: string
  agentId: string
  agentName: string
  taskId: string | null
  milestoneId: string | null
  status: AgentExecutionStatus
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

export interface WaveState {
  waveId: string
  milestoneId: string
  currentStep: number
  totalSteps: number
  status: 'running' | 'paused' | 'completed' | 'failed'
  executionIds: string[]
}

// ─── Notification Type ───────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  source: string
  timestamp: string
  read: boolean
}

interface AppState {
  // Core data
  tracker: TrackerState | null
  workspaceStatus: WorkspaceStatus | null
  loading: boolean
  error: string | null
  synced: boolean

  // UI state
  activeTab: TabId
  selectedMilestoneId: string | null
  theme: Theme
  commandPaletteOpen: boolean

  // Agent runtime state
  agentExecutions: AgentExecution[]
  activeWaves: WaveState[]

  // Notifications
  notifications: AppNotification[]

  // Actions
  setTracker: (data: TrackerState | null) => void
  setWorkspaceStatus: (status: WorkspaceStatus | null) => void
  setActiveTab: (tab: TabId) => void
  setSelectedMilestoneId: (id: string | null) => void
  setLoading: (v: boolean) => void
  setError: (err: string | null) => void
  setSynced: (v: boolean) => void
  toggleTheme: () => void
  setCommandPaletteOpen: (v: boolean) => void

  // Agent execution actions
  setAgentExecutions: (executions: AgentExecution[]) => void
  addAgentExecution: (execution: AgentExecution) => void
  updateAgentExecution: (id: string, patch: Partial<AgentExecution>) => void
  setActiveWaves: (waves: WaveState[]) => void

  // Notification actions
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void
  dismissNotification: (id: string) => void
  markNotificationRead: (id: string) => void

  // Mutation helpers — mutate tracker and trigger auto write-back
  updateTracker: (updater: (draft: TrackerState) => void) => void
}

// ─── Derived state selectors (pure functions, not in the store) ──────────────

/** Calculate current week from start_date and today */
export function selectCurrentWeek(tracker: TrackerState | null): number {
  if (!tracker) return 1
  const start = new Date(tracker.project.start_date + 'T00:00:00Z')
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 1
  return Math.max(1, Math.min(12, Math.floor(diffMs / (7 * 86400000)) + 1))
}

/** Fractional week position for precise NOW marker placement (e.g., 1.85 = day 6 of week 1) */
export function selectCurrentWeekFractional(tracker: TrackerState | null): number {
  if (!tracker) return 1
  const start = new Date(tracker.project.start_date + 'T00:00:00Z')
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 1
  const fractional = diffMs / (7 * 86400000) + 1
  return Math.max(1, Math.min(12.99, fractional))
}

/** Resolve phase name for a given week */
export function selectCurrentPhase(tracker: TrackerState | null): string {
  if (!tracker) return ''
  const week = selectCurrentWeek(tracker)
  const phase = tracker.schedule.phases.find(
    (p) => week >= p.start_week && week <= p.end_week
  )
  return phase?.title ?? ''
}

/** Total subtask count */
export function selectTotalSubtasks(tracker: TrackerState | null): number {
  if (!tracker) return 0
  return tracker.milestones.reduce((sum, m) => sum + m.subtasks.length, 0)
}

/** Done subtask count */
export function selectDoneSubtasks(tracker: TrackerState | null): number {
  if (!tracker) return 0
  return tracker.milestones.reduce(
    (sum, m) => sum + m.subtasks.filter((s) => s.done).length,
    0
  )
}

/** Overall progress 0–1 */
export function selectOverallProgress(tracker: TrackerState | null): number {
  const total = selectTotalSubtasks(tracker)
  if (total === 0) return 0
  return selectDoneSubtasks(tracker) / total
}

/** Derive schedule status from milestone drift values */
export function selectScheduleStatus(
  tracker: TrackerState | null
): 'on_track' | 'behind' | 'ahead' {
  if (!tracker || tracker.milestones.length === 0) return 'on_track'
  const drifts = tracker.milestones.map((m) => m.drift_days)
  const maxBehind = Math.max(0, ...drifts) // positive = behind
  const maxAhead = Math.min(0, ...drifts) // negative = ahead
  if (maxBehind > 3) return 'behind'
  if (maxAhead < -3) return 'ahead'
  return 'on_track'
}

/** Per-milestone progress */
export function selectMilestoneProgress(
  milestone: TrackerState['milestones'][number]
): { done: number; total: number; pct: number } {
  const total = milestone.subtasks.length
  const done = milestone.subtasks.filter((s) => s.done).length
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}

/** Per-category progress */
export function selectCategoryProgress(
  category: TrackerState['submission_checklist']['categories'][number]
): { done: number; total: number; pct: number } {
  const total = category.items.length
  const done = category.items.filter((i) => i.done).length
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}

// ─── Write-back state ────────────────────────────────────────────────────────

let writeTimer: ReturnType<typeof setTimeout> | null = null
let suppressExternalRefresh = false

function scheduleWriteBack(tracker: TrackerState): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(async () => {
    suppressExternalRefresh = true
    await window.api.tracker.write(JSON.stringify(tracker, null, 2))
    setTimeout(() => { suppressExternalRefresh = false }, 700)
  }, 500)
}

export function isExternalRefreshSuppressed(): boolean {
  return suppressExternalRefresh
}

// ─── Store ───────────────────────────────────────────────────────────────────

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('talkstore-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* ignore */ }
  return 'dark'
}

export const useStore = create<AppState>()((set, get) => ({
  tracker: null,
  workspaceStatus: null,
  loading: true,
  error: null,
  synced: false,
  activeTab: 'swim-lane' as TabId,
  selectedMilestoneId: null,
  theme: getInitialTheme(),
  commandPaletteOpen: false,
  agentExecutions: [],
  activeWaves: [],
  notifications: [],

  // setTracker: used for loading/external updates — does NOT write back
  setTracker: (data) => set({ tracker: data, error: null }),
  setWorkspaceStatus: (status) => set({ workspaceStatus: status }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedMilestoneId: (id) => set({ selectedMilestoneId: id }),
  setLoading: (v) => set({ loading: v }),
  setError: (err) => set({ error: err }),
  setSynced: (v) => set({ synced: v }),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem('talkstore-theme', next) } catch { /* ignore */ }
    set({ theme: next })
  },
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

  // Agent execution actions
  setAgentExecutions: (executions) => set({ agentExecutions: executions }),
  addAgentExecution: (execution) => set((state) => ({
    agentExecutions: [execution, ...state.agentExecutions],
  })),
  updateAgentExecution: (id, patch) => set((state) => ({
    agentExecutions: state.agentExecutions.map((e) =>
      e.id === id ? { ...e, ...patch } : e
    ),
  })),
  setActiveWaves: (waves) => set({ activeWaves: waves }),

  // Notification actions
  addNotification: (n) => set((state) => ({
    notifications: [
      {
        ...n,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        read: false,
      },
      ...state.notifications,
    ].slice(0, 50), // Keep last 50
  })),
  dismissNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
  })),

  // updateTracker: used for app-initiated mutations — DOES write back
  updateTracker: (updater) => {
    const tracker = get().tracker
    if (!tracker) return
    const next = JSON.parse(JSON.stringify(tracker)) as TrackerState
    updater(next)
    // Recompute derived fields before writing
    const total = next.milestones.reduce((s, m) => s + m.subtasks.length, 0)
    const done = next.milestones.reduce(
      (s, m) => s + m.subtasks.filter((t) => t.done).length, 0
    )
    next.project.overall_progress = total > 0 ? parseFloat((done / total).toFixed(4)) : 0
    next.project.current_week = selectCurrentWeek(next)
    next.project.schedule_status = selectScheduleStatus(next)
    set({ tracker: next })
    // Write back to disk (debounced)
    scheduleWriteBack(next)
  },
}))

// ─── Initialize ──────────────────────────────────────────────────────────────

let initialized = false
let cleanupWatcher: (() => void) | null = null

export async function initStore(): Promise<void> {
  if (initialized) return
  initialized = true

  const { setTracker, setWorkspaceStatus, setLoading, setError, setSynced } = useStore.getState()

  try {
    const workspaceStatus = await window.api.workspace.getStatus()
    setWorkspaceStatus(workspaceStatus)

    const json = workspaceStatus.trackerExists ? await window.api.tracker.read() : null
    if (json && workspaceStatus.trackerExists) {
      const data = JSON.parse(json) as TrackerState
      // Patch current_week to be live-calculated
      data.project.current_week = selectCurrentWeek(data)
      setTracker(data)
      setSynced(true)
    } else {
      setTracker(null)
      setSynced(false)
    }
  } catch (err) {
    setError(`Failed to load tracker: ${err}`)
  } finally {
    setLoading(false)
  }

  // Listen for external file changes (from agents writing to tracker.json)
  if (cleanupWatcher) cleanupWatcher()
  cleanupWatcher = window.api.tracker.onUpdated((json: string) => {
    if (isExternalRefreshSuppressed()) return
    try {
      const data = JSON.parse(json) as TrackerState
      data.project.current_week = selectCurrentWeek(data)
      useStore.getState().setTracker(data)
      window.api.workspace.getStatus().then((status) => useStore.getState().setWorkspaceStatus(status)).catch(() => {})
    } catch {
      // Ignore corrupt JSON
    }
  })

  // Listen for event bus events from main process
  if ((window as any).api?.events) {
    ((window as any).api.events as EventTarget).addEventListener('sha8al:event', ((e: CustomEvent) => {
      try {
        const event = JSON.parse(e.detail) as { type: string; payload: unknown }
        handleEventBusEvent(event)
      } catch {
        // Ignore malformed events
      }
    }) as EventListener)
  }
}

function handleEventBusEvent(event: { type: string; payload: unknown }): void {
  const state = useStore.getState()

  switch (event.type) {
    case 'agent:spawned': {
      const p = event.payload as { executionId: string; agentId: string; taskId: string | null }
      // Execution will be populated via agent:output and agent:finished
      break
    }
    case 'agent:output': {
      const p = event.payload as { executionId: string; chunk: string; stream: 'stdout' | 'stderr' }
      const exec = state.agentExecutions.find(e => e.id === p.executionId)
      if (exec) {
        const patch: Partial<AgentExecution> = {}
        if (p.stream === 'stdout') {
          patch.stdout = [...exec.stdout, p.chunk]
        } else {
          patch.stderr = [...exec.stderr, p.chunk]
        }
        state.updateAgentExecution(p.executionId, patch)
      }
      break
    }
    case 'agent:finished': {
      const p = event.payload as { executionId: string; status: AgentExecutionStatus; exitCode: number | null }
      state.updateAgentExecution(p.executionId, {
        status: p.status,
        exitCode: p.exitCode,
        endTime: new Date().toISOString(),
      })
      break
    }
    case 'task:started':
    case 'task:completed':
    case 'task:blocked': {
      // Refresh tracker to pick up mutations
      window.api.tracker.read().then((json) => {
        if (json) {
          const data = JSON.parse(json) as TrackerState
          data.project.current_week = selectCurrentWeek(data)
          state.setTracker(data)
        }
      }).catch(() => {})
      break
    }
    case 'notification': {
      const p = event.payload as { level: 'info' | 'warning' | 'error'; message: string; source: string }
      state.addNotification(p)
      break
    }
  }
}

export async function refreshWorkspaceStatus(): Promise<void> {
  const status = await window.api.workspace.getStatus()
  useStore.getState().setWorkspaceStatus(status)
}

export async function loadTrackerFromWorkspace(): Promise<void> {
  const { setTracker, setWorkspaceStatus, setSynced, setError } = useStore.getState()
  const status = await window.api.workspace.getStatus()
  setWorkspaceStatus(status)

  if (!status.trackerExists) {
    setTracker(null)
    setSynced(false)
    setError(null)
    return
  }

  const json = await window.api.tracker.read()
  if (!json) {
    setTracker(null)
    setSynced(false)
    setError(null)
    return
  }

  const data = JSON.parse(json) as TrackerState
  data.project.current_week = selectCurrentWeek(data)
  setTracker(data)
  setSynced(true)
  setError(null)
}
