#!/usr/bin/env node

/**
 * AI Commerce Index Platform — Roadmap to Tracker parser.
 *
 * Reads `Brainstorming & Pivot/ROADMAP.md` and emits a seeded
 * `talkstore-tracker.json` matching the shape consumed by
 * `src/main/parser.ts` in this Command Center.
 *
 * Usage:
 *   node scripts/parse-aci-roadmap.mjs --profile=aci --aci-roadmap-source="Brainstorming & Pivot/ROADMAP.md"
 *   node scripts/parse-aci-roadmap.mjs --profile=aci --aci-roadmap-source="Brainstorming & Pivot/ROADMAP.md" --reset
 *   node scripts/parse-aci-roadmap.mjs --profile=aci --aci-roadmap-source="Brainstorming & Pivot/ROADMAP.md" --dry-run
 */

import { readFileSync, existsSync } from 'fs'
import { basename, join } from 'path'
import { resolveParserProjectPaths } from './lib/project-paths.mjs'
import { validateParserProfilePairing } from './lib/profile-validators.mjs'
import { writeTrackerJsonWithBackup } from './lib/tracker-backup.mjs'

const MILESTONE_ID_BY_NUMBER = {
  M1: 'm1_purge_and_foundation_reset',
  M2: 'm2_multi_llm_and_async_infra',
  M3: 'm3_scoring_engine',
  M4: 'm4_catalog_intelligence_engine',
  M5: 'm5_autopilot_and_guard',
  M6: 'm6_attribution_pipeline',
  M7: 'm7_merchant_surfaces',
  M8: 'm8_ux_polish_and_marketing',
  M9: 'm9_quality_security_compliance',
  M10: 'm10_launch_and_post_launch',
}

const MILESTONE_DOMAIN = {
  m1_purge_and_foundation_reset: 'foundation',
  m2_multi_llm_and_async_infra: 'foundation',
  m3_scoring_engine: 'product_engines',
  m4_catalog_intelligence_engine: 'product_engines',
  m5_autopilot_and_guard: 'product_engines',
  m6_attribution_pipeline: 'product_engines',
  m7_merchant_surfaces: 'merchant_facing',
  m8_ux_polish_and_marketing: 'merchant_facing',
  m9_quality_security_compliance: 'ship_and_operate',
  m10_launch_and_post_launch: 'ship_and_operate',
}

const MILESTONE_PHASE = {
  m1_purge_and_foundation_reset: 'phase_0_prep',
  m2_multi_llm_and_async_infra: 'phase_1_foundation',
  m3_scoring_engine: 'phase_2_backend_core',
  m4_catalog_intelligence_engine: 'phase_2_backend_core',
  m5_autopilot_and_guard: 'phase_2_backend_core',
  m6_attribution_pipeline: 'phase_2_backend_core',
  m7_merchant_surfaces: 'phase_3_frontend',
  m8_ux_polish_and_marketing: 'phase_4_ux_polish',
  m9_quality_security_compliance: 'phase_5_quality',
  m10_launch_and_post_launch: 'phase_6_launch',
}

const MILESTONE_WEEK = {
  m1_purge_and_foundation_reset: 1,
  m2_multi_llm_and_async_infra: 2,
  m3_scoring_engine: 3,
  m4_catalog_intelligence_engine: 4,
  m5_autopilot_and_guard: 5,
  m6_attribution_pipeline: 6,
  m7_merchant_surfaces: 7,
  m8_ux_polish_and_marketing: 9,
  m9_quality_security_compliance: 10,
  m10_launch_and_post_launch: 11,
}

const MILESTONE_IS_KEY = {
  m1_purge_and_foundation_reset: true,
  m3_scoring_engine: true,
  m7_merchant_surfaces: true,
  m9_quality_security_compliance: true,
  m10_launch_and_post_launch: true,
}

const MILESTONE_KEY_LABEL = {
  m1_purge_and_foundation_reset: 'Foundation',
  m3_scoring_engine: 'Index Live',
  m7_merchant_surfaces: 'UI Live',
  m9_quality_security_compliance: 'Quality Gate',
  m10_launch_and_post_launch: 'App Store Submit',
}

