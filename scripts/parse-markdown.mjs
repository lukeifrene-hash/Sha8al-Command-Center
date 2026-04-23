#!/usr/bin/env node

/**
 * Sha8al Command Center — Markdown Parser + State File Generator
 * Phase 1, Part 1.2
 *
 * Reads project roadmap and optional checklist markdown sources and generates the resolved tracker file for the active profile.
 * Re-runnable: if the tracker exists, preserves completion status of already-done items.
 *
 * Usage:
 *   node scripts/parse-markdown.mjs --consumer-profile=generic --profile=generic --tasks-source=docs/roadmap.md
 *   node scripts/parse-markdown.mjs --consumer-profile=talkstore --profile=talkstore --tasks-source=docs/tasks.md --checklist-source=docs/submission-checklist.md --dry-run
 */

import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'
import { loadCanonicalAgentRoster, mergeCanonicalAgentRoster } from './lib/canonical-agents.mjs'
import { resolveParserProjectPaths } from './lib/project-paths.mjs'
import { validateParserProfilePairing } from './lib/profile-validators.mjs'
import { classifyTaskComplexity } from './lib/task-complexity.mjs'
import { writeTrackerJsonWithBackup } from './lib/tracker-backup.mjs'

function readCliFlag(argv, keys) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    for (const key of keys) {
      if (arg === `--${key}`) {
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) return next
      }

      if (arg.startsWith(`--${key}=`)) {
        return arg.slice(key.length + 3)
      }
    }
  }

  return null
}

function resolveMarkdownParserId(argv = process.argv.slice(2)) {
  const explicitProfile =
    readCliFlag(argv, ['profile', 'parser-profile']) ||
    process.env.COMMAND_CENTER_PARSER_PROFILE ||
    process.env.PARSER_PROFILE ||
    process.env.COMMAND_CENTER_PROFILE ||
    null

  if (!explicitProfile || explicitProfile === 'talkstore') {
    return 'talkstore-markdown'
  }

  if (explicitProfile === 'generic') {
    return 'generic-markdown'
  }

  throw new Error(
    `No markdown parser is registered for profile "${explicitProfile}". ` +
    'Supported markdown parser profiles: generic, talkstore.'
  )
}

function resolveConsumerProfileOverride(argv = process.argv.slice(2)) {
  return readCliFlag(argv, ['consumer-profile'])
}

