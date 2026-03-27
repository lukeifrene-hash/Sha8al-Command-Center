/**
 * Prompt templates for dynamic task enrichment.
 * Builds Explorer and Planner prompts with full project history,
 * domain skills, rules, and classification-aware depth.
 */

import type { TrackerState, Subtask, Milestone } from './tracker.js'
import { buildTaskContext, buildProjectStatus } from './context.js'
import type { TaskClassification } from './classifier.js'

// ─── Project History Builder ────────────────────────────────────────────────

export function buildProjectHistory(state: TrackerState): string {
  const lines: string[] = []
  lines.push('# Project History — What Has Been Built\n')

  const sortedMilestones = [...state.milestones].sort((a, b) => a.week - b.week)

  for (const ms of sortedMilestones) {
    const completedTasks = ms.subtasks.filter((s) => s.done)
    if (completedTasks.length === 0) continue

    const total = ms.subtasks.length
    lines.push(`## ${ms.title} (Week ${ms.week}, ${ms.domain}) — ${completedTasks.length}/${total} done`)

    for (const task of completedTasks) {
      const completionLog = state.agent_log
        .filter((e) => e.target_id === task.id && e.action === 'task_completed')
        .pop()
      const summary = completionLog?.description || task.notes || '(no summary)'
      lines.push(`- **${task.label}**: ${summary}`)
    }
    lines.push('')
  }

  // In-progress work
  const inProgressTasks: { task: Subtask; milestone: Milestone }[] = []
  for (const ms of sortedMilestones) {
    for (const task of ms.subtasks) {
      if (task.status === 'in_progress') {
        inProgressTasks.push({ task, milestone: ms })
      }
    }
  }

  if (inProgressTasks.length > 0) {
    lines.push('## Currently In Progress')
    for (const { task, milestone } of inProgressTasks) {
      lines.push(`- **${task.label}** (${milestone.title}, Week ${milestone.week})`)
    }
    lines.push('')
  }

  // Blocked work
  const blockedTasks: { task: Subtask; milestone: Milestone }[] = []
  for (const ms of sortedMilestones) {
    for (const task of ms.subtasks) {
      if (task.status === 'blocked') {
        blockedTasks.push({ task, milestone: ms })
      }
    }
  }

  if (blockedTasks.length > 0) {
    lines.push('## Currently Blocked')
    for (const { task } of blockedTasks) {
      lines.push(`- **${task.label}**: ${task.blocked_reason || 'no reason given'}`)
    }
    lines.push('')
  }

  if (lines.length <= 2) {
    lines.push('No tasks have been completed yet. This is the start of the project.')
  }

  return lines.join('\n')
}

// ─── Explorer Prompt ────────────────────────────────────────────────────────

export function buildExplorerPrompt(
  state: TrackerState,
  subtask: Subtask,
  milestone: Milestone,
  classification: TaskClassification,
  skillContent: string,
  ruleContent: string,
): string {
  const projectStatus = buildProjectStatus(state)
  const taskContext = buildTaskContext(state, subtask, milestone)

  // Adjust depth instructions based on complexity
  const depthInstructions = {
    simple: `This is a SIMPLE task. Keep your investigation focused and brief:
- Quick codebase scan — look for directly relevant files only (don't deep-dive)
- Skip web research unless the task explicitly involves an external API or library you're unfamiliar with
- Focus on: what exists, what pattern to follow, what file to create/modify
- Aim for a concise report — quality over quantity`,

    moderate: `This is a MODERATE complexity task. Investigate thoroughly but efficiently:
- Scan the codebase for relevant files, patterns, and conventions
- Check upstream dependencies — what was built that this task extends
- Do web research if the task involves external APIs or libraries
- Map out the key integration points`,

    complex: `This is a COMPLEX task requiring deep investigation:
- Thorough codebase scan — trace data flows, understand architecture layers
- Deep dependency analysis — read files from upstream milestones
- Comprehensive web research — official docs, best practices, known issues
- Identify all integration points, edge cases, and potential risks
- Check for existing utilities that can be reused`,
  }[classification.complexity]

  // Build project history (skip for simple tasks to save context)
  const projectHistory = classification.complexity === 'simple'
    ? '' // Simple tasks don't need full history
    : `---\n\n${buildProjectHistory(state)}\n\n`

  // Web research instructions
  const webInstructions = classification.needsWebResearch
    ? `3. **Web research**: Use WebSearch and WebFetch to find:
   - Official documentation for libraries/APIs this task involves
   - Best practices and common patterns
   - Known gotchas or migration guides\n`
    : `3. **Web research**: Not required for this task (unless you discover an unfamiliar library during codebase scan).\n`

  return `You are an expert codebase investigator preparing a task for execution.

**Task complexity: ${classification.complexity.toUpperCase()}**
${depthInstructions}

---

${projectStatus}

${projectHistory}---

${taskContext}

${skillContent ? `---\n\n${skillContent}\n` : ''}
${ruleContent ? `---\n\n${ruleContent}\n` : ''}
---

# YOUR INVESTIGATION BRIEF

Investigate: **${subtask.label}**

Domain: ${milestone.domain} | Phase: ${milestone.phase} | Week ${milestone.week}
Complexity: ${classification.complexity} | Skills: ${classification.relevantSkills.join(', ') || 'none'}

## What to investigate

1. **Codebase scan**: Use Glob to find relevant files. Use Read and Grep to understand existing patterns, data models, utilities, and conventions that this task should follow or extend.

2. **Dependency analysis**: Look at what upstream milestones produced. Read those files to understand the foundation this task builds on.

${webInstructions}
4. **Gap analysis**: What's missing from the codebase that this task needs to create? What existing code needs to be modified?

## Output Format

Produce a STRUCTURED REPORT with these exact sections:

### Key Findings
What you discovered about the codebase relevant to this task.

### Relevant Files
Each file path and WHY it matters (what it does, how it relates to this task).

### Existing Patterns
Code patterns, utilities, abstractions, or conventions to follow/reuse. Include specific function names and file paths.

### Dependencies & Risks
Upstream/downstream impacts. What could go wrong. What assumptions need validation.

### External References
URLs to documentation, API references, tutorials, or best practices found via web search. Include a 1-line summary of each.${classification.needsWebResearch ? '' : ' (Write "N/A — no web research needed" if you did not search)'}

### Recommended Approach
Your concrete suggestion for how to implement this task, based on what you found.
`
}