const PROJECT_START_UTC = Date.UTC(2026, 3, 19)
function weekToDate(weekNum, isEnd = false) {
  const dayOffset = (weekNum - 1) * 7 + (isEnd ? 6 : 0)
  const d = new Date(PROJECT_START_UTC + dayOffset * 86400000)
  return d.toISOString().split('T')[0]
}

function splitIntoMilestoneBlocks(markdown) {
  const lines = markdown.split('\n')
  const blocks = []
  let current = null
  for (const line of lines) {
    const m = /^## (M\d+) \u2014 (.+)$/.exec(line) || /^## (M\d+) [-\u2014] (.+)$/.exec(line)
    if (m) {
      if (current) blocks.push(current)
      current = { number: m[1], title: m[2].trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) blocks.push(current)
  return blocks
}

function extractField(lines, fieldName) {
  const re = new RegExp('^\\*\\*' + fieldName + ':\\*\\*\\s*(.*)$')
  for (const line of lines) {
    const m = re.exec(line)
    if (m) return m[1].trim()
  }
  return ''
}

function extractMultilineField(lines, fieldName) {
  const re = new RegExp('^\\*\\*' + fieldName + ':\\*\\*\\s*(.*)$')
  let collecting = false
  const collected = []
  for (const line of lines) {
    const m = re.exec(line)
    if (m) {
      collected.push(m[1].trim())
      collecting = true
      continue
    }
    if (collecting) {
      if (!line.trim()) break
      if (/^\*\*[A-Z]/.test(line.trim())) break
      if (line.trim().startsWith('- ')) break
      collected.push(line.trim())
    }
  }
  return collected.join(' ').trim()
}

function extractBulletList(lines, afterFieldName) {
  const re = new RegExp('^\\*\\*' + afterFieldName + ':\\*\\*')
  let collecting = false
  const items = []
  for (const line of lines) {
    if (re.test(line)) {
      collecting = true
      continue
    }
    if (!collecting) continue
    const trimmed = line.trim()
    if (!trimmed) {
      if (items.length === 0) continue
      else break
    }
    if (/^\*\*[A-Z]/.test(trimmed)) break
    const bullet = /^-\s+(.*)$/.exec(trimmed)
    if (bullet) items.push(bullet[1].trim())
  }
  return items
}

function extractTaskBlocks(lines) {
  // Lenient collector: start accumulating at the first task-header pattern,
  // regardless of whether a `**Tasks:**` header appeared first. Some milestone
  // agents (M3) omit that header and launch straight into task blocks.
  const blocks = []
  let current = null
  const HEADER_RE = /^-\s+\*\*(T\d+\.\d+)\s+[\u2014-]\s+(.+?)\*\*\s*$/
  for (const line of lines) {
    const header = HEADER_RE.exec(line)
    if (header) {
      if (current) blocks.push(current)
      current = { id: header[1], title: header[2].trim(), lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) blocks.push(current)
  return blocks
}

function extractTaskField(taskLines, fieldName) {
  const re = new RegExp('^\\s*-\\s+\\*\\*' + fieldName + ':\\*\\*\\s*(.*)$')
  for (const line of taskLines) {
    const m = re.exec(line)
    if (m) return m[1].trim()
  }
  return ''
}

function parseDependencyList(raw) {
  if (!raw) return []
  const cleaned = raw.replace(/\([^)]*\)/g, '').replace(/\s+complete\b/gi, '')
  const tokens = cleaned.split(/[,;]/).map((s) => s.trim()).filter(Boolean).filter((s) => s.toLowerCase() !== 'none')
  const normalized = []
  for (const tok of tokens) {
    if (/^M\d+$/i.test(tok)) normalized.push(tok.toUpperCase())
    else if (/^T\d+\.\d+$/i.test(tok)) normalized.push(tok.toUpperCase())
    else {
      const m = /^(M\d+)/i.exec(tok) || /^(T\d+\.\d+)/i.exec(tok)
      if (m) normalized.push(m[1].toUpperCase())
    }
  }
  return Array.from(new Set(normalized))
}

function buildTaskPrompt(task) {
  const lines = []
  lines.push('## ' + task.id + ' \u2014 ' + task.title)
  lines.push('')
  if (task.what) lines.push('**What:** ' + task.what)
  if (task.why) lines.push('**Why:** ' + task.why)
  if (task.acceptance) lines.push('**Acceptance:** ' + task.acceptance)
  if (task.dependencies_raw) lines.push('**Dependencies:** ' + task.dependencies_raw)
  if (task.complexity) lines.push('**Complexity:** ' + task.complexity)
  if (task.failure_modes) lines.push('**Failure modes:** ' + task.failure_modes)
  return lines.join('\n').trim()
}

function readExistingTracker(outputPath) {
  if (!existsSync(outputPath)) return null

  try {
    return JSON.parse(readFileSync(outputPath, 'utf8'))
  } catch (error) {
    throw new Error(
      `Existing tracker is not valid JSON at ${outputPath}: ` +
      `${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function loadExistingProgress(existingTracker) {
  if (!existingTracker) return new Map()

  const map = new Map()
  for (const m of existingTracker.milestones || []) {
    for (const s of m.subtasks || []) {
      map.set(s.id, {
        status: s.status,
        done: s.done,
        assignee: s.assignee,
        completed_at: s.completed_at,
        completed_by: s.completed_by,
      })
    }
  }
  return map
}

function main() {
  try {
    const dryRun = process.argv.includes('--dry-run')
    const resetMode = process.argv.includes('--reset')
    const projectPaths = resolveParserProjectPaths({ parserId: 'aci-roadmap' })
    const roadmapPath = projectPaths.aciRoadmapPath
    const outputPath = projectPaths.trackerPath
    const manifestoPath = join(projectPaths.projectRoot, 'Brainstorming & Pivot', 'MASTER-MANIFESTO.md')

    console.log('[parse-aci-roadmap] reading ' + roadmapPath)
    if (!existsSync(roadmapPath)) {
      console.error('ERROR: roadmap not found at ' + roadmapPath)
      process.exit(1)
    }
    const markdown = readFileSync(roadmapPath, 'utf8')
    const milestoneBlocks = splitIntoMilestoneBlocks(markdown)
    console.log('[parse-aci-roadmap] found ' + milestoneBlocks.length + ' milestone blocks')
    if (milestoneBlocks.length !== 10) {
      console.warn('[parse-aci-roadmap] WARNING: expected 10 milestones, got ' + milestoneBlocks.length)
    }
    const existingTracker = readExistingTracker(outputPath) || {}
    const existingProgress = resetMode ? new Map() : loadExistingProgress(existingTracker)
    const parserValidation = validateParserProfilePairing({
      parserId: 'aci-roadmap',
      projectPaths,
      existingProject: existingTracker.project || null,
      sourceOverrides: {
        manifesto: manifestoPath,
      },
    })
    console.log('[parse-aci-roadmap] parser/source pairing ' + parserValidation.parserSourcePairing)
    const milestones = milestoneBlocks.map((block) => {
      const id = MILESTONE_ID_BY_NUMBER[block.number]
      if (!id) { console.warn('unrecognized milestone: ' + block.number); return null }
      const phase = MILESTONE_PHASE[id] || 'phase_0_prep'
      const domain = MILESTONE_DOMAIN[id] || 'foundation'
      const week = MILESTONE_WEEK[id] || 1
      const rawDependencies = extractField(block.lines, 'Dependencies')
      const milestoneDeps = parseDependencyList(rawDependencies).filter((d) => /^M\d+$/i.test(d)).map((d) => MILESTONE_ID_BY_NUMBER[d.toUpperCase()] || d)
      const goal = extractMultilineField(block.lines, 'Goal')
      const exitCriteria = extractBulletList(block.lines, 'Exit criteria')
      const taskBlocks = extractTaskBlocks(block.lines)
      const subtasks = taskBlocks.map((tb) => {
        const task = {
          id: tb.id.toLowerCase(),
          title: tb.title,
          what: extractTaskField(tb.lines, 'What'),
          why: extractTaskField(tb.lines, 'Why'),
          acceptance: extractTaskField(tb.lines, 'Acceptance'),
          dependencies_raw: extractTaskField(tb.lines, 'Dependencies'),
          complexity: extractTaskField(tb.lines, 'Complexity'),
          failure_modes: extractTaskField(tb.lines, 'Failure modes'),
        }
        const deps = parseDependencyList(task.dependencies_raw)
        const priorState = existingProgress.get(task.id) || null
        return {
          id: task.id,
          label: task.title,
          status: priorState?.status || 'todo',
          done: priorState?.done || false,
          assignee: priorState?.assignee || null,
          blocked_by: null,
          blocked_reason: null,
          completed_at: priorState?.completed_at || null,
          completed_by: priorState?.completed_by || null,
          priority: null,
          notes: 'Complexity: ' + (task.complexity || 'unspecified') + (deps.length ? ' | Depends on: ' + deps.join(', ') : ''),
          prompt: buildTaskPrompt(task),
          acceptance: task.acceptance,
          depends_on: deps.map((d) => d.toLowerCase()),
          what: task.what,
          why: task.why,
          failure_modes: task.failure_modes,
          complexity: task.complexity,
        }
      })
      return {
        id, title: block.title, domain, week, phase,
        planned_start: weekToDate(week, false),
        planned_end: weekToDate(week, true),
        actual_start: null, actual_end: null, drift_days: 0,
        is_key_milestone: MILESTONE_IS_KEY[id] || false,
        key_milestone_label: MILESTONE_KEY_LABEL[id] || null,
        subtasks,
        // notes is typed as string[] in main/parser.ts. We stash exit-criteria
        // strings here verbatim so the milestone detail panel lists them as-is.
        notes: exitCriteria,
        dependencies: milestoneDeps,
        goal,
      }
    }).filter(Boolean)
    const totalSubtasks = milestones.reduce((n, m) => n + m.subtasks.length, 0)
    console.log('[parse-aci-roadmap] parsed ' + milestones.length + ' milestones, ' + totalSubtasks + ' tasks')
    const tracker = {
      ...existingTracker,
      milestones,
      submission_checklist: existingTracker.submission_checklist || { categories: [] },
      agents: existingTracker.agents || [],
      agent_log: existingTracker.agent_log || [],
      waitlist_tracker: existingTracker.waitlist_tracker || { signups_total: 0, signups_last_24h: 0, latest_signup_at: null },
      schedule: existingTracker.schedule,
      review_sessions: existingTracker.review_sessions || [],
      qa: existingTracker.qa || { groups: [], last_run_at: null },
      project: {
        ...(existingTracker.project || {}),
        ...parserValidation.projectMetadata,
      },
    }
    if (dryRun) {
      console.log('[parse-aci-roadmap] dry-run: NOT writing ' + outputPath + ' (' + basename(outputPath) + ')')
    } else {
      const writeResult = writeTrackerJsonWithBackup({
        targetPath: outputPath,
        tracker,
        label: 'parse-aci-roadmap',
      })

      if (!writeResult.changed) {
        console.log('[parse-aci-roadmap] tracker unchanged; skipped write')
      } else {
        if (writeResult.backupPath) {
          console.log('[parse-aci-roadmap] backup ' + writeResult.backupPath)
        }
        console.log('[parse-aci-roadmap] wrote ' + outputPath + ' (' + basename(outputPath) + ')')
      }
    }
    console.log('\nSUMMARY:')
    for (const m of milestones) {
      console.log('  ' + m.id.padEnd(40) + '  phase=' + m.phase.padEnd(22) + '  week=' + String(m.week).padStart(2) + '  tasks=' + m.subtasks.length)
    }
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
