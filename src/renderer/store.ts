import { create } from 'zustand'
import type { TrackerState } from '../main/parser'

// Re-export the type so views can use it without reaching into main/
export type { TrackerState }

export type TabId = 'swim-lane' | 'task-board' | 'agent-hub' | 'calendar' | 'qa'
export type Theme = 'dark' | 'light'

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

  // Actions
  setTracker: (data: TrackerState | null) => void
  setWorkspaceStatus: (status: WorkspaceStatus | null) => void
  setActiveTab: (tab: TabId) => void
  setSelectedMilestoneId: (id: string | null) => void
  setLoading: (v: boolean) => void
  setError: (err: string | null) => void
  setSynced: (v: boolean) => void
  toggleTheme: () => void

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
