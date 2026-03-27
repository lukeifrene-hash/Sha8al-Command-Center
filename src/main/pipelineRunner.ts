/**
 * Pipeline Runner — Automated Explorer → Planner → Builder execution
 *
 * Runs each pipeline step headlessly via `claude --print`, captures stdout,
 * injects output into the next step's prompt, and sends progress events
 * to the renderer. The pipeline runner is the sole tracker writer —
 * headless agents do NOT get a reporting protocol.
 */

import { spawn, ChildProcess } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { BrowserWindow } from 'electron'
import { TALKSTORE_ROOT, TRACKER_PATH } from './config'
import { assemblePrompt } from './promptAssembler'
import { TOOLS_BY_TYPE, MODEL_BY_TYPE } from './warpLauncher'
import type { TrackerState, PipelineStepName, Milestone } from './parser'

// ─── Constants ──────────────────────────────────────────────────────────────

const PIPELINE_STEPS: PipelineStepName[] = ['explorer', 'planner', 'builder']

const STEP_TIMEOUT_MS: Record<PipelineStepName, number> = {
  explorer: 5 * 60_000,
  planner: 10 * 60_000,
  builder: 15 * 60_000,
}

const DEFAULT_TOOLS = ['Edit', 'Write', 'Read', 'Glob', 'Grep']

// ─── Active Pipeline Tracking ───────────────────────────────────────────────

interface ActivePipeline {
  process: ChildProcess | null
  cancelled: boolean
  tempFiles: string[]
}

const activePipelines = new Map<string, ActivePipeline>()

// ─── Helpers ────────────────────────────────────────────────────────────────

function readTracker(): TrackerState | null {
  try {
    const json = readFileSync(TRACKER_PATH, 'utf-8')
    return JSON.parse(json) as TrackerState
  } catch {
    return null
  }
}

function writeTracker(state: TrackerState): void {
  writeFileSync(TRACKER_PATH, JSON.stringify(state, null, 2), 'utf-8')
}

function findSubtaskInTracker(
  state: TrackerState,
  subtaskId: string
): { milestone: Milestone; taskIndex: number } | null {
  for (const milestone of state.milestones) {
    const idx = milestone.subtasks.findIndex((s) => s.id === subtaskId)
    if (idx >= 0) return { milestone, taskIndex: idx }
  }
  return null
}

function send(win: BrowserWindow, channel: string, data: Record<string, unknown>): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

function cleanupTempFiles(files: string[]): void {
  for (const f of files) {
    try {
      unlinkSync(f)
    } catch {
      /* already cleaned up */
    }
  }
}

// ─── Step Execution ─────────────────────────────────────────────────────────

function runStep(
  stepName: PipelineStepName,
  promptText: string,
  pipeline: ActivePipeline,
  onChunk?: (chunk: string) => void
): Promise<{ output: string; durationMs: number }> {
  return new Promise((resolve, reject) => {
    if (pipeline.cancelled) {
      return reject(new Error('Cancelled by user'))
    }

    // Write prompt to temp file
    const timestamp = Date.now()
    const promptFile = join(tmpdir(), `talkstore-pipeline-${stepName}-${timestamp}.md`)
    writeFileSync(promptFile, promptText, 'utf-8')
    pipeline.tempFiles.push(promptFile)

    // Build claude command
    const tools = TOOLS_BY_TYPE[stepName] || DEFAULT_TOOLS
    const model = MODEL_BY_TYPE[stepName] || 'sonnet'
    const toolArgs = tools.map((t) => `"${t}"`).join(' ')
    const claudeCmd = `claude --print --allowedTools ${toolArgs} --model ${model} "$(cat '${promptFile}')"`

    const startTime = Date.now()
    let stdout = ''
    let stderr = ''

    const child = spawn('bash', ['-c', claudeCmd], {
      cwd: TALKSTORE_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    pipeline.process = child

    // Set timeout
    const timeoutMs = STEP_TIMEOUT_MS[stepName]
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL')
      }, 3000)
      reject(new Error(`Timed out after ${Math.round(timeoutMs / 60_000)} minutes`))
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      if (onChunk) onChunk(text)
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      pipeline.process = null
      if (err.message.includes('ENOENT')) {
        reject(new Error('claude CLI not found in PATH. Make sure Claude Code is installed.'))
      } else {
        reject(err)
      }
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      pipeline.process = null

      if (pipeline.cancelled) {
        return reject(new Error('Cancelled by user'))
      }

      const durationMs = Date.now() - startTime

      if (code !== 0) {
        const errorMsg = stderr.trim() || `Process exited with code ${code}`
        return reject(new Error(errorMsg))
      }

      const output = stdout.trim()
      if (!output) {
        return reject(new Error('Agent produced no output'))
      }

      resolve({ output, durationMs })
    })
  })
}

