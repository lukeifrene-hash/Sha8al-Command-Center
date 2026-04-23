/**
 * Sha8al Command Center — Generic Config-Driven Markdown Parser
 *
 * Replaces hardcoded MILESTONE_META, DEPENDENCY_MAP, and phase constants
 * with a schema-driven approach using project-config.ts definitions.
 *
 * The parser reads sha8al.config.yaml to understand:
 *   - What markdown sections contain milestones
 *   - How to extract week numbers from headings
 *   - Which lanes/domains to assign
 *   - Phase boundaries
 */

import { readFileSync } from 'fs'
import { type ProjectConfig, resolveLaneForMilestone, getPhaseForWeek } from './project-config'
import { classifyTaskComplexity } from './task-complexity'

// ─── Re-export core types from parser.ts ───────────────────────────────────

export interface Subtask {
  id: string
  label: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
  done: boolean
  assignee: string | null
  blocked_by: string | string[] | null
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
  depends_on: string[]
  agent_target: 'explorer' | 'planner' | 'builder' | null
  execution_mode: 'human' | 'agent' | 'pair'
  execution_mode_reasoning?: string
  last_run_id: string | null
  pipeline: Pipeline | null
  complexity?: 'small' | 'medium' | 'large' | 'architectural'
  parallel_priority?: number
  prepared?: boolean
  audit_results?: AuditResult
}

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
  audit?: import('./parser').MilestoneAudit
}

export type PipelineStepName = 'explorer' | 'planner' | 'builder'

export interface PipelineStep {
  enabled: boolean
  status: 'idle' | 'dispatched' | 'running' | 'complete' | 'error'
  dispatched_at: string | null
  completed_at: string | null
  output: string | null
  run_id: string | null
  error: string | null
  duration_ms: number | null
}

export interface Pipeline {
  active: boolean
  steps: Record<PipelineStepName, PipelineStep>
  current_step: PipelineStepName | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function weekToDate(weekNum: number, startDateStr: string, isEnd = false): string {
  const start = new Date(startDateStr + 'T00:00:00Z')
  const dayOffset = (weekNum - 1) * 7 + (isEnd ? 6 : 0)
  const d = new Date(start.getTime() + dayOffset * 86400000)
  return d.toISOString().split('T')[0]
}

export function calculateCurrentWeek(startDateStr: string, totalWeeks: number): number {
  const start = new Date(startDateStr + 'T00:00:00Z')
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 1
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, Math.min(totalWeeks, diffWeeks + 1))
}

// ─── Generic Roadmap Parser ──────────────────────────────────────────────────

export interface ParseResult {
  milestones: Milestone[]
  parseErrors: string[]
}