function toDisplayProjectName(projectRoot, consumerProfile) {
  if (consumerProfile === 'talkstore') return 'Talkstore'

  const slug = basename(projectRoot)
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

// ─── Reference Data from Spec ────────────────────────────────────────────────

// Map from slugified milestone title → metadata
// Slugs are derived from the actual markdown headings via slugify()
const MILESTONE_META = {
  // Build milestones (from the spec's Milestone-to-Domain Mapping table)
  'scaffold_auth_shell':
    { domain: 'foundation', phase: 'foundation', week: 1, is_key: false, key_label: null },
  'tool_router_api_connections':
    { domain: 'foundation', phase: 'foundation', week: 2, is_key: false, key_label: null },
  'section_generation_engine':
    { domain: 'storefront', phase: 'storefront', week: 3, is_key: false, key_label: null },
  'theme_duplication_installation_preview':
    { domain: 'storefront', phase: 'storefront', week: 4, is_key: true, key_label: 'Revenue #1' },
  'section_modification_settings_detection_edge_cases':
    { domain: 'storefront', phase: 'storefront', week: 5, is_key: false, key_label: null },
  'product_scanning_scoring_enrichment':
    { domain: 'product_ops', phase: 'product_ops', week: 6, is_key: true, key_label: 'Revenue #2' },
  'collections_rollback_product_edge_cases':
    { domain: 'product_ops', phase: 'product_ops', week: 7, is_key: false, key_label: null },
  'commerce_intelligence_domain':
    { domain: 'commerce_intel', phase: 'launch_prep', week: 8, is_key: true, key_label: 'Insight→Action' },
  'billing_onboarding_scan':
    { domain: 'launch_prep', phase: 'launch_prep', week: 9, is_key: false, key_label: null },
  'polish_app_store_submission':
    { domain: 'launch_prep', phase: 'launch_prep', week: 10, is_key: true, key_label: 'APP STORE SUBMIT' },
  'review_buffer_beta_testing':
    { domain: 'review_buffer', phase: 'review_buffer', week: 11, is_key: false, key_label: null },
  'live_feedback_fixes':
    { domain: 'v1_2', phase: 'v1_2', week: 13, is_key: false, key_label: null },
  'v1_2_feature_additions':
    { domain: 'v1_2', phase: 'v1_2', week: 15, is_key: true, key_label: 'V1.2 Ship' },
  'proactive_insights_engine':
    { domain: 'v1_5', phase: 'v1_5', week: 17, is_key: false, key_label: null },
  'advanced_features_sidekick_extension_research':
    { domain: 'v1_5', phase: 'v1_5', week: 19, is_key: true, key_label: 'V1.5 Ship' },

  // Distribution milestones
  'landing_page_waitlist_infrastructure':
    { domain: 'distribution', phase: 'foundation', week: 1, is_key: false, key_label: null },
  'video_teaser':
    { domain: 'distribution', phase: 'storefront', week: 3, is_key: false, key_label: null },
  'distribution_campaigns':
    { domain: 'distribution', phase: 'foundation', week: 1, is_key: false, key_label: null },
}

// Multi-week milestone end weeks
const MULTI_WEEK_END = {
  'review_buffer_beta_testing': 12,
  'live_feedback_fixes': 14,
  'v1_2_feature_additions': 16,
  'proactive_insights_engine': 18,
  'advanced_features_sidekick_extension_research': 20,
  'distribution_campaigns': 10,
}

// Dependency graph
const DEPENDENCY_MAP = {
  'tool_router_api_connections': ['scaffold_auth_shell'],
  'section_generation_engine': ['tool_router_api_connections'],
  'theme_duplication_installation_preview': ['section_generation_engine'],
  'section_modification_settings_detection_edge_cases': ['theme_duplication_installation_preview'],
  'product_scanning_scoring_enrichment': ['tool_router_api_connections'],
  'collections_rollback_product_edge_cases': ['product_scanning_scoring_enrichment'],
  'commerce_intelligence_domain': ['tool_router_api_connections'],
  'billing_onboarding_scan': [
    'commerce_intelligence_domain',
    'collections_rollback_product_edge_cases',
    'section_modification_settings_detection_edge_cases',
  ],
  'polish_app_store_submission': ['billing_onboarding_scan'],
  'review_buffer_beta_testing': ['polish_app_store_submission'],
  'live_feedback_fixes': ['review_buffer_beta_testing'],
  'v1_2_feature_additions': ['live_feedback_fixes'],
  'proactive_insights_engine': ['v1_2_feature_additions'],
  'advanced_features_sidekick_extension_research': ['proactive_insights_engine'],
  'video_teaser': ['landing_page_waitlist_infrastructure'],
}

const CHECKLIST_CATEGORY_MAP = {
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

// Linked milestone mapping: which checklist category relates to which milestone
const CHECKLIST_LINKED_MILESTONES = {
  'oauth': 'scaffold_auth_shell',
  'session_security': 'scaffold_auth_shell',
  'privacy_gdpr': 'billing_onboarding_scan',
  'billing': 'billing_onboarding_scan',
  'ui_ux_polaris': 'scaffold_auth_shell',
  'performance': 'section_modification_settings_detection_edge_cases',
  'api_scopes': 'tool_router_api_connections',
  'theme_interaction': 'theme_duplication_installation_preview',
  'listing_brand': 'polish_app_store_submission',
  'webhooks_lifecycle': 'polish_app_store_submission',
  'app_bridge': 'scaffold_auth_shell',
  'safety_support': 'polish_app_store_submission',
  'pre_submit': 'polish_app_store_submission',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[''`"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function weekToDate(weekNum, isEnd = false) {
  // Project starts 2026-03-15 (Sunday). Use UTC to avoid timezone drift.
  const start = Date.UTC(2026, 2, 15) // March = month 2 (0-indexed)
  const dayOffset = (weekNum - 1) * 7 + (isEnd ? 6 : 0)
  const d = new Date(start + dayOffset * 86400000)
  return d.toISOString().split('T')[0]
}

function calculateCurrentWeek() {
  const start = new Date('2026-03-15T00:00:00Z')
  const now = new Date()
  const diffMs = now - start
  if (diffMs < 0) return 1
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, Math.min(20, diffWeeks + 1))
}

// ─── Roadmap Parser ──────────────────────────────────────────────────────────

function parseRoadmap(content) {
  const milestones = []
  const lines = content.split('\n')

  let inBuildRoadmap = false
  let inParallelTrack = false
  let inCodeBlock = false
  let currentMilestone = null

  function pushCurrentMilestone() {
    if (currentMilestone) {
      milestones.push(currentMilestone)
      currentMilestone = null
    }
  }

  function startMilestone(id, title, weekNum) {
    pushCurrentMilestone()
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

    // Track code blocks to avoid parsing checkboxes inside them
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    // ─── Detect major sections ───
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
    // Other H1 headers end parallel track
    if (inParallelTrack && /^# [A-Z]/.test(trimmed) && !trimmed.startsWith('# PARALLEL')) {
      pushCurrentMilestone()
      inParallelTrack = false
    }
    // H1 headers after BUILD ROADMAP that aren't part of it end the section
    if (inBuildRoadmap && /^# [A-Z]/.test(trimmed) && trimmed !== '# THE BUILD ROADMAP') {
      pushCurrentMilestone()
      inBuildRoadmap = false
    }

    // ─── PARALLEL TRACK milestones ───
    if (inParallelTrack) {
      // ## WEEK N — Title
      const distWeekMatch = trimmed.match(/^## WEEK (\d+)\s*[—–-]\s*(.+)/)
      if (distWeekMatch) {
        const weekNum = parseInt(distWeekMatch[1])
        const title = distWeekMatch[2].trim()
        startMilestone(slugify(title), title, weekNum)
        continue
      }
      // ## ONGOING (Weeks N–M) — Title
      const ongoingMatch = trimmed.match(/^## ONGOING.+[—–-]\s*(.+)/)
      if (ongoingMatch) {
        const title = ongoingMatch[1].trim()
        startMilestone(slugify(title), title, 1)
        continue
      }
    }

    // ─── BUILD ROADMAP milestones ───
    if (inBuildRoadmap) {
      // ### WEEK N — Title  or  ### WEEKS N–M — Title
      const weekMatch = trimmed.match(/^### WEEKS?\s*(\d+)(?:\s*[—–-]\s*(\d+))?\s*[—–-]\s*(.+)/)
      if (weekMatch) {
        const weekStart = parseInt(weekMatch[1])
        const title = weekMatch[3].trim()
        startMilestone(slugify(title), title, weekStart)
        continue
      }

      // ## REVIEW BUFFER: Weeks 11–12 ...
      const reviewMatch = trimmed.match(/^## REVIEW BUFFER.*Weeks?\s*(\d+)/i)
      if (reviewMatch) {
        const weekStart = parseInt(reviewMatch[1])
        startMilestone('review_buffer_beta_testing', 'Review Buffer — Beta Testing', weekStart)
        continue
      }
    }

    // ─── Capture exit criteria as notes ───
    if (currentMilestone && /^\*\*Exit Criteria/.test(trimmed)) {
      const exitText = trimmed.replace(/^\*\*Exit Criteria[^*]*\*\*\s*/, '')
      if (exitText) {
        currentMilestone.notes.push(exitText)
      }
    }

    // ─── Parse subtasks (- [ ] items) ───
    if (currentMilestone) {
      const checkboxMatch = line.match(/^(\s*)- \[ \] (.+)/)
      if (checkboxMatch) {
        const rawLabel = checkboxMatch[2]
          .replace(/\*\*/g, '')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\s+/g, ' ')
          .trim()

        // Strip trailing colon from group headers
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

  pushCurrentMilestone()
  return milestones
}

// ─── Checklist Parser ────────────────────────────────────────────────────────

function parseChecklist(content) {
  const categories = []
  const lines = content.split('\n')
  let currentCategory = null

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    // Numbered category: ## N. Title
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

    // Pre-Submission Final Checks
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

    // Parse checklist items: lines starting with "- ⬜"
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

function generateTrackerState(milestones, submissionChecklist, projectName) {
  const totalSubtasks = milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const doneSubtasks = milestones.reduce((s, m) => s + m.subtasks.filter(t => t.done).length, 0)

  return {
    project: {
      name: projectName,
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
  }
}

// ─── Preserve existing completion state ──────────────────────────────────────

function preserveExistingState(newState, existingTracker) {
  if (!existingTracker) return newState

  const existing = existingTracker

  const existingSubtasks = new Map()
  for (const m of existing.milestones || []) {
    for (const s of m.subtasks || []) {
      existingSubtasks.set(s.id, s)
    }
  }

  const existingItems = new Map()
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
        s.prompt = prev.prompt ?? s.prompt
        s.context_files = prev.context_files ?? s.context_files
        s.reference_docs = prev.reference_docs ?? s.reference_docs
        s.acceptance_criteria = prev.acceptance_criteria ?? s.acceptance_criteria
        s.constraints = prev.constraints ?? s.constraints
        s.depends_on = prev.depends_on ?? s.depends_on
        s.agent_target = prev.agent_target ?? s.agent_target
        s.execution_mode = prev.execution_mode ?? s.execution_mode
        s.last_run_id = prev.last_run_id ?? s.last_run_id
        s.pipeline = prev.pipeline ?? s.pipeline
        s.complexity = prev.complexity ?? s.complexity
        s.parallel_priority = prev.parallel_priority ?? s.parallel_priority
        s.prepared = prev.prepared ?? s.prepared
        s.audit_results = prev.audit_results ?? s.audit_results
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

  return newState
}

function readExistingTracker(existingPath) {
  if (!existsSync(existingPath)) return null

  try {
    return JSON.parse(readFileSync(existingPath, 'utf-8'))
  } catch (error) {
    throw new Error(
      `Existing tracker is not valid JSON at ${existingPath}: ` +
      `${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  try {
    const argv = process.argv.slice(2)
    const dryRun = argv.includes('--dry-run')
    const parserId = resolveMarkdownParserId(argv)
    const consumerProfile = resolveConsumerProfileOverride(argv)
    const projectPaths = resolveParserProjectPaths({
      parserId,
      argv,
      ...(consumerProfile ? { profileName: consumerProfile } : {}),
    })
    const tasksPath = projectPaths.tasksPath
    const checklistPath = projectPaths.checklistPath
    const outputPath = projectPaths.trackerPath
    const existingTracker = readExistingTracker(outputPath)
    const parserValidation = validateParserProfilePairing({
      parserId,
      projectPaths,
      existingProject: existingTracker?.project || null,
    })

    console.log('Sha8al Command Center — Markdown Parser')
    console.log('='.repeat(50))
    console.log(`Parser/source pairing: ${parserValidation.parserSourcePairing}`)

    const roadmapContent = readFileSync(tasksPath, 'utf-8')

    console.log(`\nRead: ${tasksPath}`)

    const milestones = parseRoadmap(roadmapContent)
    const submissionChecklist =
      checklistPath && existsSync(checklistPath)
        ? (console.log(`Read: ${checklistPath}`), parseChecklist(readFileSync(checklistPath, 'utf-8')))
        : (console.log('Read: (no submission checklist found; continuing with an empty checklist)'), { categories: [] })

    if (milestones.length === 0) {
      throw new Error(
        `No milestones were parsed from ${tasksPath}. ` +
        'Verify that the selected source matches the markdown parser contract.'
      )
    }

    let state = generateTrackerState(
      milestones,
      submissionChecklist,
      existingTracker?.project?.name || toDisplayProjectName(projectPaths.projectRoot, projectPaths.consumerProfile)
    )
    state = preserveExistingState(state, existingTracker)
    state.project = {
      ...state.project,
      ...parserValidation.projectMetadata,
    }

    // Recompute progress after merge
    const totalSubtasks = state.milestones.reduce((s, m) => s + m.subtasks.length, 0)
    const doneSubtasks = state.milestones.reduce((s, m) => s + m.subtasks.filter(t => t.done).length, 0)
    state.project.overall_progress = totalSubtasks > 0
      ? parseFloat((doneSubtasks / totalSubtasks).toFixed(4)) : 0

    // ─── Report ───
    console.log(`\nOutput: ${outputPath} (${basename(outputPath)})`)

    if (dryRun) {
      console.log('[dry-run] NOT writing tracker')
    } else {
      const writeResult = writeTrackerJsonWithBackup({
        targetPath: outputPath,
        tracker: state,
        label: 'parse-markdown',
      })

      if (!writeResult.changed) {
        console.log('[write] Tracker unchanged; skipped write')
      } else {
        if (writeResult.backupPath) {
          console.log(`[backup] ${writeResult.backupPath}`)
        }
        console.log(`[write] Wrote tracker to ${outputPath}`)
      }
    }

    const totalItems = state.submission_checklist.categories.reduce((s, c) => s + c.items.length, 0)

    console.log('\n╔══════════════════════════════════════════════╗')
    console.log('║            PARSER REPORT                     ║')
    console.log('╠══════════════════════════════════════════════╣')
    console.log(`║  Milestones:          ${String(state.milestones.length).padStart(3)}                    ║`)
    console.log(`║  Total subtasks:      ${String(totalSubtasks).padStart(3)}                    ║`)
    console.log(`║  Checklist categories: ${String(state.submission_checklist.categories.length).padStart(2)}                    ║`)
    console.log(`║  Checklist items:     ${String(totalItems).padStart(3)}                    ║`)
    console.log('╚══════════════════════════════════════════════╝')

    console.log('\n--- MILESTONE BREAKDOWN ---')
    for (const m of state.milestones) {
      const d = m.domain.padEnd(15)
      const k = m.is_key_milestone ? ` ★ ${m.key_milestone_label}` : ''
      console.log(`  W${String(m.week).padStart(2)} | ${d} | ${m.title} (${m.subtasks.length} subtasks)${k}`)
    }

    console.log('\n--- CHECKLIST BREAKDOWN ---')
    for (const c of state.submission_checklist.categories) {
      const r = c.risk_level === 'critical' ? ' ⚠️  CRITICAL' : ''
      console.log(`  ${c.id.padEnd(20)} | W${String(c.target_week).padStart(2)} | ${c.title} (${c.items.length} items)${r}`)
    }

    console.log('\nDone.')
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
