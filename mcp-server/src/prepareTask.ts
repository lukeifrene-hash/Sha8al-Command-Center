/**
 * Dynamic task enrichment orchestrator.
 * Classifies task complexity, then runs Explorer → Planner with
 * appropriate depth, skills, and rules injected.
 */

import { readTracker, writeTracker, findTask } from './tracker.js'
import { runAgentStep } from './agentRunner.js'
import { buildExplorerPrompt, buildPlannerPrompt } from './prompts.js'
import { classifyTask, loadSkillContent, loadRuleContent, type TaskClassification } from './classifier.js'

export interface PrepareTaskResult {
  taskId: string
  enriched: boolean
  classification: TaskClassification
  explorerDurationMs: number
  plannerDurationMs: number
  fieldsUpdated: string[]
  summary: string
}

/**
 * Parse the planner's JSON output from markdown fences.
 */
function parsePlannerOutput(raw: string): {
  description: string
  acceptance_criteria: string[]
  constraints: string[]
  context_files: string[]
  reference_docs: string[]
  recommended_agents?: string[]
  recommended_commands?: string[]
  complexity?: string
} | null {
  // Strategy 1: extract from ```json fences
  const jsonMatch = raw.match(/```json\s*\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    } catch {
      // Fall through
    }
  }

  // Strategy 2: find a raw JSON object with expected keys
  const braceMatch = raw.match(/\{[\s\S]*"description"[\s\S]*"acceptance_criteria"[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0])
    } catch {
      return null
    }
  }

  return null
}

export async function prepareTask(taskId: string): Promise<PrepareTaskResult> {
  // 1. Read tracker and find task
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    throw new Error(`Task "${taskId}" not found in tracker`)
  }

  const { subtask, milestone } = match

  // 2. Classify the task
  const classification = classifyTask(state, subtask, milestone)
  console.error(`[prepare_task] Classification: ${classification.reasoning}`)

  // 3. Load relevant skill and rule content
  const skillContent = loadSkillContent(classification.relevantSkills)
  const ruleContent = loadRuleContent(classification.relevantRules)
  console.error(`[prepare_task] Loaded ${classification.relevantSkills.length} skills, ${classification.relevantRules.length} rules`)

  // 4. Run Explorer with classification-adjusted settings
  console.error(`[prepare_task] Running explorer (${classification.complexity}, ${classification.explorerModel}, ${classification.explorerTimeoutMs / 60_000}m)...`)
  const explorerPrompt = buildExplorerPrompt(state, subtask, milestone, classification, skillContent, ruleContent)

  const explorerTools = classification.needsWebResearch ? undefined : ['Read', 'Glob', 'Grep', 'Bash(ls)', 'Bash(find)']
  const explorerResult = await runAgentStep('explorer', explorerPrompt, {
    model: classification.explorerModel,
    timeoutMs: classification.explorerTimeoutMs,
    // If no web research needed, override tools to exclude WebSearch/WebFetch
    ...(explorerTools && { extraTools: [] }),
  })
  console.error(`[prepare_task] Explorer complete (${Math.round(explorerResult.durationMs / 1000)}s, ${explorerResult.output.length} chars)`)

  // 5. Re-read tracker
  const freshState = readTracker()
  const freshMatch = findTask(freshState, taskId)
  if (!freshMatch) {
    throw new Error(`Task "${taskId}" disappeared from tracker during exploration`)
  }

  // 6. Run Planner with classification-adjusted settings
  console.error(`[prepare_task] Running planner (${classification.complexity}, ${classification.plannerModel}, ${classification.plannerTimeoutMs / 60_000}m)...`)
  const plannerPrompt = buildPlannerPrompt(
    freshState, freshMatch.subtask, freshMatch.milestone,
    explorerResult.output, classification, skillContent, ruleContent,
  )
  const plannerResult = await runAgentStep('planner', plannerPrompt, {
    model: classification.plannerModel,
    timeoutMs: classification.plannerTimeoutMs,
  })
  console.error(`[prepare_task] Planner complete (${Math.round(plannerResult.durationMs / 1000)}s, ${plannerResult.output.length} chars)`)

  // 7. Parse planner output
  const enrichment = parsePlannerOutput(plannerResult.output)
  if (!enrichment) {
    throw new Error(
      'Failed to parse planner output as structured JSON. Raw output (first 500 chars): ' +
      plannerResult.output.slice(0, 500)
    )
  }

  // 8. Write enrichment back to tracker
  const writeState = readTracker()
  const writeMatch = findTask(writeState, taskId)
  if (!writeMatch) {
    throw new Error(`Task "${taskId}" disappeared from tracker during planning`)
  }

  const task = writeMatch.milestone.subtasks.find((s) => s.id === taskId)!
  const fieldsUpdated: string[] = []

  if (enrichment.description) {
    task.prompt = enrichment.description
    fieldsUpdated.push('prompt')
  }
  if (enrichment.acceptance_criteria?.length > 0) {
    task.acceptance_criteria = enrichment.acceptance_criteria
    fieldsUpdated.push(`acceptance_criteria (${enrichment.acceptance_criteria.length})`)
  }
  if (enrichment.constraints?.length > 0) {
    task.constraints = enrichment.constraints
    fieldsUpdated.push(`constraints (${enrichment.constraints.length})`)
  }
  if (enrichment.context_files?.length > 0) {
    task.context_files = enrichment.context_files
    fieldsUpdated.push(`context_files (${enrichment.context_files.length})`)
  }
  if (enrichment.reference_docs?.length > 0) {
    task.reference_docs = enrichment.reference_docs
    fieldsUpdated.push(`reference_docs (${enrichment.reference_docs.length})`)
  }

  // Log to agent_log
  writeState.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'mcp_prepare_task',
    action: 'task_prepared',
    target_type: 'subtask',
    target_id: taskId,
    description: `Task enriched (${classification.complexity}). Explorer: ${classification.explorerModel}/${Math.round(explorerResult.durationMs / 1000)}s. Planner: ${classification.plannerModel}/${Math.round(plannerResult.durationMs / 1000)}s. Skills: ${classification.relevantSkills.join(', ') || 'none'}. Updated: ${fieldsUpdated.join(', ')}.`,
    timestamp: new Date().toISOString(),
    tags: ['prepare', 'enrichment', classification.complexity, 'mcp'],
  })

  writeTracker(writeState)

  // 9. Build summary
  const summary = [
    `Task "${taskId}" enriched successfully.`,
    '',
    `Classification: ${classification.complexity}`,
    `Skills used: ${classification.relevantSkills.join(', ') || 'none'}`,
    `Rules applied: ${classification.relevantRules.join(', ') || 'none'}`,
    `Explorer: ${classification.explorerModel} — ${Math.round(explorerResult.durationMs / 1000)}s`,
    `Planner: ${classification.plannerModel} — ${Math.round(plannerResult.durationMs / 1000)}s`,
    '',
    `Fields updated:`,
    ...fieldsUpdated.map((f) => `  - ${f}`),
    '',
    `Post-implementation recommendations:`,
    `  Agents: ${enrichment.recommended_agents?.join(', ') || classification.relevantAgents.join(', ')}`,
    `  Commands: ${enrichment.recommended_commands?.join(', ') || classification.relevantCommands.join(', ')}`,
    '',
    enrichment.description ? `Description preview: ${enrichment.description.slice(0, 200)}...` : '',
  ].join('\n')

  return {
    taskId,
    enriched: true,
    classification,
    explorerDurationMs: explorerResult.durationMs,
    plannerDurationMs: plannerResult.durationMs,
    fieldsUpdated,
    summary,
  }
}
