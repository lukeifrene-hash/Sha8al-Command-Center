/**
 * Sha8al Command Center — Markdown Parser + State File Generator
 * Phase 1, Part 1.2
 *
 * Importable module for the Electron main process.
 * Reads the configured roadmap/checklist markdown sources and generates the active tracker file.
 * Re-runnable: preserves completion status of already-done items.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { loadCanonicalAgentRoster, mergeCanonicalAgentRoster } from './canonical-agents'
import { classifyTaskComplexity } from './task-complexity'
import { QA_SEED } from '../../mcp-server/src/qa-seed.js'

// ─── Types ───────────────────────────────────────────────────────────────────

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

  // Prompt layer (agentic task board)
  prompt: string | null
  context_files: string[]
  reference_docs: string[]
  acceptance_criteria: string[]
  constraints: string[]

  // Dependencies (subtask-level)
  depends_on: string[]

  // Execution config
  agent_target: 'explorer' | 'planner' | 'builder' | null
  execution_mode: 'human' | 'agent' | 'pair'
  execution_mode_reasoning?: string
  last_run_id: string | null

  // Pipeline (chained agent dispatch)
  pipeline: Pipeline | null

  // Task sizing starts with parser heuristics and can be refined by later
  // dependency-analysis passes. Consumed by TaskCard and MCP workflow tools.
  complexity?: 'small' | 'medium' | 'large' | 'architectural'
  parallel_priority?: number
  prepared?: boolean

  // Auditor workflow — set when the Auditor agent calls submit_audit on this
  // task. The MCP server auto-approves backend-lane tasks with 12/12 pass;
  // frontend/launch tasks stay in `review` with audit_results attached for
  // operator eyeball. The UI renders an audit badge when this is populated.
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

  // Set by mcp__talkstore__submit_milestone_audit when the milestone-auditor
  // subsystem completes a cycle. Drives the outer audit-verdict ring on the
  // swim lane node + the audit summary in MilestoneDetailPanel.
  audit?: MilestoneAudit
}

export interface MilestoneFinding {
  severity: 'critical' | 'major' | 'minor'
  category: 'coherence' | 'security' | 'ux' | 'compliance'
  description: string
  evidence: string
  remediation?: string
}

export interface MilestoneAudit {
  verdict: 'pass' | 'pass_with_notes' | 'fail'
  findings: MilestoneFinding[]
  audited_at: string
  report_path: string
  state_doc_path: string
  checklist_items_updated: number
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

export interface Agent {
  id: string
  name: string
  type: string
  parent_id?: string
  color: string
  status: string
  permissions: string[]
  last_action_at: string | null
  session_action_count: number
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

// ─── Pipeline Types ───────────────────────────────────────────────────────────

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

export interface SchedulePhase {
  id: string
  title: string
  color: string
  start_week: number
  end_week: number
}

export interface WaitlistEntry {
  week: number
  count: number
  note: string | null
}

export interface WaitlistTracker {
  domain: string
  label: string
  color: string
  start_week: number
  end_week: number
  unit: string
  entries: WaitlistEntry[]
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
  agents: Agent[]
  agent_log: AgentLogEntry[]
  schedule: { phases: SchedulePhase[] }
  waitlist_tracker?: WaitlistTracker
  review_sessions: ReviewSession[]
  qa: QAData
}

// ─── Reference Data ──────────────────────────────────────────────────────────

interface MilestoneMeta {
  domain: string
  phase: string
  week: number
  is_key: boolean
  key_label: string | null
}

const MILESTONE_META: Record<string, MilestoneMeta> = {
  // Phase 1: Foundation
  scaffold_auth_chat_shell:
    { domain: 'foundation', phase: 'foundation', week: 1, is_key: false, key_label: null },
  tool_router_api_connections_store_awareness:
    { domain: 'foundation', phase: 'foundation', week: 2, is_key: false, key_label: null },
  // Phase 2: Storefront
  section_generation_engine:
    { domain: 'storefront', phase: 'storefront', week: 3, is_key: false, key_label: null },
  theme_duplication_installation_preview_flow:
    { domain: 'storefront', phase: 'storefront', week: 4, is_key: true, key_label: 'Revenue #1' },
  modifications_settings_detection_storefront_safety:
    { domain: 'storefront', phase: 'storefront', week: 5, is_key: false, key_label: null },
  // Phase 3: Product Ops
  product_scanning_scoring_enrichment:
    { domain: 'product_ops', phase: 'product_ops', week: 6, is_key: true, key_label: 'Revenue #2' },
  collections_rollback_edge_cases:
    { domain: 'product_ops', phase: 'product_ops', week: 7, is_key: false, key_label: null },
  // Phase 4: Commerce Intel + Launch Prep
  commerce_intelligence_domain:
    { domain: 'commerce_intel', phase: 'launch_prep', week: 8, is_key: true, key_label: 'Insight→Action' },
  billing_onboarding_scan:
    { domain: 'launch_prep', phase: 'launch_prep', week: 9, is_key: false, key_label: null },
  history_webhooks_safety_hardening:
    { domain: 'launch_prep', phase: 'launch_prep', week: 10, is_key: false, key_label: null },
  polish_legal_app_store_submission:
    { domain: 'launch_prep', phase: 'launch_prep', week: 10, is_key: true, key_label: 'APP STORE SUBMIT' },
  // Phase 5: Review Buffer
  beta_testing_review_response:
    { domain: 'review_buffer', phase: 'review_buffer', week: 11, is_key: false, key_label: null },
  // Phase 6: V1.2
  live_feedback_fixes:
    { domain: 'v1_2', phase: 'v1_2', week: 13, is_key: false, key_label: null },
  feed_generation_health_score:
    { domain: 'v1_2', phase: 'v1_2', week: 15, is_key: true, key_label: 'V1.2 Ship' },
  // Phase 7: V1.5
  proactive_insights_engine:
    { domain: 'v1_5', phase: 'v1_5', week: 17, is_key: false, key_label: null },
  multi_theme_advanced_storefront:
    { domain: 'v1_5', phase: 'v1_5', week: 19, is_key: true, key_label: 'V1.5 Ship' },
  // Distribution (Parallel Track)
  landing_page_waitlist:
    { domain: 'distribution', phase: 'foundation', week: 1, is_key: false, key_label: null },
  video_teaser:
    { domain: 'distribution', phase: 'foundation', week: 1, is_key: false, key_label: null },
  distribution_campaigns:
    { domain: 'distribution', phase: 'foundation', week: 1, is_key: false, key_label: null },
}

const MULTI_WEEK_END: Record<string, number> = {
  beta_testing_review_response: 12,
  live_feedback_fixes: 14,
  feed_generation_health_score: 16,
  proactive_insights_engine: 18,
  multi_theme_advanced_storefront: 20,
  distribution_campaigns: 10,
}

const DEPENDENCY_MAP: Record<string, string[]> = {
  tool_router_api_connections_store_awareness: ['scaffold_auth_chat_shell'],
  section_generation_engine: ['tool_router_api_connections_store_awareness'],
  theme_duplication_installation_preview_flow: ['section_generation_engine'],
  modifications_settings_detection_storefront_safety: ['theme_duplication_installation_preview_flow'],
  product_scanning_scoring_enrichment: ['tool_router_api_connections_store_awareness'],
  collections_rollback_edge_cases: ['product_scanning_scoring_enrichment'],
  commerce_intelligence_domain: ['tool_router_api_connections_store_awareness'],
  billing_onboarding_scan: [
    'commerce_intelligence_domain',
    'collections_rollback_edge_cases',
    'modifications_settings_detection_storefront_safety',
  ],
  history_webhooks_safety_hardening: ['billing_onboarding_scan'],
  polish_legal_app_store_submission: ['history_webhooks_safety_hardening'],
  beta_testing_review_response: ['polish_legal_app_store_submission'],
  live_feedback_fixes: ['beta_testing_review_response'],
  feed_generation_health_score: ['live_feedback_fixes'],
  proactive_insights_engine: ['feed_generation_health_score'],
  multi_theme_advanced_storefront: ['proactive_insights_engine'],
  video_teaser: ['landing_page_waitlist'],
}

const CHECKLIST_CATEGORY_MAP: Record<string, { id: string; title: string; target_week: number; risk_level: 'normal' | 'critical' }> = {
  '1': { id: 'oauth', title: 'OAuth + Auth', target_week: 1, risk_level: 'normal' },
  '2': { id: 'session_security', title: 'Session + Security', target_week: 1, risk_level: 'normal' },
  '3': { id: 'privacy_gdpr', title: 'Privacy + GDPR', target_week: 9, risk_level: 'normal' },
  '4': { id: 'billing', title: 'Billing', target_week: 9, risk_level: 'normal' },
  '5': { id: 'ui_ux_polaris', title: 'UI/UX + Polaris', target_week: 1, risk_level: 'normal' },
  '6': { id: 'performance', title: 'Performance', target_week: 5, risk_level: 'normal' },
  '7': { id: 'api_scopes', title: 'API + Scopes', target_week: 2, risk_level: 'normal' },
  '8': { id: 'theme_interaction', title: 'Theme Interaction', target_week: 4, risk_level: 'critical' },
  '9': { id: 'listing_brand', title: 'Listing + Brand', target_week: 10, risk_level: 'normal' },
  '10': { id: 'webhooks_lifecycle', title: 'Webhooks + Lifecycle', target_week: 10, risk_level: 'normal' },
  '11': { id: 'app_bridge', title: 'App Bridge', target_week: 1, risk_level: 'normal' },
  '12': { id: 'safety_support', title: 'Safety + Support', target_week: 10, risk_level: 'normal' },
}

const CHECKLIST_LINKED_MILESTONES: Record<string, string> = {
  oauth: 'scaffold_auth_chat_shell',
  session_security: 'scaffold_auth_chat_shell',
  privacy_gdpr: 'history_webhooks_safety_hardening',
  billing: 'billing_onboarding_scan',
  ui_ux_polaris: 'scaffold_auth_chat_shell',
  performance: 'modifications_settings_detection_storefront_safety',
  api_scopes: 'tool_router_api_connections_store_awareness',
  theme_interaction: 'theme_duplication_installation_preview_flow',
  listing_brand: 'polish_legal_app_store_submission',
  webhooks_lifecycle: 'history_webhooks_safety_hardening',
  app_bridge: 'scaffold_auth_chat_shell',
  safety_support: 'polish_legal_app_store_submission',
  pre_submit: 'polish_legal_app_store_submission',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function weekToDate(weekNum: number, isEnd = false): string {
  const start = Date.UTC(2026, 2, 15)
  const dayOffset = (weekNum - 1) * 7 + (isEnd ? 6 : 0)
  const d = new Date(start + dayOffset * 86400000)
  return d.toISOString().split('T')[0]
}

export function calculateCurrentWeek(): number {
  const start = new Date('2026-03-15T00:00:00Z')
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 1
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, Math.min(20, diffWeeks + 1))
}

// ─── Roadmap Parser ──────────────────────────────────────────────────────────

export function parseRoadmap(content: string): Milestone[] {
  const milestones: Milestone[] = []
  const lines = content.split('\n')

  let inBuildRoadmap = false
  let inParallelTrack = false
  let inCodeBlock = false
  let currentMilestone: Milestone | null = null

  function pushCurrent() {
    if (currentMilestone) {
      milestones.push(currentMilestone)
      currentMilestone = null
    }
  }

  function startMilestone(id: string, title: string, weekNum: number) {
    pushCurrent()
    const meta = MILESTONE_META[id] || {
      domain: 'foundation', phase: 'foundation', week: weekNum, is_key: false, key_label: null,
    }
    const weekEnd = MULTI_WEEK_END[id] || meta.week || weekNum
    currentMilestone = {
      id,
      title,
      domain: meta.domain,
      week: meta.week || weekNum,
      phase: meta.phase,
      planned_start: weekToDate(meta.week || weekNum),
      planned_end: weekToDate(weekEnd, true),
      actual_start: null,
      actual_end: null,
      drift_days: 0,
      is_key_milestone: meta.is_key,
      key_milestone_label: meta.key_label,
      subtasks: [],
      dependencies: DEPENDENCY_MAP[id] || [],
      notes: [],
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    // Detect major sections
    if (trimmed === '# THE BUILD ROADMAP') {
      inBuildRoadmap = true
      inParallelTrack = false
      continue
    }
    if (trimmed.startsWith('# PARALLEL TRACK')) {
      inParallelTrack = true
      inBuildRoadmap = false
      continue
    }
    if (inParallelTrack && /^# [A-Z]/.test(trimmed) && !trimmed.startsWith('# PARALLEL')) {
      pushCurrent()
      inParallelTrack = false
    }
    if (inBuildRoadmap && /^# [A-Z]/.test(trimmed) && trimmed !== '# THE BUILD ROADMAP') {
      pushCurrent()
      inBuildRoadmap = false
    }

    // PARALLEL TRACK milestones
    if (inParallelTrack) {
      const distWeekMatch = trimmed.match(/^## WEEK (\d+)\s*[—–-]\s*(.+)/)
      if (distWeekMatch) {
        startMilestone(slugify(distWeekMatch[2].trim()), distWeekMatch[2].trim(), parseInt(distWeekMatch[1]))
        continue
      }
      const ongoingMatch = trimmed.match(/^## ONGOING.+[—–-]\s*(.+)/)
      if (ongoingMatch) {
        startMilestone(slugify(ongoingMatch[1].trim()), ongoingMatch[1].trim(), 1)
        continue
      }
    }

    // BUILD ROADMAP milestones
    if (inBuildRoadmap) {
      const weekMatch = trimmed.match(/^### WEEKS?\s*(\d+)(?:\s*[—–-]\s*(\d+))?\s*[—–-]\s*(.+)/)
      if (weekMatch) {
        startMilestone(slugify(weekMatch[3].trim()), weekMatch[3].trim(), parseInt(weekMatch[1]))
        continue
      }
      const reviewMatch = trimmed.match(/^## REVIEW BUFFER.*Weeks?\s*(\d+)/i)
      if (reviewMatch) {
        startMilestone('beta_testing_review_response', 'Beta Testing + Review Response', parseInt(reviewMatch[1]))
        continue
      }
    }

    // Exit criteria → notes
    if (currentMilestone && /^\*\*Exit Criteria/.test(trimmed)) {
      const exitText = trimmed.replace(/^\*\*Exit Criteria[^*]*\*\*\s*/, '')
      if (exitText) currentMilestone.notes.push(exitText)
    }

    // Parse subtasks
    if (currentMilestone) {
      const checkboxMatch = line.match(/^\s*- \[ \] (.+)/)
      if (checkboxMatch) {
        const rawLabel = checkboxMatch[1]
          .replace(/\*\*/g, '')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\s+/g, ' ')
          .trim()
        const label = rawLabel.endsWith(':') ? rawLabel.slice(0, -1) : rawLabel
        const idx = currentMilestone.subtasks.length + 1
        currentMilestone.subtasks.push({
          id: `${currentMilestone.id}_${String(idx).padStart(3, '0')}`,
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
        })
      }
    }
  }

  pushCurrent()
  return milestones
}