// ─── Main Pipeline Runner ───────────────────────────────────────────────────

export async function runPipeline(
  subtaskId: string,
  mainWindow: BrowserWindow
): Promise<void> {
  // Guard: no duplicate runs
  if (activePipelines.has(subtaskId)) {
    throw new Error('Pipeline already running for this task')
  }

  const pipeline: ActivePipeline = {
    process: null,
    cancelled: false,
    tempFiles: [],
  }
  activePipelines.set(subtaskId, pipeline)

  try {
    // Read tracker and validate
    const initialState = readTracker()
    if (!initialState) throw new Error('Could not read tracker file')

    const match = findSubtaskInTracker(initialState, subtaskId)
    if (!match) throw new Error(`Subtask "${subtaskId}" not found`)

    const subtask = match.milestone.subtasks[match.taskIndex]
    if (!subtask.pipeline?.active) throw new Error('Pipeline mode is not active for this task')

    // Determine which steps are enabled
    const enabledSteps = PIPELINE_STEPS.filter((s) => subtask.pipeline!.steps[s].enabled)
    if (enabledSteps.length === 0) throw new Error('No pipeline steps are enabled')

    // Set task to in_progress
    const state = readTracker()!
    const m = findSubtaskInTracker(state, subtaskId)!
    const task = m.milestone.subtasks[m.taskIndex]
    if (task.status === 'todo') task.status = 'in_progress'
    writeTracker(state)

    // Run each enabled step in sequence
    for (const stepName of enabledSteps) {
      if (pipeline.cancelled) break

      const runId = `run_${Date.now()}`

      // Send step_started event
      send(mainWindow, 'pipeline:step_started', { subtaskId, step: stepName, runId })

      // Update tracker: mark step as running
      const preState = readTracker()!
      const preMatch = findSubtaskInTracker(preState, subtaskId)!
      const preTask = preMatch.milestone.subtasks[preMatch.taskIndex]
      if (preTask.pipeline) {
        preTask.pipeline.steps[stepName].status = 'running'
        preTask.pipeline.steps[stepName].dispatched_at = new Date().toISOString()
        preTask.pipeline.steps[stepName].run_id = runId
        preTask.pipeline.steps[stepName].error = null
        preTask.pipeline.current_step = stepName
      }
      preTask.last_run_id = runId
      writeTracker(preState)

      // Assemble prompt (re-read tracker to pick up prior step outputs)
      const freshState = readTracker()!
      const assembled = assemblePrompt(subtaskId, freshState, stepName, false)
      if ('error' in assembled) {
        throw new Error(`Prompt assembly failed for ${stepName}: ${assembled.error}`)
      }

      try {
        // Run the step with stdout streaming to renderer
        const { output, durationMs } = await runStep(
          stepName,
          assembled.fullText,
          pipeline,
          (chunk) => send(mainWindow, 'pipeline:step_output', { subtaskId, step: stepName, chunk })
        )

        // Update tracker: mark step complete with output
        const postState = readTracker()!
        const postMatch = findSubtaskInTracker(postState, subtaskId)!
        const postTask = postMatch.milestone.subtasks[postMatch.taskIndex]
        if (postTask.pipeline) {
          postTask.pipeline.steps[stepName].status = 'complete'
          postTask.pipeline.steps[stepName].completed_at = new Date().toISOString()
          postTask.pipeline.steps[stepName].output = output
          postTask.pipeline.steps[stepName].duration_ms = durationMs
          postTask.pipeline.steps[stepName].error = null

          // Advance current_step to next enabled non-complete step
          const nextStep = enabledSteps.find((s) => {
            const idx = enabledSteps.indexOf(s)
            return idx > enabledSteps.indexOf(stepName) && postTask.pipeline!.steps[s].status !== 'complete'
          })
          postTask.pipeline.current_step = nextStep || null
        }

        // Log to agent_log
        postState.agent_log.push({
          id: runId,
          agent_id: stepName,
          action: 'pipeline_auto_complete',
          target_type: 'subtask',
          target_id: subtaskId,
          description: `Pipeline step "${stepName}" completed (${Math.round(durationMs / 1000)}s, ${output.length.toLocaleString()} chars). Profile: ${assembled.agentProfile}.`,
          timestamp: new Date().toISOString(),
          tags: ['pipeline', 'auto', stepName],
        })

        writeTracker(postState)

        // Send step_completed event
        send(mainWindow, 'pipeline:step_completed', {
          subtaskId,
          step: stepName,
          output,
          durationMs,
        })
      } catch (stepError) {
        // Update tracker: mark step as error
        const errState = readTracker()
        if (errState) {
          const errMatch = findSubtaskInTracker(errState, subtaskId)
          if (errMatch) {
            const errTask = errMatch.milestone.subtasks[errMatch.taskIndex]
            if (errTask.pipeline) {
              errTask.pipeline.steps[stepName].status = 'error'
              errTask.pipeline.steps[stepName].error = String(stepError instanceof Error ? stepError.message : stepError)
            }

            errState.agent_log.push({
              id: runId,
              agent_id: stepName,
              action: 'pipeline_auto_error',
              target_type: 'subtask',
              target_id: subtaskId,
              description: `Pipeline step "${stepName}" failed: ${stepError instanceof Error ? stepError.message : stepError}`,
              timestamp: new Date().toISOString(),
              tags: ['pipeline', 'auto', 'error', stepName],
            })

            writeTracker(errState)
          }
        }

        // Send error event
        send(mainWindow, 'pipeline:error', {
          subtaskId,
          step: stepName,
          error: String(stepError instanceof Error ? stepError.message : stepError),
        })

        // Halt pipeline on error
        return
      }
    }

    // All steps complete — check if we should mark task as done
    if (!pipeline.cancelled) {
      const finalState = readTracker()!
      const finalMatch = findSubtaskInTracker(finalState, subtaskId)!
      const finalTask = finalMatch.milestone.subtasks[finalMatch.taskIndex]

      // Mark as review (not done) — operator must approve
      const lastEnabledStep = enabledSteps[enabledSteps.length - 1]
      if (lastEnabledStep === 'builder' && finalTask.pipeline?.steps.builder.status === 'complete') {
        finalTask.status = 'review'
      }

      // Recompute overall progress
      const total = finalState.milestones.reduce((s, m) => s + m.subtasks.length, 0)
      const done = finalState.milestones.reduce(
        (s, m) => s + m.subtasks.filter((t) => t.done).length,
        0
      )
      finalState.project.overall_progress = total > 0 ? parseFloat((done / total).toFixed(4)) : 0

      writeTracker(finalState)

      send(mainWindow, 'pipeline:completed', { subtaskId })
    }
  } finally {
    // Cleanup
    cleanupTempFiles(pipeline.tempFiles)
    activePipelines.delete(subtaskId)
  }
}

// ─── Cancellation ───────────────────────────────────────────────────────────

export function cancelPipeline(subtaskId: string): void {
  const pipeline = activePipelines.get(subtaskId)
  if (!pipeline) return

  pipeline.cancelled = true

  if (pipeline.process) {
    pipeline.process.kill('SIGTERM')
    // Escalate to SIGKILL after 3 seconds
    setTimeout(() => {
      if (pipeline.process && !pipeline.process.killed) {
        pipeline.process.kill('SIGKILL')
      }
    }, 3000)
  }
}
