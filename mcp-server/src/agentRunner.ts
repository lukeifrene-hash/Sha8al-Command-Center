/**
 * Agent Runner — Spawns claude --print headlessly for task enrichment.
 * Adapted from pipelineRunner.ts but without Electron dependencies.
 */

import { spawn } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { TALKSTORE_ROOT } from './tracker.js'

// Tool and model configs (replicated from warpLauncher.ts — can't import across packages)
const TOOLS_BY_STEP: Record<string, string[]> = {
  explorer: ['Read', 'Glob', 'Grep', 'Bash(ls)', 'Bash(find)', 'WebSearch', 'WebFetch'],
  planner: ['Read', 'Glob', 'Grep', 'Bash(ls)', 'Bash(find)'],
}

const MODEL_BY_STEP: Record<string, string> = {
  explorer: 'opus',
  planner: 'opus',
}

const STEP_TIMEOUT_MS: Record<string, number> = {
  explorer: 5 * 60_000,
  planner: 10 * 60_000,
}

export interface StepResult {
  output: string
  durationMs: number
}

export interface StepOverrides {
  model?: string
  timeoutMs?: number
  extraTools?: string[]
}

export async function runAgentStep(
  stepName: string,
  promptText: string,
  overrides?: StepOverrides,
): Promise<StepResult> {
  const timestamp = Date.now()
  const promptFile = join(tmpdir(), `talkstore-prepare-${stepName}-${timestamp}.md`)
  writeFileSync(promptFile, promptText, 'utf-8')

  try {
    const baseTools = TOOLS_BY_STEP[stepName] || []
    const tools = overrides?.extraTools ? [...new Set([...baseTools, ...overrides.extraTools])] : baseTools
    const model = overrides?.model || MODEL_BY_STEP[stepName] || 'opus'
    const toolArgs = tools.map((t) => `"${t}"`).join(' ')
    const claudeCmd = `claude --print --allowedTools ${toolArgs} --model ${model} "$(cat '${promptFile}')"`

    const startTime = Date.now()

    return await new Promise<StepResult>((resolve, reject) => {
      let stdout = ''
      let stderr = ''

      const child = spawn('bash', ['-c', claudeCmd], {
        cwd: TALKSTORE_ROOT,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const timeoutMs = overrides?.timeoutMs || STEP_TIMEOUT_MS[stepName] || 10 * 60_000
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL')
        }, 3000)
        reject(new Error(`${stepName} timed out after ${Math.round(timeoutMs / 60_000)} minutes`))
      }, timeoutMs)

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(
          err.message.includes('ENOENT')
            ? new Error('claude CLI not found in PATH. Make sure Claude Code is installed.')
            : err
        )
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        const durationMs = Date.now() - startTime

        if (code !== 0) {
          return reject(new Error(stderr.trim() || `${stepName} exited with code ${code}`))
        }

        const output = stdout.trim()
        if (!output) {
          return reject(new Error(`${stepName} agent produced no output`))
        }

        resolve({ output, durationMs })
      })
    })
  } finally {
    try {
      unlinkSync(promptFile)
    } catch {
      /* already cleaned */
    }
  }
}
