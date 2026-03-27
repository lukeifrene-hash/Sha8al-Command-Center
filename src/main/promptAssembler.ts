/**
 * Prompt Assembler — Agentic Task Board
 *
 * Assembles agent-type-aware prompts for dispatch:
 *   Layer 1: Project context (CLAUDE.md, manifesto.md) — filtered by agent type
 *   Layer 2: Milestone context (siblings, dependencies, drift) — smart filtered
 *   Layer 3: Codebase scan (placeholder for MVP)
 *
 * Agent profiles control prompt shape:
 *   Explorer → minimal context, investigation framing
 *   Planner  → full context, architecture framing
 *   Builder  → conventions + principles, implementation framing
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { TALKSTORE_ROOT, TRACKER_PATH } from './config'
import type { TrackerState, Subtask, Milestone, PipelineStepName } from './parser'

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentTarget = 'explorer' | 'planner' | 'builder'

export interface AssembledPrompt {
  fullText: string
  layerSummary: {
    layer1Sources: string[]
    layer1Chars: number
    layer2MilestoneId: string
    layer2Chars: number
    layer3Status: 'placeholder' | 'scanned'
    layer3Chars: number
    taskSectionChars: number
    totalChars: number
    budgetChars: number
    trimmed: boolean
  }
  agentProfile: AgentTarget | 'generic'
  assembledAt: string
}

// ─── Agent Profiles ──────────────────────────────────────────────────────────

interface AgentProfile {
  preamble: string
  includeConventions: boolean
  manifestoDepth: 'none' | 'minimal' | 'full'
  siblingDetail: 'summary' | 'relevant' | 'full'
  includeExitCriteria: boolean
  includeDependencies: boolean
  taskHeading: string
  taskFraming: 'investigate' | 'design' | 'implement'
}

const AGENT_PROFILES: Record<AgentTarget, AgentProfile> = {
  explorer: {
    preamble:
      'You are an expert codebase investigator. Your job is to thoroughly explore the codebase and gather all information needed to implement a task.\n' +
      'Read files, trace imports, understand data flow, and identify existing patterns that should be reused.\n' +
      'Search the web for relevant documentation, API references, and best practices when the task involves external libraries or services.\n\n' +
      'Produce a STRUCTURED REPORT with these sections:\n' +
      '1. **Key Findings** — what you discovered about the codebase relevant to this task\n' +
      '2. **Relevant Files** — each file path and its role (what it does, why it matters)\n' +
      '3. **Existing Patterns** — code patterns, utilities, or abstractions to follow/reuse\n' +
      '4. **Dependencies & Risks** — upstream/downstream impacts, potential blockers\n' +
      '5. **Recommended Approach** — concrete suggestions for implementation\n' +
      '6. **External References** — any API docs, library docs, or best practices found online',
    includeConventions: true,
    manifestoDepth: 'minimal',
    siblingDetail: 'full',
    includeExitCriteria: true,
    includeDependencies: true,
    taskHeading: 'INVESTIGATION BRIEF',
    taskFraming: 'investigate',
  },
  planner: {
    preamble:
      'You are an architecture planner. Your job is to design the implementation approach and produce a detailed, actionable plan.\nConsider trade-offs, dependencies, and risks. Output a step-by-step plan with file paths and rationale.',
    includeConventions: true,
    manifestoDepth: 'full',
    siblingDetail: 'full',
    includeExitCriteria: true,
    includeDependencies: true,
    taskHeading: 'PLANNING OBJECTIVE',
    taskFraming: 'design',
  },
  builder: {
    preamble:
      'You are an implementation agent. Your job is to write production-quality code that meets the acceptance criteria.\nFollow project conventions. Keep changes minimal and focused.',
    includeConventions: true,
    manifestoDepth: 'minimal',
    siblingDetail: 'relevant',
    includeExitCriteria: true,
    includeDependencies: true,
    taskHeading: 'YOUR TASK',
    taskFraming: 'implement',
  },
}

const DEFAULT_PROFILE: AgentProfile = {
  preamble: '',
  includeConventions: true,
  manifestoDepth: 'full',
  siblingDetail: 'full',
  includeExitCriteria: true,
  includeDependencies: true,
  taskHeading: 'YOUR TASK',
  taskFraming: 'implement',
}

// ─── Character Budget ────────────────────────────────────────────────────────

const CHAR_BUDGET = 100_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function findSubtaskAndMilestone(
  state: TrackerState,
  subtaskId: string
): { subtask: Subtask; milestone: Milestone } | null {
  for (const milestone of state.milestones) {
    const subtask = milestone.subtasks.find((s) => s.id === subtaskId)
    if (subtask) return { subtask, milestone }
  }
  return null
}

// ─── Layer 1: Project Context ────────────────────────────────────────────────

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

const MINIMAL_MANIFESTO_SECTIONS = ['8) Product Principles']

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

      if (capturing && isHeader) {
        break
      }

      if (capturing) {
        sectionLines.push(line)
      }
    }

    if (sectionLines.length > 0) {
      extracted.push(sectionLines.join('\n').trim())
    }
  }

  return extracted.join('\n\n---\n\n')
}

function extractClaudeMdSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = content.split('\n')
  let currentHeader = ''
  let currentLines: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^#+\s+(.+)/)
    if (headerMatch) {
      if (currentHeader && currentLines.length > 0) {
        sections[currentHeader.toLowerCase()] = currentLines.join('\n').trim()
      }
      currentHeader = headerMatch[1]
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }
  if (currentHeader && currentLines.length > 0) {
    sections[currentHeader.toLowerCase()] = currentLines.join('\n').trim()
  }

  return sections
}

function loadLayer1(
  domain: string,
  profile: AgentProfile
): { text: string; sources: string[] } {
  const sources: string[] = []
  const sections: string[] = []

  // 1. CLAUDE.md — filtered by agent profile
  if (profile.includeConventions) {
    const claudeMd = readFileSafe(join(TALKSTORE_ROOT, 'CLAUDE.md'))
    if (claudeMd) {
      if (claudeMd.length < 500) {
        // Short file — include in full
        sources.push('CLAUDE.md (full)')
        sections.push(`### Project Conventions (CLAUDE.md)\n\n${claudeMd}`)
      } else {
        // Extract relevant sections based on profile
        const parsed = extractClaudeMdSections(claudeMd)
        const relevantKeys = Object.keys(parsed)
        if (relevantKeys.length > 0) {
          const filtered = relevantKeys
            .map((k) => parsed[k])
            .join('\n\n')
          sources.push(`CLAUDE.md (${relevantKeys.length} sections)`)
          sections.push(`### Project Conventions (CLAUDE.md)\n\n${filtered}`)
        }
      }
    }
  }

  // 2. manifesto.md — depth controlled by agent profile
  if (profile.manifestoDepth !== 'none') {
    const manifesto = readFileSafe(join(TALKSTORE_ROOT, 'docs/manifesto.md'))
    if (manifesto) {
      const sectionTitles =
        profile.manifestoDepth === 'minimal'
          ? MINIMAL_MANIFESTO_SECTIONS
          : DOMAIN_MANIFESTO_SECTIONS[domain] || DOMAIN_MANIFESTO_SECTIONS['foundation']

      const extracted = extractManifestoSections(manifesto, sectionTitles)
      if (extracted) {
        sources.push(`manifesto.md (${sectionTitles.length} section${sectionTitles.length > 1 ? 's' : ''})`)
        sections.push(`### Product Context (manifesto.md)\n\n${extracted}`)
      }
    }
  }

  return { text: sections.join('\n\n---\n\n'), sources }
}

// ─── Layer 2: Milestone Context ──────────────────────────────────────────────

function formatSubtaskStatus(s: Subtask): string {
  const icon = s.done ? '✅' : s.status === 'in_progress' ? '🔄' : s.status === 'blocked' ? '🚫' : '⬜'
  return `${icon} ${s.label} [${s.status}]`
}

function buildSiblingsSummary(milestone: Milestone, currentId: string): string {
  const others = milestone.subtasks.filter((s) => s.id !== currentId)
  const done = others.filter((s) => s.done).length
  const inProgress = others.filter((s) => s.status === 'in_progress').length
  const blocked = others.filter((s) => s.status === 'blocked').length
  const todo = others.filter((s) => s.status === 'todo').length
  const total = others.length
  return `Milestone progress: ${done}/${total} done, ${inProgress} in progress, ${blocked} blocked, ${todo} to do`
}

function filterSiblings(
  milestone: Milestone,
  currentId: string,
  detail: AgentProfile['siblingDetail']
): { lines: string[]; summary: string } {
  const summary = buildSiblingsSummary(milestone, currentId)
  const others = milestone.subtasks.filter((s) => s.id !== currentId)

  if (detail === 'summary') {
    return { lines: [summary], summary }
  }

  let included: Subtask[]

  if (detail === 'relevant') {
    // Builder: only in-progress + blocked (things that could conflict or get unblocked)
    included = others.filter((s) => s.status === 'in_progress' || s.status === 'blocked')
  } else {
    // Planner: all siblings, capped at 8 most relevant
    const prioritized = [
      ...others.filter((s) => s.status === 'in_progress'),
      ...others.filter((s) => s.status === 'blocked'),
      ...others.filter((s) => s.status === 'todo'),
      ...others.filter((s) => s.done),
    ]
    included = prioritized.slice(0, 8)
  }

  const lines: string[] = [summary]
  if (included.length > 0) {
    lines.push('')
    for (const s of included) {
      lines.push(`  ${formatSubtaskStatus(s)}${s.blocked_reason ? ' — ' + s.blocked_reason : ''}`)
    }
  }

  return { lines, summary }
}

function loadLayer2(
  state: TrackerState,
  milestone: Milestone,
  subtask: Subtask,
  profile: AgentProfile
): string {
  const lines: string[] = []

  // Milestone overview (always included, it's compact)
  lines.push(`### Milestone: ${milestone.title}`)
  lines.push(`- **Domain:** ${milestone.domain}`)
  lines.push(`- **Phase:** ${milestone.phase}`)
  lines.push(`- **Week:** ${milestone.week}`)
  lines.push(`- **Planned:** ${milestone.planned_start} → ${milestone.planned_end}`)
  if (milestone.drift_days !== 0) {
    lines.push(`- **Drift:** ${milestone.drift_days > 0 ? '+' : ''}${milestone.drift_days} days (${milestone.drift_days > 0 ? 'behind' : 'ahead'})`)
  } else {
    lines.push(`- **Status:** On track`)
  }

  // Exit criteria — skip for explorers
  if (profile.includeExitCriteria && milestone.notes.length > 0) {
    lines.push('')
    lines.push('### Exit Criteria')
    for (const note of milestone.notes) {
      lines.push(`- ${note}`)
    }
  }

  // Dependencies — skip for explorers
  if (profile.includeDependencies) {
    if (milestone.dependencies.length > 0) {
      lines.push('')
      lines.push('### Upstream Dependencies')
      for (const depId of milestone.dependencies) {
        const dep = state.milestones.find((m) => m.id === depId)
        if (dep) {
          const done = dep.subtasks.filter((s) => s.done).length
          const total = dep.subtasks.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          lines.push(`- ${dep.title} (Week ${dep.week}) — ${done}/${total} done (${pct}%)`)
        }
      }
    }

    const downstream = state.milestones.filter((m) => m.dependencies.includes(milestone.id))
    if (downstream.length > 0) {
      lines.push('')
      lines.push('### Downstream (depends on this milestone)')
      for (const dep of downstream) {
        lines.push(`- ${dep.title} (Week ${dep.week})`)
      }
    }
  }

  // Siblings — filtered by profile
  lines.push('')
  lines.push('### Sibling Tasks')
  const { lines: siblingLines } = filterSiblings(milestone, subtask.id, profile.siblingDetail)
  lines.push(...siblingLines)

  return lines.join('\n')
}

// ─── Layer 3: Codebase Scan (placeholder) ────────────────────────────────────

function loadLayer3(subtask: Subtask): string {
  const lines: string[] = []

  if (subtask.context_files.length > 0) {
    lines.push('**Read these files before starting:**')
    for (const f of subtask.context_files) {
      lines.push(`- \`${f}\``)
    }
  }

  if (subtask.reference_docs.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push('**Reference docs:**')
    for (const f of subtask.reference_docs) {
      lines.push(`- ${f}`)
    }
  }

  if (lines.length === 0) {
    lines.push('No context files or reference docs specified.')
  }

  return lines.join('\n')
}

// ─── Task Section ────────────────────────────────────────────────────────────

function generateFallbackPrompt(
  subtask: Subtask,
  milestone: Milestone,
  framing: AgentProfile['taskFraming']
): string {
  const lines: string[] = []

  const verb =
    framing === 'investigate'
      ? 'Investigate and report on'
      : framing === 'design'
        ? 'Design the implementation approach for'
        : 'Implement'

  lines.push(`## Objective`)
  lines.push(`${verb}: **${subtask.label}**`)
  lines.push('')
  lines.push(`Domain: ${milestone.domain} | Phase: ${milestone.phase} | Week ${milestone.week}`)

  if (subtask.context_files.length > 0) {
    lines.push('')
    lines.push(`Start by reading: ${subtask.context_files.map((f) => '`' + f + '`').join(', ')}`)
  }

  return lines.join('\n')
}

function buildTaskSection(
  subtask: Subtask,
  milestone: Milestone,
  profile: AgentProfile
): string {
  const lines: string[] = []

  // Main instruction — use override or generate from metadata
  const instruction = subtask.prompt || generateFallbackPrompt(subtask, milestone, profile.taskFraming)
  lines.push(instruction)

  // Acceptance criteria
  if (subtask.acceptance_criteria.length > 0) {
    lines.push('')
    lines.push('### Acceptance Criteria')
    for (const c of subtask.acceptance_criteria) {
      lines.push(`- [ ] ${c}`)
    }
  }

  // Constraints
  if (subtask.constraints.length > 0) {
    lines.push('')
    lines.push('### Constraints')
    for (const c of subtask.constraints) {
      lines.push(`- ${c}`)
    }
  }

  return lines.join('\n')
}

// ─── Prior Output Injection ──────────────────────────────────────────────────

const PRIOR_OUTPUT_MAX_CHARS = 50_000

function buildPriorOutput(subtask: Subtask, pipelineStep: PipelineStepName): string {
  const pipeline = subtask.pipeline
  if (!pipeline) return ''

  const sections: string[] = []

  if (pipelineStep === 'planner') {
    const explorerOut = pipeline.steps.explorer
    if (explorerOut?.status === 'complete' && explorerOut.output) {
      const output = explorerOut.output.length > PRIOR_OUTPUT_MAX_CHARS
        ? explorerOut.output.slice(0, PRIOR_OUTPUT_MAX_CHARS) + '\n\n[...truncated to 4,000 chars]'
        : explorerOut.output
      sections.push(`## Exploration Findings\n\n${output}`)
    }
  }

  if (pipelineStep === 'builder') {
    // Prefer planner output; fall back to explorer if planner was skipped
    const plannerOut = pipeline.steps.planner
    const explorerOut = pipeline.steps.explorer

    if (plannerOut?.status === 'complete' && plannerOut.output) {
      const output = plannerOut.output.length > PRIOR_OUTPUT_MAX_CHARS
        ? plannerOut.output.slice(0, PRIOR_OUTPUT_MAX_CHARS) + '\n\n[...truncated to 4,000 chars]'
        : plannerOut.output
      sections.push(`## Implementation Plan\n\n${output}`)
    } else if (explorerOut?.status === 'complete' && explorerOut.output) {
      const output = explorerOut.output.length > PRIOR_OUTPUT_MAX_CHARS
        ? explorerOut.output.slice(0, PRIOR_OUTPUT_MAX_CHARS) + '\n\n[...truncated to 4,000 chars]'
        : explorerOut.output
      sections.push(`## Exploration Findings\n\n${output}`)
    }
  }

  return sections.join('\n\n')
}

// ─── Budget Trimming ─────────────────────────────────────────────────────────

function trimToBudget(sections: {
  preamble: string
  layer1: string
  layer2: string
  layer3: string
  priorOutput: string
  task: string
}): { preamble: string; layer1: string; layer2: string; layer3: string; priorOutput: string; task: string; trimmed: boolean } {
  const total = () =>
    sections.preamble.length + sections.layer1.length + sections.layer2.length +
    sections.layer3.length + sections.priorOutput.length + sections.task.length

  if (total() <= CHAR_BUDGET) {
    return { ...sections, trimmed: false }
  }

  const result = { ...sections, trimmed: true }

  // Trim Layer 3 first (lowest priority)
  if (total() > CHAR_BUDGET && result.layer3.length > 200) {
    const l3Lines = result.layer3.split('\n')
    result.layer3 = l3Lines.slice(0, 5).join('\n') + '\n[...truncated]'
  }

  // Trim Layer 1 next (remove manifesto sections from end)
  if (total() > CHAR_BUDGET && result.layer1.length > 300) {
    const l1Parts = result.layer1.split('\n\n---\n\n')
    while (l1Parts.length > 1 && total() > CHAR_BUDGET) {
      l1Parts.pop()
    }
    result.layer1 = l1Parts.join('\n\n---\n\n')
  }

  // Trim prior output next
  if (total() > CHAR_BUDGET && result.priorOutput.length > 500) {
    result.priorOutput = result.priorOutput.slice(0, 2000) + '\n\n[...truncated for budget]'
  }

  // Trim Layer 2 siblings last (collapse to summary only)
  if (total() > CHAR_BUDGET && result.layer2.length > 400) {
    const l2Lines = result.layer2.split('\n')
    const siblingIdx = l2Lines.findIndex((l) => l.includes('### Sibling Tasks'))
    if (siblingIdx >= 0) {
      const beforeSiblings = l2Lines.slice(0, siblingIdx + 1)
      const afterSiblings = l2Lines.slice(siblingIdx + 1)
      const summaryLine = afterSiblings.find((l) => l.startsWith('Milestone progress:'))
      result.layer2 = [...beforeSiblings, summaryLine || ''].join('\n')
    }
  }

  return result
}

// ─── Reporting Protocol ──────────────────────────────────────────────────────

function buildReportingProtocol(
  subtaskId: string,
  milestoneId: string,
  pipelineStep?: PipelineStepName
): string {
  const lines: string[] = []

  lines.push('# REPORTING PROTOCOL')
  lines.push('')
  lines.push('You are being tracked by the Talkstore Command Center. As you work, update')
  lines.push('the tracker file so the Command Center reflects your progress in real-time.')
  lines.push('')
  lines.push(`**Tracker file:** ${TRACKER_PATH}`)
  lines.push(`**Your subtask:** ${subtaskId}`)
  lines.push(`**Milestone:** ${milestoneId}`)
  if (pipelineStep) {
    lines.push(`**Pipeline step:** ${pipelineStep}`)
  }
  lines.push('')

  lines.push('## On Start')
  lines.push('Read the tracker file. Find the subtask by navigating:')
  lines.push(`milestones → find where id === "${milestoneId}" → subtasks → find where id === "${subtaskId}"`)
  lines.push('')
  lines.push('Set on the subtask:')
  lines.push('- status: "in_progress"')
  if (pipelineStep) {
    lines.push('')
    lines.push('Set on the pipeline step:')
    lines.push(`- pipeline.steps.${pipelineStep}.status: "dispatched"`)
    lines.push(`- pipeline.steps.${pipelineStep}.dispatched_at: (current ISO timestamp)`)
  }
  lines.push('')
  lines.push('Write the file back. Preserve all other fields. Use 2-space JSON indentation.')

  lines.push('')
  lines.push('## On Completion')
  lines.push('Set on the subtask:')
  lines.push('- status: "done"')
  lines.push('- done: true')
  lines.push('- completed_at: (current ISO timestamp)')
  lines.push('- completed_by: "claude_code"')
  if (pipelineStep) {
    lines.push('')
    lines.push('Set on the pipeline step:')
    lines.push(`- pipeline.steps.${pipelineStep}.status: "complete"`)
    lines.push(`- pipeline.steps.${pipelineStep}.completed_at: (current ISO timestamp)`)
    lines.push(`- pipeline.steps.${pipelineStep}.output: (brief summary of what you did, 1-3 paragraphs)`)
  }
  lines.push('')
  lines.push('Write the file back.')

  lines.push('')
  lines.push('## If Blocked')
  lines.push('Set on the subtask:')
  lines.push('- status: "blocked"')
  lines.push('- blocked_reason: (description of what is blocking you)')
  lines.push('')
  lines.push('Write the file back.')

  lines.push('')
  lines.push('IMPORTANT: Always read the file fresh before writing. Other agents may have')
  lines.push('modified it. Preserve all fields you did not change. Keep the JSON valid.')

  return lines.join('\n')
}

// ─── Main Assembler ──────────────────────────────────────────────────────────

export function assemblePrompt(
  subtaskId: string,
  trackerState: TrackerState,
  pipelineStep?: PipelineStepName,
  includeReporting?: boolean
): AssembledPrompt | { error: string } {
  const match = findSubtaskAndMilestone(trackerState, subtaskId)
  if (!match) {
    return { error: `Subtask "${subtaskId}" not found in tracker state` }
  }

  const { subtask, milestone } = match

  // Pipeline step overrides the subtask's agent_target
  const effectiveAgentType = (pipelineStep || subtask.agent_target) as AgentTarget | null
  const profile = effectiveAgentType ? AGENT_PROFILES[effectiveAgentType] : DEFAULT_PROFILE

  const layer1 = loadLayer1(milestone.domain, profile)
  const layer2Text = loadLayer2(trackerState, milestone, subtask, profile)
  const layer3Text = loadLayer3(subtask)
  const taskText = buildTaskSection(subtask, milestone, profile)

  // Build prior output from pipeline chain
  const priorOutputText = pipelineStep ? buildPriorOutput(subtask, pipelineStep) : ''

  // Apply budget trimming
  const trimmed = trimToBudget({
    preamble: profile.preamble,
    layer1: layer1.text,
    layer2: layer2Text,
    layer3: layer3Text,
    priorOutput: priorOutputText,
    task: taskText,
  })

  // Build sections conditionally
  const parts: string[] = []

  // Preamble (agent role)
  if (trimmed.preamble) {
    parts.push(trimmed.preamble)
    parts.push('---')
  }

  // Layer 1 — only if there's content
  if (trimmed.layer1.trim()) {
    parts.push(`# PROJECT CONTEXT\n\n${trimmed.layer1}`)
    parts.push('---')
  }

  // Layer 2
  parts.push(`# MILESTONE CONTEXT\n\n${trimmed.layer2}`)
  parts.push('---')

  // Prior output from pipeline chain
  if (trimmed.priorOutput.trim()) {
    parts.push(`# PRIOR STEP OUTPUT\n\n${trimmed.priorOutput}`)
    parts.push('---')
  }

  // Layer 3 — only if there are files
  if (trimmed.layer3.trim() && trimmed.layer3 !== 'No context files or reference docs specified.') {
    parts.push(`# CODEBASE CONTEXT\n\n${trimmed.layer3}`)
    parts.push('---')
  }

  // Task section
  parts.push(`# ${profile.taskHeading}\n\n${trimmed.task}`)

  // Reporting protocol — only for dispatch, not preview
  if (includeReporting) {
    parts.push('---')
    parts.push(buildReportingProtocol(subtask.id, milestone.id, pipelineStep))
  }

  // Footer
  parts.push('---')
  parts.push(
    `*Assembled at ${new Date().toISOString()} | ${subtask.id} | ${milestone.title} (Week ${milestone.week})*`
  )

  const fullText = parts.join('\n\n')

  return {
    fullText,
    layerSummary: {
      layer1Sources: layer1.sources,
      layer1Chars: trimmed.layer1.length,
      layer2MilestoneId: milestone.id,
      layer2Chars: trimmed.layer2.length,
      layer3Status: 'placeholder',
      layer3Chars: trimmed.layer3.length,
      taskSectionChars: trimmed.task.length,
      totalChars: fullText.length,
      budgetChars: CHAR_BUDGET,
      trimmed: trimmed.trimmed,
    },
    agentProfile: effectiveAgentType || 'generic',
    assembledAt: new Date().toISOString(),
  }
}
