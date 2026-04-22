/**
 * Context assembly for MCP tools.
 * Provides rich, structured context about tasks, milestones, and the project.
 */

import { join } from 'path'
import {
  DOCS_PATHS,
  TALKSTORE_ROOT,
  readFileSafe,
  type TrackerState,
  type Subtask,
  type Milestone,
} from './tracker.js'

// ─── Domain → Manifesto Section Mapping ─────────────────────────────────────

const DOMAIN_MANIFESTO_SECTIONS: Record<string, string[]> = {
  foundation: ['1) What Talkstore Is', '13) Tech Stack', '8) Product Principles'],
  storefront: ['1) What Talkstore Is', '7) The Product Model', '10) Core Workflows', '8) Product Principles'],
  product_ops: ['1) What Talkstore Is', '7) The Product Model', '10) Core Workflows', '8) Product Principles'],
  commerce_intel: ['1) What Talkstore Is', '7) The Product Model', '8) Product Principles'],
  launch_prep: ['1) What Talkstore Is', '12) Pricing + Packaging', '9) The Onboarding Scan', '8) Product Principles'],
  review_buffer: ['1) What Talkstore Is', '8) Product Principles'],
  v1_2: ['1) What Talkstore Is', '7) The Product Model', '8) Product Principles'],
  v1_5: ['1) What Talkstore Is', '7) The Product Model', '8) Product Principles'],
  distribution: ['1) What Talkstore Is', '6) Value Proposition'],
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractManifestoSections(content: string, sectionTitles: string[]): string {
  const lines = content.split('\n')
  const extracted: string[] = []

  for (const target of sectionTitles) {
    let capturing = false
    let sectionLines: string[] = []

    for (const line of lines) {
      const isHeader = /^# \d+\)/.test(line)
      if (isHeader && line.includes(target)) {
        capturing = true
        sectionLines = [line]
        continue
      }
      if (capturing && isHeader) break
      if (capturing) sectionLines.push(line)
    }

    if (sectionLines.length > 0) {
      extracted.push(sectionLines.join('\n').trim())
    }
  }

  return extracted.join('\n\n---\n\n')
}

function formatSubtaskStatus(s: Subtask): string {
  const icon = s.done ? '✅' : s.status === 'in_progress' ? '🔄' : s.status === 'blocked' ? '🚫' : '⬜'
  return `${icon} [${s.priority}] ${s.label} — ${s.status}${s.blocked_reason ? ' (' + s.blocked_reason + ')' : ''}`
}

// ─── Public Context Builders ────────────────────────────────────────────────

export function buildTaskContext(
  state: TrackerState,
  subtask: Subtask,
  milestone: Milestone,
  options: { includeManifesto?: boolean; includeBuilderPrompt?: boolean } = {}
): string {
  const sections: string[] = []

  // ── Task details ──
  sections.push(`# Task: ${subtask.label}`)
  sections.push(`- **ID:** ${subtask.id}`)
  sections.push(`- **Status:** ${subtask.status}`)
  sections.push(`- **Priority:** ${subtask.priority}`)
  sections.push(`- **Execution mode:** ${subtask.execution_mode}`)
  if (subtask.assignee) sections.push(`- **Assignee:** ${subtask.assignee}`)
  if (subtask.notes) sections.push(`- **Notes:** ${subtask.notes}`)
  if (subtask.blocked_reason) sections.push(`- **Blocked:** ${subtask.blocked_reason}`)

  if (subtask.acceptance_criteria.length > 0) {
    sections.push('\n## Acceptance Criteria')
    for (const c of subtask.acceptance_criteria) {
      sections.push(`- [ ] ${c}`)
    }
  }

  if (subtask.constraints.length > 0) {
    sections.push('\n## Constraints')
    for (const c of subtask.constraints) {
      sections.push(`- ${c}`)
    }
  }

  if (subtask.context_files.length > 0) {
    sections.push('\n## Context Files (read these first)')
    for (const f of subtask.context_files) {
      sections.push(`- \`${f}\``)
    }
  }

  if (subtask.reference_docs.length > 0) {
    sections.push('\n## Reference Docs')
    for (const f of subtask.reference_docs) {
      sections.push(`- ${f}`)
    }
  }

  // ── Revision history (from agent_log) ──
  const revisions = state.agent_log.filter(
    (e) => e.target_id === subtask.id && e.action === 'revision_requested'
  )
  if (revisions.length > 0) {
    sections.push(`\n## Revision History (${revisions.length} revision${revisions.length > 1 ? 's' : ''})`)
    sections.push('**IMPORTANT: Address ALL prior revision feedback before resubmitting.**\n')
    for (const rev of revisions) {
      const date = new Date(rev.timestamp).toLocaleDateString()
      sections.push(`### ${rev.description}`)
      sections.push(`*${date}*\n`)
    }
  }

  // ── Builder prompt file ──
  if (options.includeBuilderPrompt !== false) {
    if (subtask.builder_prompt) {
      const promptContent = readFileSafe(join(TALKSTORE_ROOT, subtask.builder_prompt))
      if (promptContent) {
        sections.push('\n# Task Prompt')
        sections.push(promptContent)
      } else {
        sections.push('\n# Task Prompt')
        sections.push(`*Warning: builder_prompt path "${subtask.builder_prompt}" not found.*`)
      }
    }
  }

  // ── Milestone context ──
  sections.push(`\n# Milestone: ${milestone.title}`)
  sections.push(`- **Domain:** ${milestone.domain}`)
  sections.push(`- **Phase:** ${milestone.phase}`)
  sections.push(`- **Week:** ${milestone.week}`)
  sections.push(`- **Planned:** ${milestone.planned_start} → ${milestone.planned_end}`)
  if (milestone.drift_days !== 0) {
    sections.push(`- **Drift:** ${milestone.drift_days > 0 ? '+' : ''}${milestone.drift_days} days`)
  }

  // Exit criteria
  if (milestone.notes.length > 0) {
    sections.push('\n## Exit Criteria')
    for (const n of milestone.notes) {
      sections.push(`- ${n}`)
    }
  }

  // Sibling tasks
  const siblings = milestone.subtasks.filter((s) => s.id !== subtask.id)
  if (siblings.length > 0) {
    const done = siblings.filter((s) => s.done).length
    const inProgress = siblings.filter((s) => s.status === 'in_progress').length
    const blocked = siblings.filter((s) => s.status === 'blocked').length
    sections.push(`\n## Sibling Tasks (${done}/${siblings.length} done, ${inProgress} in progress, ${blocked} blocked)`)
    for (const s of siblings) {
      sections.push(`  ${formatSubtaskStatus(s)}`)
    }
  }

  // Dependencies
  if (milestone.dependencies.length > 0) {
    sections.push('\n## Upstream Dependencies')
    for (const depId of milestone.dependencies) {
      const dep = state.milestones.find((m) => m.id === depId)
      if (dep) {
        const depDone = dep.subtasks.filter((s) => s.done).length
        const depTotal = dep.subtasks.length
        const pct = depTotal > 0 ? Math.round((depDone / depTotal) * 100) : 0
        sections.push(`- ${dep.title} (Week ${dep.week}) — ${depDone}/${depTotal} done (${pct}%)`)
      }
    }
  }

  const downstream = state.milestones.filter((m) => m.dependencies.includes(milestone.id))
  if (downstream.length > 0) {
    sections.push('\n## Downstream (depends on this milestone)')
    for (const d of downstream) {
      sections.push(`- ${d.title} (Week ${d.week})`)
    }
  }

  // ── Product context (domain-specific manifesto sections) ──
  if (options.includeManifesto !== false) {
    const manifesto = readFileSafe(DOCS_PATHS.manifesto)
    if (manifesto) {
      const sectionTitles = DOMAIN_MANIFESTO_SECTIONS[milestone.domain] || DOMAIN_MANIFESTO_SECTIONS['foundation']
      const extracted = extractManifestoSections(manifesto, sectionTitles)
      if (extracted) {
        sections.push('\n# Product Context (manifesto.md)')
        sections.push(extracted)
      }
    }
  }

  return sections.join('\n')
}

export function buildProjectStatus(state: TrackerState): string {
  const total = state.milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const done = state.milestones.reduce((s, m) => s + m.subtasks.filter((t) => t.done).length, 0)
  const inProgress = state.milestones.reduce((s, m) => s + m.subtasks.filter((t) => t.status === 'in_progress').length, 0)
  const blocked = state.milestones.reduce((s, m) => s + m.subtasks.filter((t) => t.status === 'blocked').length, 0)

  const lines: string[] = []
  lines.push(`# Project: ${state.project.name}`)
  lines.push(`- **Start:** ${state.project.start_date}`)
  lines.push(`- **Target submit:** ${state.project.target_submit_date}`)
  lines.push(`- **Current week:** ${state.project.current_week}`)
  lines.push(`- **Schedule:** ${state.project.schedule_status.replace('_', ' ')}`)
  lines.push(`- **Progress:** ${done}/${total} tasks done (${Math.round((done / total) * 100)}%)`)
  lines.push(`- **In progress:** ${inProgress}`)
  lines.push(`- **Blocked:** ${blocked}`)
  lines.push(`- **Milestones:** ${state.milestones.length}`)

  // Current phase
  const phase = state.schedule.phases.find(
    (p) => state.project.current_week >= p.start_week && state.project.current_week <= p.end_week
  )
  if (phase) {
    lines.push(`- **Current phase:** ${phase.title} (weeks ${phase.start_week}–${phase.end_week})`)
  }

  return lines.join('\n')
}

export function buildMilestoneOverview(milestone: Milestone, state: TrackerState): string {
  const done = milestone.subtasks.filter((s) => s.done).length
  const total = milestone.subtasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const lines: string[] = []
  lines.push(`# Milestone: ${milestone.title}`)
  lines.push(`- **ID:** ${milestone.id}`)
  lines.push(`- **Domain:** ${milestone.domain}`)
  lines.push(`- **Phase:** ${milestone.phase}`)
  lines.push(`- **Week:** ${milestone.week}`)
  lines.push(`- **Planned:** ${milestone.planned_start} → ${milestone.planned_end}`)
  lines.push(`- **Progress:** ${done}/${total} (${pct}%)`)
  if (milestone.drift_days !== 0) {
    lines.push(`- **Drift:** ${milestone.drift_days > 0 ? '+' : ''}${milestone.drift_days} days`)
  }
  if (milestone.is_key_milestone) {
    lines.push(`- **Key milestone:** ${milestone.key_milestone_label}`)
  }

  if (milestone.notes.length > 0) {
    lines.push('\n## Exit Criteria')
    for (const n of milestone.notes) lines.push(`- ${n}`)
  }

  lines.push('\n## Tasks')
  for (const s of milestone.subtasks) {
    lines.push(`  ${formatSubtaskStatus(s)}`)
  }

  // Dependencies
  if (milestone.dependencies.length > 0) {
    lines.push('\n## Dependencies')
    for (const depId of milestone.dependencies) {
      const dep = state.milestones.find((m) => m.id === depId)
      if (dep) {
        const depDone = dep.subtasks.filter((s) => s.done).length
        lines.push(`- ${dep.title} — ${depDone}/${dep.subtasks.length} done`)
      }
    }
  }

  return lines.join('\n')
}

export function buildTaskSummary(
  state: TrackerState,
  subtask: Subtask,
  milestone: Milestone
): string {
  const sections: string[] = []

  sections.push(`# Task: ${subtask.label}`)
  sections.push(`- **ID:** ${subtask.id}`)
  sections.push(`- **Status:** ${subtask.status}`)
  sections.push(`- **Domain:** ${milestone.domain}`)

  if (subtask.acceptance_criteria.length > 0) {
    sections.push('\n## Acceptance Criteria')
    for (const c of subtask.acceptance_criteria) {
      sections.push(`- [ ] ${c}`)
    }
  }

  if (subtask.constraints.length > 0) {
    sections.push('\n## Constraints')
    for (const c of subtask.constraints) {
      sections.push(`- ${c}`)
    }
  }

  if (subtask.context_files.length > 0) {
    sections.push('\n## Context Files')
    for (const f of subtask.context_files) {
      sections.push(`- \`${f}\``)
    }
  }

  // Revision history — auditor must know about prior feedback
  const revisions = state.agent_log.filter(
    (e) => e.target_id === subtask.id && e.action === 'revision_requested'
  )
  if (revisions.length > 0) {
    sections.push(`\n## Revision History (${revisions.length})`)
    for (const rev of revisions) {
      sections.push(`- ${rev.description}`)
    }
  }

  return sections.join('\n')
}

export function buildChecklistStatus(
  state: TrackerState,
  filter: 'all' | 'incomplete' = 'incomplete'
): string {
  const lines: string[] = []
  lines.push('# Submission Checklist')

  for (const cat of state.submission_checklist.categories) {
    const items = filter === 'incomplete'
      ? cat.items.filter((i) => !i.done)
      : cat.items

    if (items.length === 0) continue

    const done = cat.items.filter((i) => i.done).length
    const total = cat.items.length
    const risk = cat.risk_level === 'critical' ? ' ⚠️ CRITICAL' : ''
    lines.push(`\n## ${cat.title}${risk} (${done}/${total})`)
    for (const item of items) {
      lines.push(`- [${item.done ? 'x' : ' '}] ${item.label}`)
    }
  }

  return lines.join('\n')
}