// ─── Planner Prompt ─────────────────────────────────────────────────────────

export function buildPlannerPrompt(
  state: TrackerState,
  subtask: Subtask,
  milestone: Milestone,
  explorerOutput: string,
  classification: TaskClassification,
  skillContent: string,
  ruleContent: string,
): string {
  const taskContext = buildTaskContext(state, subtask, milestone)

  // Adjust criteria depth based on complexity
  const criteriaGuidance = {
    simple: '3-5 criteria — keep them straightforward and directly testable',
    moderate: '4-8 criteria — cover the key integration points and edge cases',
    complex: '6-10 criteria — be thorough, cover architecture, integration, error handling, and performance',
  }[classification.complexity]

  const constraintGuidance = {
    simple: '1-3 constraints — only the essential guardrails',
    moderate: '2-5 constraints — include architectural constraints from skills/rules',
    complex: '3-7 constraints — comprehensive guardrails including safety, performance, and compatibility',
  }[classification.complexity]

  // Post-implementation recommendations section
  const recommendations = []
  if (classification.relevantAgents.length > 0) {
    recommendations.push(`"recommended_agents": ${JSON.stringify(classification.relevantAgents)}`)
  }
  if (classification.relevantCommands.length > 0) {
    recommendations.push(`"recommended_commands": ${JSON.stringify(classification.relevantCommands)}`)
  }
  const extraFields = recommendations.length > 0
    ? `,\n  ${recommendations.join(',\n  ')},\n  "complexity": "${classification.complexity}"`
    : `,\n  "complexity": "${classification.complexity}"`

  return `You are an architecture planner. You have received an exploration report about a task. Your job is to synthesize the findings into structured enrichment data that will be stored in the project tracker and used as instructions for the implementing agent.

**Task complexity: ${classification.complexity.toUpperCase()}** — calibrate your output accordingly.

---

${taskContext}

${skillContent ? `---\n\n${skillContent}\n` : ''}
${ruleContent ? `---\n\n${ruleContent}\n` : ''}
---

# EXPLORATION FINDINGS

${explorerOutput}

---

# YOUR PLANNING OBJECTIVE

Based on the exploration findings above, produce enrichment data for: **${subtask.label}**

You must output a single JSON block wrapped in \`\`\`json fences. The JSON must have EXACTLY these fields:

\`\`\`json
{
  "description": "A detailed description of what this task involves, why it matters, and what the implementation should achieve. Write as if briefing a senior engineer. Include the 'why' (product context), the 'what' (technical scope), and the 'how' (recommended approach from explorer findings).",
  "acceptance_criteria": [
    "${criteriaGuidance}"
  ],
  "constraints": [
    "${constraintGuidance}"
  ],
  "context_files": [
    "relative/path/to/file.ts — only files that ACTUALLY EXIST (explorer verified)"
  ],
  "reference_docs": [
    "https://docs.example.com — Brief description (only URLs explorer found)"
  ]${extraFields}
}
\`\`\`

## Rules

1. **acceptance_criteria**: Each must be independently testable. Use action verbs. Be specific — not "works correctly" but "returns 200 with JSON body containing { success: true }".

2. **constraints**: Include architectural constraints from CLAUDE.md and the domain skills/rules above. For storefront tasks, include theme-safety rules. For product-ops tasks, include snapshot/rollback requirements.

3. **context_files**: Only include files that ACTUALLY EXIST in the codebase (the explorer verified them).

4. **reference_docs**: URLs with descriptions. Only include URLs the explorer actually found.

5. **description**: This becomes the task prompt — the primary instruction the implementing agent receives. Make it thorough, specific, and actionable.

6. **recommended_agents**: Agents to run AFTER implementation for validation (e.g., liquid-validator for Liquid files, code-reviewer for all code).

7. **recommended_commands**: Commands to run for validation (e.g., pre-commit before committing, scan-theme after storefront changes).

Output ONLY the JSON block. No other text before or after it.
`
}
