#!/usr/bin/env node

/**
 * Apply Track A analysis → tracker.
 *
 * Reads /tmp/analysis/m{1..10}.json, validates against current tracker, merges
 * four fields onto every subtask: depends_on[], parallel_priority (int),
 * execution_mode (agent|pair|human), execution_mode_reasoning.
 *
 * Task waves are RECOMPUTED via topological sort from depends_on (authoritative),
 * overriding sub-agent wave numbers where they contradict the dependency graph.
 *
 * Also flips status to 'blocked' with blocked_by + blocked_reason for any task
 * with unfinished deps. Tasks with zero unfinished deps stay 'todo'.
 *
 * Usage: node scripts/apply-dependency-analysis.mjs [--dry-run]
 */

import { readFileSync, existsSync } from 'fs'
import { resolveTrackerProjectPaths } from './lib/project-paths.mjs'
import { validateExistingTrackerProfile } from './lib/profile-validators.mjs'
import { writeTrackerJsonWithBackup } from './lib/tracker-backup.mjs'

const PROJECT_PATHS = resolveTrackerProjectPaths()
const TRACKER_PATH = PROJECT_PATHS.trackerPath
const ANALYSIS_DIR = PROJECT_PATHS.analysisDir

const MILESTONE_IDS = [
  'm1_purge_and_foundation_reset',
  'm2_multi_llm_and_async_infra',
  'm3_scoring_engine',
  'm4_catalog_intelligence_engine',
  'm5_autopilot_and_guard',
  'm6_attribution_pipeline',
  'm7_merchant_surfaces',
  'm8_ux_polish_and_marketing',
  'm9_quality_security_compliance',
  'm10_launch_and_post_launch',
]
const MILESTONE_SHORT_TO_FULL = Object.fromEntries(
  MILESTONE_IDS.map((id, i) => [`m${i + 1}`, id])
)