// ─── Checklist Parser ────────────────────────────────────────────────────────

export function parseChecklist(content: string): { categories: ChecklistCategory[] } {
  const categories: ChecklistCategory[] = []
  const lines = content.split('\n')
  let currentCategory: ChecklistCategory | null = null

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    const categoryMatch = trimmed.match(/^## (\d+)\.\s+(.+)/)
    if (categoryMatch) {
      if (currentCategory) categories.push(currentCategory)
      const meta = CHECKLIST_CATEGORY_MAP[categoryMatch[1]]
      if (meta) {
        currentCategory = {
          id: meta.id,
          title: meta.title,
          risk_level: meta.risk_level,
          target_week: meta.target_week,
          items: [],
        }
      }
      continue
    }

    if (/^## Pre-Submission Final Checks/.test(trimmed)) {
      if (currentCategory) categories.push(currentCategory)
      currentCategory = {
        id: 'pre_submit',
        title: 'Pre-Submission Final Checks',
        risk_level: 'normal',
        target_week: 10,
        items: [],
      }
      continue
    }

    if (currentCategory) {
      const itemMatch = lines[i].match(/^- ⬜\s+(.+)/)
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
          linked_milestone: CHECKLIST_LINKED_MILESTONES[currentCategory.id] || null,
          completed_at: null,
          completed_by: null,
        })
      }
    }
  }

  if (currentCategory) categories.push(currentCategory)
  return { categories }
}

