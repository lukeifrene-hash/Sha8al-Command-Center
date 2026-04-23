/**
 * Tracker read/write utilities for the MCP server.
 * Reads and writes talkstore-tracker.json directly.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { basename, join, dirname, isAbsolute, resolve } from 'path'
import { fileURLToPath } from 'url'
import { mergeCanonicalAgentRoster } from './canonical-agents.js'

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
  // ── Three-phase workflow fields (sweep / prepare / build) ──
  // Optional: populated by Track A synthesis. Read by claim_next_task,
  // compute_waves, bulk_prepare, and check_file_collisions.
  parallel_priority?: number
  complexity?: 'small' | 'medium' | 'large' | 'architectural'
  prepared?: boolean
  // ── Auditor workflow fields ──
  // audit_results is written by submit_audit. auto_approve_eligible is derived
  // lazily from the milestone lane (not persisted) — surfaced on request_audit.
  audit_results?: AuditResult
  auto_approve_eligible?: boolean
}

// ─── Auditor Workflow Types ─────────────────────────────────────────────────

export type MilestoneLane =
  | 'foundation'
  | 'product_engines'
  | 'merchant_facing'
  | 'ship_and_operate'

export interface AuditChecklistItem {
  id: string
  category: 'structural' | 'security' | 'compliance' | 'correctness'
  label: string
  status: 'pending' | 'pass' | 'fail' | 'n/a'
  detail?: string
}

export interface AuditResult {
  auditor_id: string
  audited_at: string
  pass: boolean
  items: AuditChecklistItem[]
  summary?: string
}

// ─── Milestone Audit (Auditor subsystem) ─────────────────────────────────────
// Per-milestone audit record, written by submit_milestone_audit.
// Informational only — does NOT gate downstream work.

export type MilestoneVerdict = 'pass' | 'pass_with_notes' | 'fail'
export type MilestoneFindingSeverity = 'critical' | 'major' | 'minor'
export type MilestoneFindingCategory =
  | 'coherence'
  | 'security'
  | 'ux'
  | 'compliance'

export interface MilestoneFinding {
  severity: MilestoneFindingSeverity
  category: MilestoneFindingCategory
  description: string
  evidence: string
  remediation?: string
}

export interface MilestoneAudit {
  verdict: MilestoneVerdict
  findings: MilestoneFinding[]
  audited_at: string
  report_path: string
  state_doc_path: string
  checklist_items_updated: number
}

export interface Milestone {
  id: string
  title: string
  domain: string
  week: number
  phase: string
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  drift_days: number
  is_key_milestone: boolean
  key_milestone_label: string | null
  subtasks: Subtask[]
  dependencies: string[]
  notes: string[]
  /**
   * Milestone-level goal statement (present in talkstore-tracker.json for
   * v2 milestones). Optional since older milestones may not have it.
   */
  goal?: string
  /**
   * Populated by submit_milestone_audit. Informational only — audit does
   * not gate downstream tasks (per operator decision: audits are advisory).
   */
  audit?: MilestoneAudit
}

export interface ChecklistItem {
  id: string
  label: string
  /**
   * The live tracker JSON stores item prose under `text`, not `label`.
   * Keep this optional so the milestone-audit classifier can read it
   * without tripping the compiler. Pre-existing drift — not fixing here.
   */
  text?: string
  done: boolean
  linked_milestone: string | null
  completed_at: string | null
  completed_by: string | null
  notes?: string | null
}

export interface ChecklistCategory {
  id: string
  title: string
  risk_level: 'normal' | 'critical'
  target_week: number
  items: ChecklistItem[]
  /**
   * The live tracker JSON ties each checklist category to a milestone via
   * `linked_milestone`. Used by milestone-audit tools to gather the
   * category slice relevant to a given milestone.
   */
  linked_milestone?: string | null
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

export interface ReviewFix {
  label: string
  severity: 'critical' | 'major' | 'minor'
  task_id: string | null
  created_at: string
}

export interface ReviewSession {
  id: string
  lane: 'ui' | 'ux' | 'backend'
  title: string
  status: 'not_started' | 'in_progress' | 'done'
  area: string
  checklist: ReviewCheckItem[]
  fixes: ReviewFix[]
  priority: 'P1' | 'P2' | 'P3' | null
  source: string | null
  created_at: string
  updated_at: string
}

export interface QAUseCase {
  id: string
  name: string
  task: string
  scope: string
  built: boolean
  test_prompt: string
  agent_status: 'untested' | 'pass' | 'fail'
  agent_tested_at: string | null
  agent_notes: string | null
  operator_status: 'untested' | 'pass' | 'fail'
  operator_tested_at: string | null
  operator_notes: string | null
  review_fix_id: string | null
}

export interface QAGroup {
  id: string
  name: string
  use_cases: QAUseCase[]
}

export interface QAData {
  groups: QAGroup[]
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
  qa: QAData
}

// ─── Path Resolution ────────────────────────────────────────────────────────

const __dirname_resolved = dirname(fileURLToPath(import.meta.url))
const COMMAND_CENTER_ROOT = resolve(__dirname_resolved, '../..')
const PROFILES_ROOT = join(COMMAND_CENTER_ROOT, 'profiles')
const SIBLING_TALKSTORE_ROOT = resolve(COMMAND_CENTER_ROOT, '..', 'talkstore')

type ConsumerProfileId = 'generic' | 'talkstore'

interface ConsumerProfileDocEntry {
  default_path: string
  compatibility_paths?: string[]
  required: boolean
}

interface ConsumerProfileManifest {
  id: ConsumerProfileId
  display_name: string
  kind: 'public' | 'compatibility' | 'internal'
  resolution_priority: number
  project_root: {
    env_keys: string[]
    compatibility_inference?: Array<{ type: string; key?: string; value?: string }>
  }
  tracker: {
    primary_filename: string
    compatibility_filenames: string[]
    default_creation_filename: string
  }
  docs: {
    tasks: ConsumerProfileDocEntry
    checklist: ConsumerProfileDocEntry
    manifesto: ConsumerProfileDocEntry
    roadmap_optional?: ConsumerProfileDocEntry
  }
}

function parseEnvFile(): Record<string, string> {
  const values: Record<string, string> = {}
  const envPaths = [
    join(COMMAND_CENTER_ROOT, '.env'),
    join(__dirname_resolved, '../../.env'),
    join(__dirname_resolved, '../../../.env'),
  ]

  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed) continue
        const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/)
        if (match) values[match[1]] = match[2].trim()
      }
      break
    } catch {
      // Try next path
    }
  }

  return values
}