function loadTracker() {
  try {
    return JSON.parse(readFileSync(TRACKER_PATH, 'utf8'))
  } catch (error) {
    throw new Error(
      `Existing tracker is not valid JSON at ${TRACKER_PATH}: ` +
      `${error instanceof Error ? error.message : String(error)}`
    )
  }
}
function loadAnalysis(n) {
  const path = `${ANALYSIS_DIR}/m${n}.json`
  if (!existsSync(path)) throw new Error(`missing analysis: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function buildTaskIdSet(tracker) {
  const s = new Set()
  for (const m of tracker.milestones) for (const t of m.subtasks) s.add(t.id)
  return s
}

function normalizeDepId(raw, taskIdSet) {
  if (!raw || typeof raw !== 'string') return null
  const cleaned = raw.replace(/\([^)]*\)/g, '').trim().toLowerCase()
  if (!cleaned) return null
  if (/^m\d+$/.test(cleaned)) {
    return MILESTONE_SHORT_TO_FULL[cleaned] || null
  }
  if (MILESTONE_IDS.includes(cleaned)) return cleaned
  const prefixMatch = /^(m\d+)_/.exec(cleaned)
  if (prefixMatch) {
    const full = MILESTONE_SHORT_TO_FULL[prefixMatch[1]]
    if (full) return full
  }
  if (/^t\d+\.\d+$/.test(cleaned)) {
    return taskIdSet.has(cleaned) ? cleaned : null
  }
  return null
}

function isMilestoneDone(milestoneId, tracker) {
  const m = tracker.milestones.find((x) => x.id === milestoneId)
  if (!m) return false
  return m.subtasks.length > 0 && m.subtasks.every((t) => t.status === 'done' || t.done === true)
}

function isTaskDone(taskId, tracker) {
  for (const m of tracker.milestones) {
    for (const t of m.subtasks) {
      if (t.id === taskId) return t.status === 'done' || t.done === true
    }
  }
  return false
}

function recomputeWaves(tracker, analysisByTaskId) {
  const fixes = []
  for (const m of tracker.milestones) {
    const taskIds = new Set(m.subtasks.map((t) => t.id))
    const waveById = new Map()
    const pending = new Set(m.subtasks.map((t) => t.id))
    let iterations = 0
    const maxIter = m.subtasks.length + 5
    while (pending.size > 0 && iterations < maxIter) {
      iterations++
      let progress = false
      for (const tid of Array.from(pending)) {
        const a = analysisByTaskId.get(tid)
        if (!a) { pending.delete(tid); continue }
        const inMilestoneDeps = (a._normalized_depends_on || []).filter((d) => taskIds.has(d))
        const unresolved = inMilestoneDeps.filter((d) => !waveById.has(d))
        if (unresolved.length === 0) {
          const maxDepWave = inMilestoneDeps.length === 0
            ? 0
            : Math.max(...inMilestoneDeps.map((d) => waveById.get(d)))
          const newWave = maxDepWave + 1
          if (newWave !== a.parallel_priority) {
            fixes.push(`${tid}: wave ${a.parallel_priority} → ${newWave}`)
          }
          waveById.set(tid, newWave)
          a.parallel_priority = newWave
          pending.delete(tid)
          progress = true
        }
      }
      if (!progress) break
    }
    if (pending.size > 0) {
      fixes.push(`CYCLE in ${m.id}: ${Array.from(pending).join(', ')}`)
    }
  }
  return fixes
}

function main() {
  try {
    const dryRun = process.argv.includes('--dry-run')
    const tracker = loadTracker()
    validateExistingTrackerProfile({
      expectedProfile: 'aci',
      existingProject: tracker.project || null,
      operationLabel: 'apply-dependency-analysis',
    })
    const taskIdSet = buildTaskIdSet(tracker)
    const analysisByTaskId = new Map()
    const milestoneTaskCounts = new Map()

    for (let i = 1; i <= 10; i++) {
      const a = loadAnalysis(i)
      if (!MILESTONE_IDS.includes(a.milestone_id)) {
        throw new Error(`m${i}.json has unexpected milestone_id=${a.milestone_id}`)
      }
      milestoneTaskCounts.set(a.milestone_id, (a.tasks || []).length)
      for (const t of a.tasks || []) {
        if (analysisByTaskId.has(t.id)) throw new Error(`duplicate analysis for ${t.id}`)
        analysisByTaskId.set(t.id, t)
      }
    }

    console.log('─── Per-milestone analysis task counts ───')
    for (const id of MILESTONE_IDS) {
      const n = milestoneTaskCounts.get(id) || 0
      const m = tracker.milestones.find((x) => x.id === id)
      const trackerCount = m ? m.subtasks.length : 0
      const marker = n === trackerCount ? '✓' : '✗'
      console.log(`  ${marker} ${id.padEnd(40)}  analysis=${String(n).padStart(3)}  tracker=${String(trackerCount).padStart(3)}`)
      if (n !== trackerCount) throw new Error(`count mismatch for ${id}`)
    }

    // Normalize depends_on. Track unresolved.
    const unresolved = []
    for (const m of tracker.milestones) {
      for (const t of m.subtasks) {
        const a = analysisByTaskId.get(t.id)
        if (!a) { unresolved.push(`no analysis for ${t.id}`); continue }
        const validDeps = []
        for (const dep of a.depends_on || []) {
          const norm = normalizeDepId(dep, taskIdSet)
          if (!norm) unresolved.push(`${t.id}: unresolvable "${dep}"`)
          else validDeps.push(norm)
        }
        a._normalized_depends_on = Array.from(new Set(validDeps))
        if (!['agent', 'pair', 'human'].includes(a.execution_mode)) {
          unresolved.push(`${t.id}: invalid execution_mode=${a.execution_mode}`)
        }
      }
    }

    if (unresolved.length) {
      console.log('\n── Validation issues (will NOT block; unresolved deps dropped) ──')
      for (const u of unresolved) console.log(`  ⚠ ${u}`)
    }

    // Recompute waves from depends_on.
    const waveFixes = recomputeWaves(tracker, analysisByTaskId)
    if (waveFixes.length) {
      console.log(`\n── Wave corrections (${waveFixes.length}) ──`)
      for (const f of waveFixes.slice(0, 12)) console.log(`  ↺ ${f}`)
      if (waveFixes.length > 12) console.log(`  ... and ${waveFixes.length - 12} more`)
    } else {
      console.log('\n── Waves: no corrections needed (sub-agent numbering consistent with graph) ──')
    }

    // Apply.
    let modifiedCount = 0, blockedCount = 0, todoCount = 0
    for (const m of tracker.milestones) {
      for (const t of m.subtasks) {
        const a = analysisByTaskId.get(t.id)
        if (!a) continue
        t.depends_on = a._normalized_depends_on
        t.parallel_priority = a.parallel_priority
        t.priority = String(a.parallel_priority)
        t.execution_mode = a.execution_mode
        t.execution_mode_reasoning = a.execution_mode_reasoning || ''
        const unfinishedDeps = []
        for (const dep of t.depends_on) {
          if (MILESTONE_IDS.includes(dep)) {
            if (!isMilestoneDone(dep, tracker)) unfinishedDeps.push(dep)
          } else {
            if (!isTaskDone(dep, tracker)) unfinishedDeps.push(dep)
          }
        }
        const preservedStatus = ['done', 'in_progress', 'review']
        if (preservedStatus.includes(t.status)) {
          // don't touch
        } else if (unfinishedDeps.length) {
          t.status = 'blocked'
          t.blocked_by = unfinishedDeps
          t.blocked_reason = `Waiting on: ${unfinishedDeps.join(', ')}`
          blockedCount++
        } else {
          t.status = 'todo'
          t.blocked_by = null
          t.blocked_reason = null
          todoCount++
        }
        t.notes = `Complexity: ${t.complexity || 'unspecified'} | Wave: ${t.parallel_priority} | Mode: ${t.execution_mode}${
          t.depends_on.length ? ' | Depends on: ' + t.depends_on.join(', ') : ''
        }`
        modifiedCount++
      }
    }

    console.log('\n─── Application summary ───')
    console.log(`  Tasks modified:  ${modifiedCount}`)
    console.log(`  Tasks in Todo:   ${todoCount}`)
    console.log(`  Tasks Blocked:   ${blockedCount}`)

    const em = {}
    for (const m of tracker.milestones) {
      for (const t of m.subtasks) em[t.execution_mode] = (em[t.execution_mode] || 0) + 1
    }
    console.log(`  Execution modes: ${Object.entries(em).map(([k, v]) => `${k}=${v}`).join(', ')}`)

    // Max wave per milestone post-recomputation.
    console.log('\n─── Max wave per milestone (after topological recompute) ───')
    for (const id of MILESTONE_IDS) {
      const m = tracker.milestones.find((x) => x.id === id)
      const maxW = m.subtasks.reduce((n, t) => Math.max(n, t.parallel_priority || 0), 0)
      const w1 = m.subtasks.filter((t) => t.parallel_priority === 1).length
      console.log(`  ${id.padEnd(40)} max_wave=${String(maxW).padStart(2)}  wave_1_count=${w1}`)
    }

    const writeResult = writeTrackerJsonWithBackup({
      targetPath: TRACKER_PATH,
      tracker,
      dryRun,
      label: 'apply-dependency-analysis',
    })

    if (!writeResult.changed) {
      console.log('\n[write] Tracker unchanged; skipped write')
      return
    }

    if (dryRun) {
      console.log('\n[dry-run] NOT writing tracker')
      return
    }

    if (writeResult.backupPath) {
      console.log(`\n[backup] ${writeResult.backupPath}`)
    }
    console.log(`[write] Wrote tracker to ${TRACKER_PATH}`)
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