export function parseRoadmapGeneric(content: string, config: ProjectConfig): ParseResult {
  const milestones: Milestone[] = []
  const parseErrors: string[] = []
  const lines = content.split('\n')

  let inActiveSection = false
  let inCodeBlock = false
  let currentMilestone: Milestone | null = null
  let currentPhaseId: string | null = null

  function pushCurrent() {
    if (currentMilestone) {
      milestones.push(currentMilestone)
      currentMilestone = null
    }
  }

  function startMilestone(title: string, weekNum: number, explicitPhaseId?: string) {
    pushCurrent()
    const id = slugify(title)
    const phase = explicitPhaseId ?? getPhaseForWeek(config, weekNum)?.id ?? config.phases[0]?.id ?? 'default'
    const phaseObj = config.phases.find(p => p.id === phase)
    const lane = resolveLaneForMilestone(config, id, title, phase)
    const endWeek = weekNum // Single-week milestones by default; can be extended via patterns

    currentMilestone = {
      id,
      title,
      domain: lane,
      week: weekNum,
      phase,
      planned_start: weekToDate(weekNum, config.start_date),
      planned_end: weekToDate(endWeek, config.start_date, true),
      actual_start: null,
      actual_end: null,
      drift_days: 0,
      is_key_milestone: false,
      key_milestone_label: null,
      subtasks: [],
      dependencies: [], // Will be inferred from week ordering or explicit declarations
      notes: [],
    }
    currentPhaseId = phase
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    // Check for section markers (e.g. "# THE BUILD ROADMAP", "# PARALLEL TRACK")
    const isSectionMarker = config.milestone_patterns.section_markers.some(marker =>
      trimmed.toLowerCase() === marker.toLowerCase()
    )

    if (isSectionMarker) {
      inActiveSection = true
      pushCurrent()
      continue
    }

    // Check for phase headers (e.g. "## Phase 1 — Foundation")
    const phaseMatch = trimmed.match(/^#{1,2}\s*(?:Phase\s*(\d+)[\s—–-]*)(.+)/i)
    if (phaseMatch) {
      currentPhaseId = slugify(phaseMatch[2].trim())
      continue
    }

    // Skip lines outside active sections
    if (!inActiveSection && config.milestone_patterns.section_markers.length > 0) {
      continue
    }

    // Try to parse milestone header using regex from config
    const milestoneRegex = new RegExp(config.milestone_patterns.milestone_regex, 'i')
    const weekRegex = new RegExp(config.milestone_patterns.week_regex, 'i')

    const mMatch = trimmed.match(milestoneRegex)
    if (mMatch) {
      let weekNum = 1
      const weekMatch = trimmed.match(weekRegex)
      if (weekMatch) {
        weekNum = parseInt(weekMatch[1], 10)
      }

      // Extract title: use last capture group if multiple, or the whole match
      let title = mMatch[mMatch.length - 1]?.trim() || trimmed
      // Clean up heading markers from title
      title = title.replace(/^#{1,3}\s*/, '').replace(/^(?:WEEKS?\s*\d+(?:\s*[—–-]\s*\d+)?\s*[—–-]\s*)?/i, '')

      startMilestone(title, weekNum, currentPhaseId ?? undefined)
      continue
    }

    // Parse subtasks using the configured marker
    if (currentMilestone) {
      const ms: Milestone = currentMilestone
      const marker = config.milestone_patterns.subtask_marker
      const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const subtaskRegex = new RegExp(`^\\s*${escapedMarker}\\s*(.+)`)
      const stMatch = line.match(subtaskRegex)
      if (stMatch) {
        const rawLabel = stMatch[1]
          .replace(/\*\*/g, '')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\s+/g, ' ')
          .trim()
        const label = rawLabel.endsWith(':') ? rawLabel.slice(0, -1) : rawLabel
        const idx = ms.subtasks.length + 1
        const subtask: Subtask = {
          id: `${ms.id}_${String(idx).padStart(3, '0')}`,
          label,
          status: 'todo',
          done: false,
          assignee: null,
          blocked_by: null,
          blocked_reason: null,
          completed_at: null,
          completed_by: null,
          priority: 'P1',
          notes: null,
          prompt: null,
          context_files: [],
          reference_docs: [],
          acceptance_criteria: [],
          constraints: [],
          depends_on: [],
          agent_target: null,
          execution_mode: 'human',
          last_run_id: null,
          pipeline: null,
          complexity: classifyTaskComplexity(label),
        }
        ms.subtasks.push(subtask)
      }
    }
  }

  pushCurrent()

  // Infer dependencies: each milestone depends on the previous one in the same phase
  // (unless explicit dependency syntax is found in notes)
  for (let i = 1; i < milestones.length; i++) {
    const prev: Milestone = milestones[i - 1]
    const curr: Milestone = milestones[i]
    if (curr.phase === prev.phase && curr.dependencies.length === 0) {
      curr.dependencies.push(prev.id)
    }
  }

  return { milestones, parseErrors }
}

// ─── Checklist Parser (Generic) ────────────────────────────────────────────

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

export function parseChecklistGeneric(content: string, config: ProjectConfig): { categories: ChecklistCategory[] } {
  const categories: ChecklistCategory[] = []
  const lines = content.split('\n')
  let currentCategory: ChecklistCategory | null = null

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    // Match category headers: "## N. Category Title" or "## Category Title"
    const categoryMatch = trimmed.match(/^#{1,2}\s*(?:(\d+)\.\s*)?(.+)/)
    if (categoryMatch) {
      if (currentCategory) categories.push(currentCategory)
      const title = categoryMatch[2].trim()
      const id = slugify(title)
      const rule = config.audit_rules.find(r => r.category === id || r.id === id)

      currentCategory = {
        id,
        title,
        risk_level: rule?.severity === 'critical' ? 'critical' : 'normal',
        target_week: 1,
        items: [],
      }
      continue
    }

    // Match checklist items: "- ⬜ Item text" or "- [ ] Item text"
    if (currentCategory) {
      const itemMatch = lines[i].match(/^-\s*(?:[⬜\[\]\s]|\[ \])\s*(.+)/)
      if (itemMatch) {
        const label = itemMatch[1]
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\s+/g, ' ')
          .trim()
        const idx = currentCategory.items.length + 1
        currentCategory.items.push({
          id: `${currentCategory.id}_${String(idx).padStart(3, '0')}`,
          label,
          done: false,
          linked_milestone: null,
          completed_at: null,
          completed_by: null,
        })
      }
    }
  }

  if (currentCategory) categories.push(currentCategory)
  return { categories }
}

// ─── Tracker Generator (Generic) ──────────────────────────────────────────

export interface SchedulePhase {
  id: string
  title: string
  color: string
  start_week: number
  end_week: number
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
  agents: import('./canonical-agents').CanonicalAgent[]
  agent_log: import('./parser').AgentLogEntry[]
  schedule: { phases: SchedulePhase[] }
  review_sessions: any[]
  qa: { groups: any[] }
}

export function generateTrackerStateGeneric(
  config: ProjectConfig,
  milestones: Milestone[],
  submissionChecklist: { categories: ChecklistCategory[] },
): TrackerState {
  const totalSubtasks = milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const doneSubtasks = milestones.reduce((s, m) => s + m.subtasks.filter(t => t.done).length, 0)

  return {
    project: {
      name: config.project_name,
      start_date: config.start_date,
      target_submit_date: config.target_submit_date,
      current_week: calculateCurrentWeek(config.start_date, config.total_weeks),
      schedule_status: 'on_track',
      overall_progress: totalSubtasks > 0 ? parseFloat((doneSubtasks / totalSubtasks).toFixed(4)) : 0,
    },
    milestones,
    submission_checklist: submissionChecklist,
    agents: config.agents.map(a => ({
      ...a,
      status: 'idle',
      last_action_at: null,
      session_action_count: 0,
    })),
    agent_log: [],
    schedule: {
      phases: config.phases,
    },
    review_sessions: [],
    qa: { groups: [] },
  }
}
