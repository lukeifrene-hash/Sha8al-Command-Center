/**
 * Tracker read/write utilities for the MCP server.
 * Reads and writes talkstore-tracker.json directly.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ─── Types (mirrored from parser.ts) ────────────────────────────────────────

export interface Subtask {
  id: string
  label: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
  done: boolean
  assignee: string | null
  blocked_by: string | null
  blocked_reason: string | null
  completed_at: string | null
  completed_by: string | null
  priority: string
  notes: string | null
  prompt: string | null
  context_files: string[]
  reference_docs: string[]
  acceptance_criteria: string[]
  constraints: string[]
  agent_target: 'explorer' | 'planner' | 'builder' | null
  execution_mode: 'human' | 'agent' | 'pair'
  depends_on: string[]
  last_run_id: string | null
  pipeline: Pipeline | null
  builder_prompt: string | null
}

export interface Milestone {
  id: string
  title: string
  domain: string
  week: number
  phase: string
  planned_start: string
  planned_end: string
  actual_start: string | null
  actual_end: string | null
  drift_days: number
  is_key_milestone: boolean
  key_milestone_label: string | null
  subtasks: Subtask[]
  dependencies: string[]
  notes: string[]
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
  linked_milestone: string | null
  completed_at: string | null
  completed_by: string | null
}

export interface ChecklistCategory {
  id: string
  title: string
  risk_level: 'normal' | 'critical'
  target_week: number
  items: ChecklistItem[]
}

export interface AgentLogEntry {
  id: string
  agent_id: string
  action: string
  target_type: string
  target_id: string
  description: string
  timestamp: string
  tags: string[]
}

export interface Pipeline {
  active: boolean
  steps: Record<string, PipelineStep>
  current_step: string | null
}

export interface PipelineStep {
  enabled: boolean
  status: string
  dispatched_at: string | null
  completed_at: string | null
  output: string | null
  run_id: string | null
  error: string | null
  duration_ms: number | null
}

export interface ReviewCheckItem {
  label: string
  done: boolean
  checked_at: string | null
}

export interface ReviewSession {
  id: string
  lane: 'ui' | 'ux' | 'backend'
  title: string
  status: 'not_started' | 'in_progress' | 'done'
  area: string
  checklist: ReviewCheckItem[]
  priority: 'P1' | 'P2' | 'P3' | null
  source: string | null
  created_at: string
  updated_at: string
}

export interface TrackerState {
  project: {
    name: string
    start_date: string
    target_submit_date: string
    current_week: number
    schedule_status: 'on_track' | 'behind' | 'ahead'
    overall_progress: number
  }
  milestones: Milestone[]
  submission_checklist: { categories: ChecklistCategory[] }
  agents: {
    id: string
    name: string
    type: string
    parent_id?: string
    color: string
    status: string
    permissions: string[]
    last_action_at: string | null
    session_action_count: number
  }[]
  agent_log: AgentLogEntry[]
  schedule: { phases: { id: string; title: string; start_week: number; end_week: number }[] }
  review_sessions: ReviewSession[]
}

// ─── Path Resolution ────────────────────────────────────────────────────────

function resolveProjectRoot(): string {
  // 1. Environment variable
  if (process.env.TALKSTORE_PROJECT_ROOT) {
    return process.env.TALKSTORE_PROJECT_ROOT
  }

  // 2. .env file in command-center root (two levels up from mcp-server/dist/)
  const __dirname_resolved = dirname(fileURLToPath(import.meta.url))
  const envPaths = [
    join(__dirname_resolved, '../../.env'),       // from mcp-server/dist/
    join(__dirname_resolved, '../../../.env'),     // fallback
  ]

  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed) continue
        const match = trimmed.match(/^TALKSTORE_PROJECT_ROOT\s*=\s*(.+)$/)
        if (match) return match[1].trim()
      }
    } catch {
      // Try next path
    }
  }

  throw new Error(
    'TALKSTORE_PROJECT_ROOT is not set. Set the env var or create a .env file in the command-center root.'
  )
}

export const TALKSTORE_ROOT = resolveProjectRoot()
export const TRACKER_PATH = join(TALKSTORE_ROOT, 'talkstore-tracker.json')

// ─── Read / Write ───────────────────────────────────────────────────────────

export function readTracker(): TrackerState {
  const json = readFileSync(TRACKER_PATH, 'utf-8')
  const state = JSON.parse(json) as TrackerState
  // Auto-initialize review_sessions if missing (backwards compat)
  if (!state.review_sessions) state.review_sessions = []
  return state
}

export function writeTracker(state: TrackerState): void {
  // Recompute derived fields
  const total = state.milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const done = state.milestones.reduce(
    (s, m) => s + m.subtasks.filter((t) => t.done).length, 0
  )
  state.project.overall_progress = total > 0 ? parseFloat((done / total).toFixed(4)) : 0

  writeFileSync(TRACKER_PATH, JSON.stringify(state, null, 2), 'utf-8')
}

export function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

// ─── Lookups ────────────────────────────────────────────────────────────────

export function findTask(
  state: TrackerState,
  taskId: string
): { subtask: Subtask; milestone: Milestone } | null {
  for (const milestone of state.milestones) {
    const subtask = milestone.subtasks.find((s) => s.id === taskId)
    if (subtask) return { subtask, milestone }
  }
  return null
}

/**
 * Auto-unblock tasks and milestones whose dependencies are now satisfied.
 *
 * Called after a task is approved (done). Checks two levels:
 * 1. Subtask-level: tasks with `depends_on` containing the completed task ID
 * 2. Milestone-level: milestones whose `dependencies` list milestone IDs —
 *    if all subtasks in every dependency milestone are done, unblock blocked
 *    tasks in the dependent milestone.
 *
 * Returns descriptions of what was unblocked for logging.
 */