// ─── State File Generator ────────────────────────────────────────────────────

export function generateTrackerState(
  milestones: Milestone[],
  submissionChecklist: { categories: ChecklistCategory[] },
): TrackerState {
  const totalSubtasks = milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const doneSubtasks = milestones.reduce((s, m) => s + m.subtasks.filter(t => t.done).length, 0)

  return {
    project: {
      name: 'Talkstore',
      start_date: '2026-03-15',
      target_submit_date: '2026-05-24',
      current_week: calculateCurrentWeek(),
      schedule_status: 'on_track',
      overall_progress: totalSubtasks > 0 ? parseFloat((doneSubtasks / totalSubtasks).toFixed(4)) : 0,
    },
    milestones,
    submission_checklist: submissionChecklist,
    agents: loadCanonicalAgentRoster(),
    agent_log: [],
    schedule: {
      phases: [
        { id: 'foundation', title: 'Foundation', color: '#585CF0', start_week: 1, end_week: 2 },
        { id: 'storefront', title: 'Storefront', color: '#22c55e', start_week: 3, end_week: 5 },
        { id: 'product_ops', title: 'Product Ops', color: '#f59e0b', start_week: 6, end_week: 7 },
        { id: 'launch_prep', title: 'Launch Prep', color: '#ef4444', start_week: 8, end_week: 10 },
        { id: 'review_buffer', title: 'Review Buffer', color: '#9B9BAA', start_week: 11, end_week: 12 },
        { id: 'v1_2', title: 'V1.2', color: '#8286FF', start_week: 13, end_week: 16 },
        { id: 'v1_5', title: 'V1.5', color: '#585CF0', start_week: 17, end_week: 20 },
      ],
    },
    review_sessions: [],
    qa: QA_SEED,
  }
}

