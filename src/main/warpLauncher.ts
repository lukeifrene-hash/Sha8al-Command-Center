/**
 * Warp Launcher — Dispatch agent tasks to Warp terminal tabs
 *
 * Opens a new Warp tab at the project directory, writes a dispatch script,
 * and copies the run command to the clipboard. The user pastes (Cmd+V) and
 * hits Enter to start the agent.
 */

import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { clipboard } from 'electron'
import { TALKSTORE_ROOT } from './config'
import type { PipelineStepName } from './parser'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LaunchOptions {
  subtaskId: string
  subtaskLabel: string
  stepName: PipelineStepName | null
  promptText: string
}

export interface LaunchResult {
  success: boolean
  promptFilePath: string
  error?: string
}

// ─── Agent Type Config ───────────────────────────────────────────────────────

export const TOOLS_BY_TYPE: Record<string, string[]> = {
  explorer: ['Read', 'Glob', 'Grep', 'Bash(ls)', 'Bash(find)', 'WebSearch', 'WebFetch'],
  planner: ['Read', 'Glob', 'Grep', 'Bash(ls)', 'Bash(find)'],
  builder: ['Edit', 'Write', 'Read', 'Glob', 'Grep', 'Bash(npm test)', 'Bash(npm run typecheck)', 'Bash(npx prisma generate)'],
}

const DEFAULT_TOOLS = ['Edit', 'Write', 'Read', 'Glob', 'Grep']

export const MODEL_BY_TYPE: Record<string, string> = {
  explorer: 'opus',
  planner: 'opus',
  builder: 'opus',
}

const LABEL_BY_TYPE: Record<string, string> = {
  explorer: 'Explorer',
  planner: 'Planner',
  builder: 'Builder',
}

// ─── Launcher ────────────────────────────────────────────────────────────────

export async function launchInWarp(options: LaunchOptions): Promise<LaunchResult> {
  const { subtaskId, subtaskLabel, stepName, promptText } = options
  const timestamp = Date.now()
  const stepSuffix = stepName || 'dispatch'
  const stepLabel = stepName ? (LABEL_BY_TYPE[stepName] || stepName) : 'Task'

  // 1. Write prompt to temp file
  const promptFileName = `talkstore-dispatch-${subtaskId}-${stepSuffix}-${timestamp}.md`
  const promptFilePath = join(tmpdir(), promptFileName)

  try {
    writeFileSync(promptFilePath, promptText, 'utf-8')
  } catch (err) {
    return { success: false, promptFilePath, error: `Failed to write prompt file: ${err}` }
  }

  // 2. Build the claude command
  const tools = stepName ? (TOOLS_BY_TYPE[stepName] || DEFAULT_TOOLS) : DEFAULT_TOOLS
  const model = stepName ? (MODEL_BY_TYPE[stepName] || 'sonnet') : 'sonnet'
  const toolArgs = tools.map((t) => `"${t}"`).join(' ')

  const claudeCmd = `claude --allowedTools ${toolArgs} --model ${model} "$(cat '${promptFilePath}')"`

  // 3. Write dispatch script to project root
  const scriptName = `.talkstore-dispatch-${stepSuffix}.sh`
  const scriptPath = join(TALKSTORE_ROOT, scriptName)

  const scriptContent = `#!/bin/bash
# Talkstore Command Center — ${stepLabel} Dispatch
# Subtask: ${subtaskId}
# ${subtaskLabel}
# Generated: ${new Date().toISOString()}

${claudeCmd}
`

  try {
    writeFileSync(scriptPath, scriptContent, { mode: 0o755 })
  } catch (err) {
    return { success: false, promptFilePath, error: `Failed to write dispatch script: ${err}` }
  }

  // 4. Copy the run command to clipboard
  clipboard.writeText(`bash ${scriptName}`)

  // 5. Open a new Warp tab at the project directory
  try {
    await new Promise<void>((resolve, reject) => {
      exec(
        `open "warp://action/new_tab?path=${encodeURIComponent(TALKSTORE_ROOT)}"`,
        (err) => {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  } catch (err) {
    return { success: false, promptFilePath, error: `Failed to open Warp tab: ${err}` }
  }

  // 6. Schedule cleanup of dispatch script and prompt file
  //    Prompt file kept for 10 minutes (agent needs it while running)
  //    Script cleaned up after 5 minutes
  setTimeout(() => {
    try { unlinkSync(scriptPath) } catch { /* already cleaned up */ }
  }, 300_000)

  setTimeout(() => {
    try { unlinkSync(promptFilePath) } catch { /* already cleaned up */ }
  }, 600_000)

  return { success: true, promptFilePath }
}