export function autoUnblockDependents(
  state: TrackerState,
  completedTaskId: string,
  completedMilestoneId: string
): string[] {
  const unblocked: string[] = []

  // 1. Subtask-level: unblock tasks whose depends_on includes the completed task
  for (const milestone of state.milestones) {
    for (const task of milestone.subtasks) {
      if (task.status !== 'blocked') continue
      if (!task.depends_on || !task.depends_on.includes(completedTaskId)) continue

      // Check if ALL dependencies in depends_on are now done
      const allDepsDone = task.depends_on.every((depId) => {
        const dep = findTask(state, depId)
        return dep && dep.subtask.done
      })

      if (allDepsDone) {
        task.status = 'todo'
        task.blocked_by = null
        task.blocked_reason = null
        unblocked.push(`Task "${task.id}" (${task.label}) → todo (all subtask deps satisfied)`)

        state.agent_log.push({
          id: `log_${Date.now()}_${task.id}`,
          agent_id: 'system',
          action: 'task_auto_unblocked',
          target_type: 'subtask',
          target_id: task.id,
          description: `Auto-unblocked: dependency "${completedTaskId}" is now done. All deps satisfied.`,
          timestamp: new Date().toISOString(),
          tags: ['unblocked', 'auto', 'dependency'],
        })
      }
    }
  }

  // 2. Milestone-level: check milestones that depend on the completed task's milestone
  const completedMilestone = state.milestones.find((m) => m.id === completedMilestoneId)
  if (completedMilestone) {
    const milestoneFullyDone = completedMilestone.subtasks.every((s) => s.done)

    if (milestoneFullyDone) {
      // Find milestones that list the completed milestone as a dependency
      for (const downstream of state.milestones) {
        if (!downstream.dependencies.includes(completedMilestoneId)) continue

        // Check if ALL milestone-level dependencies are fully done
        const allMilestoneDepsDone = downstream.dependencies.every((depMsId) => {
          const depMs = state.milestones.find((m) => m.id === depMsId)
          return depMs && depMs.subtasks.every((s) => s.done)
        })

        if (!allMilestoneDepsDone) continue

        // Unblock all blocked tasks in this downstream milestone
        for (const task of downstream.subtasks) {
          if (task.status !== 'blocked') continue

          task.status = 'todo'
          task.blocked_by = null
          task.blocked_reason = null
          unblocked.push(`Task "${task.id}" (${task.label}) → todo (milestone "${completedMilestoneId}" complete)`)

          state.agent_log.push({
            id: `log_${Date.now()}_${task.id}`,
            agent_id: 'system',
            action: 'task_auto_unblocked',
            target_type: 'subtask',
            target_id: task.id,
            description: `Auto-unblocked: upstream milestone "${completedMilestoneId}" is now fully complete.`,
            timestamp: new Date().toISOString(),
            tags: ['unblocked', 'auto', 'milestone-dependency'],
          })
        }
      }
    }
  }

  return unblocked
}