// ─── Preserve Existing State ─────────────────────────────────────────────────

export function preserveExistingState(newState: TrackerState, existingPath: string): TrackerState {
  if (!existsSync(existingPath)) return newState

  let existing: TrackerState
  try {
    existing = JSON.parse(readFileSync(existingPath, 'utf-8'))
  } catch {
    return newState
  }

  const existingSubtasks = new Map<string, Subtask>()
  for (const m of existing.milestones || []) {
    for (const s of m.subtasks || []) {
      existingSubtasks.set(s.id, s)
    }
  }

  const existingItems = new Map<string, ChecklistItem>()
  for (const cat of existing.submission_checklist?.categories || []) {
    for (const item of cat.items || []) {
      existingItems.set(item.id, item)
    }
  }

  for (const m of newState.milestones) {
    for (const s of m.subtasks) {
      const prev = existingSubtasks.get(s.id)
      if (prev) {
        s.done = prev.done
        s.status = prev.status || (prev.done ? 'done' : 'todo')
        s.assignee = prev.assignee
        s.blocked_by = prev.blocked_by
        s.blocked_reason = prev.blocked_reason
        s.completed_at = prev.completed_at
        s.completed_by = prev.completed_by
        s.priority = prev.priority || s.priority
        s.notes = prev.notes

        // Prompt-layer fields
        s.prompt = prev.prompt
        s.context_files = prev.context_files ?? s.context_files
        s.reference_docs = prev.reference_docs ?? s.reference_docs
        s.acceptance_criteria = prev.acceptance_criteria ?? s.acceptance_criteria
        s.constraints = prev.constraints ?? s.constraints
        s.depends_on = prev.depends_on ?? s.depends_on
        s.agent_target = prev.agent_target
        s.execution_mode = prev.execution_mode ?? s.execution_mode
        s.execution_mode_reasoning = prev.execution_mode_reasoning ?? s.execution_mode_reasoning
        s.last_run_id = prev.last_run_id
        s.complexity = prev.complexity ?? s.complexity
        s.parallel_priority = prev.parallel_priority ?? s.parallel_priority
        s.prepared = prev.prepared ?? s.prepared
        s.audit_results = prev.audit_results ?? s.audit_results

        // Pipeline state
        s.pipeline = prev.pipeline ?? null
      }
    }
  }

  for (const cat of newState.submission_checklist.categories) {
    for (const item of cat.items) {
      const prev = existingItems.get(item.id)
      if (prev) {
        item.done = prev.done
        item.completed_at = prev.completed_at
        item.completed_by = prev.completed_by
      }
    }
  }

  if (existing.agent_log?.length) newState.agent_log = existing.agent_log
  if (existing.agents?.length) {
    newState.agents = mergeCanonicalAgentRoster(existing.agents)
  } else {
    newState.agents = mergeCanonicalAgentRoster(newState.agents)
  }
  if ((existing as any).review_sessions?.length) newState.review_sessions = (existing as any).review_sessions
  if ((existing as any).qa) newState.qa = (existing as any).qa

  return newState
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ParseOptions {
  roadmapPath: string
  checklistPath?: string | null
  outputPath: string
}

/**
 * Parse markdown sources and generate/update the active tracker file.
 * Returns the generated state and counts for reporting.
 */
export function parseAndGenerate(opts: ParseOptions): {
  state: TrackerState
  counts: { milestones: number; subtasks: number; categories: number; checklistItems: number }
} {
  const roadmapContent = readFileSync(opts.roadmapPath, 'utf-8')

  const milestones = parseRoadmap(roadmapContent)
  const submissionChecklist =
    opts.checklistPath && existsSync(opts.checklistPath)
      ? parseChecklist(readFileSync(opts.checklistPath, 'utf-8'))
      : { categories: [] }

  let state = generateTrackerState(milestones, submissionChecklist)
  state = preserveExistingState(state, opts.outputPath)

  // Recompute progress after merge
  const totalSubtasks = state.milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const doneSubtasks = state.milestones.reduce((s, m) => s + m.subtasks.filter(t => t.done).length, 0)
  state.project.overall_progress = totalSubtasks > 0
    ? parseFloat((doneSubtasks / totalSubtasks).toFixed(4)) : 0

  writeFileSync(opts.outputPath, JSON.stringify(state, null, 2), 'utf-8')

  const totalItems = state.submission_checklist.categories.reduce((s, c) => s + c.items.length, 0)

  return {
    state,
    counts: {
      milestones: state.milestones.length,
      subtasks: totalSubtasks,
      categories: state.submission_checklist.categories.length,
      checklistItems: totalItems,
    },
  }
}