function readSetting(keys: string[]): string | null {
  const envFileValues = parseEnvFile()
  for (const key of keys) {
    const fromProcess = process.env[key]
    if (fromProcess?.trim()) return fromProcess.trim()
    const fromFile = envFileValues[key]
    if (fromFile?.trim()) return fromFile.trim()
  }
  return null
}

function resolveMaybeRelative(basePath: string, value: string): string {
  return isAbsolute(value) ? value : resolve(basePath, value)
}

function loadProfileManifest(profileId: ConsumerProfileId): ConsumerProfileManifest {
  const manifestPath = join(PROFILES_ROOT, profileId, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Profile manifest not found for "${profileId}" at ${manifestPath}.`)
  }

  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as ConsumerProfileManifest
}

function resolveProfileId(): ConsumerProfileId {
  const explicitProfile = readSetting(['COMMAND_CENTER_PROFILE'])
  if (explicitProfile) {
    if (explicitProfile === 'generic' || explicitProfile === 'talkstore') {
      return explicitProfile
    }

    throw new Error(
      `Unknown consumer profile "${explicitProfile}". Expected "generic" or "talkstore".`
    )
  }

  const legacyRoot = readSetting(['TALKSTORE_PROJECT_ROOT'])
  if (legacyRoot) return 'talkstore'

  const configuredTracker = readSetting(['COMMAND_CENTER_TRACKER_FILE', 'TRACKER_FILE'])
  if (configuredTracker && basename(configuredTracker) === 'talkstore-tracker.json') {
    return 'talkstore'
  }

  const configuredRoot = readSetting(['COMMAND_CENTER_PROJECT_ROOT', 'PROJECT_ROOT'])
  if (configuredRoot) {
    const resolvedRoot = resolve(configuredRoot)
    if (
      resolvedRoot === SIBLING_TALKSTORE_ROOT ||
      existsSync(join(resolvedRoot, 'talkstore-tracker.json'))
    ) {
      return 'talkstore'
    }
    return 'generic'
  }

  if (existsSync(SIBLING_TALKSTORE_ROOT)) {
    return 'talkstore'
  }

  return 'generic'
}

function resolveProjectRoot(profile: ConsumerProfileManifest): string {
  const configured = readSetting(profile.project_root.env_keys)
  if (configured) {
    return resolve(configured)
  }

  if (profile.id === 'talkstore' && existsSync(SIBLING_TALKSTORE_ROOT)) {
    return SIBLING_TALKSTORE_ROOT
  }

  throw new Error(
    'Project root is not set. Configure COMMAND_CENTER_PROJECT_ROOT ' +
    '(or TALKSTORE_PROJECT_ROOT for legacy compatibility).'
  )
}

function resolveTrackerFile(projectRoot: string, profile: ConsumerProfileManifest): string {
  const configured = readSetting(['COMMAND_CENTER_TRACKER_FILE', 'TRACKER_FILE'])
  if (configured) return configured

  const candidateFiles = [profile.tracker.primary_filename, ...profile.tracker.compatibility_filenames]
  for (const candidate of candidateFiles) {
    if (existsSync(join(projectRoot, candidate))) return candidate
  }

  return profile.tracker.default_creation_filename
}

function resolveDocPath(projectRoot: string, envKeys: string[], candidates: string[]): string {
  const configured = readSetting(envKeys)
  if (configured) return resolveMaybeRelative(projectRoot, configured)

  for (const candidate of candidates) {
    const absolute = resolveMaybeRelative(projectRoot, candidate)
    if (existsSync(absolute)) return absolute
  }

  return resolveMaybeRelative(projectRoot, candidates[0])
}

function resolveTasksPath(projectRoot: string, profile: ConsumerProfileManifest): string {
  const resolvedPath = resolveDocPath(projectRoot, ['COMMAND_CENTER_TASKS_DOC', 'TASKS_DOC'], [
    profile.docs.tasks.default_path,
  ])

  if (profile.id === 'generic') {
    const requiredRoadmapPath = resolveMaybeRelative(projectRoot, profile.docs.tasks.default_path)
    if (resolve(resolvedPath) !== resolve(requiredRoadmapPath)) {
      throw new Error(
        `Public generic installs require ${profile.docs.tasks.default_path} as the task source. ` +
        `Received ${resolvedPath}.`
      )
    }
  }

  return resolvedPath
}

function resolveOptionalDocPath(
  projectRoot: string,
  envKeys: string[],
  defaultPath: string
): string {
  return resolveDocPath(projectRoot, envKeys, [defaultPath])
}

export const PROFILE_ID = resolveProfileId()
export const PROFILE = loadProfileManifest(PROFILE_ID)
export const PROJECT_ROOT = resolveProjectRoot(PROFILE)
export const TALKSTORE_ROOT = PROJECT_ROOT
export const TRACKER_FILE = resolveTrackerFile(PROJECT_ROOT, PROFILE)
export const TRACKER_PATH = join(PROJECT_ROOT, TRACKER_FILE)

const TASKS_PATH = resolveTasksPath(PROJECT_ROOT, PROFILE)

export const DOCS_PATHS = {
  tasks: TASKS_PATH,
  roadmap: TASKS_PATH,
  checklist: resolveDocPath(
    PROJECT_ROOT,
    ['COMMAND_CENTER_CHECKLIST_DOC', 'CHECKLIST_DOC'],
    [PROFILE.docs.checklist.default_path]
  ),
  manifesto: resolveDocPath(
    PROJECT_ROOT,
    ['COMMAND_CENTER_MANIFESTO_DOC', 'MANIFESTO_DOC'],
    [PROFILE.docs.manifesto.default_path]
  ),
  roadmap_optional: PROFILE.docs.roadmap_optional
    ? resolveOptionalDocPath(
        PROJECT_ROOT,
        ['COMMAND_CENTER_ROADMAP_DOC', 'ROADMAP_DOC'],
        PROFILE.docs.roadmap_optional.default_path
      )
    : null,
}

// ─── Read / Write ───────────────────────────────────────────────────────────

export function readTracker(): TrackerState {
  const json = readFileSync(TRACKER_PATH, 'utf-8')
  const state = JSON.parse(json) as TrackerState
  // Auto-initialize review_sessions if missing (backwards compat)
  if (!state.review_sessions) state.review_sessions = []
  // Auto-initialize qa if missing (backwards compat)
  if (!state.qa) state.qa = { groups: [] }
  state.agents = mergeCanonicalAgentRoster(state.agents || [])
  return state
}

export function writeTracker(state: TrackerState): void {
  // Recompute derived fields
  const total = state.milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const done = state.milestones.reduce(
    (s, m) => s + m.subtasks.filter((t) => t.done).length, 0
  )
  state.project.overall_progress = total > 0 ? parseFloat((done / total).toFixed(4)) : 0
  state.agents = mergeCanonicalAgentRoster(state.agents || [])

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
  const depsSatisfied = (task: Subtask): boolean => {
    const deps = task.depends_on || []
    if (deps.length === 0) return true

    for (const depId of deps) {
      const depTask = findTask(state, depId)
      if (depTask) {
        if (!depTask.subtask.done) return false
        continue
      }

      const depMilestone = state.milestones.find((m) => m.id === depId)
      if (depMilestone) {
        if (!depMilestone.subtasks.every((subtask) => subtask.done)) return false
        continue
      }

      return false
    }

    return true
  }

  // 1. Subtask-level: unblock tasks whose depends_on includes the completed task
  for (const milestone of state.milestones) {
    for (const task of milestone.subtasks) {
      if (task.status !== 'blocked') continue
      if (!task.depends_on || !task.depends_on.includes(completedTaskId)) continue

      // Check if ALL dependencies in depends_on are now done.
      // Must handle BOTH subtask IDs and milestone IDs — tasks often list an
      // upstream milestone (e.g. "m1_purge_and_foundation_reset") alongside
      // specific subtasks. Using only findTask() would miss the milestone case
      // and leave dependents stuck blocked forever.
      if (depsSatisfied(task)) {
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

        // Only unblock downstream tasks whose own task-level deps are now satisfied.
        for (const task of downstream.subtasks) {
          if (task.status !== 'blocked') continue
          if (!depsSatisfied(task)) continue

          task.status = 'todo'
          task.blocked_by = null
          task.blocked_reason = null
          unblocked.push(`Task "${task.id}" (${task.label}) → todo (milestone "${completedMilestoneId}" complete and task deps satisfied)`)

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
