/**
 * Sha8al Command Center — Agent Runtime API
 *
 * Lightweight local runtime for spawning agents, streaming their output,
 * capturing reasoning traces, and managing execution lifecycle.
 *
 * This module provides the backend for the Live Agent Execution Panel UI.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentExecutionStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted'

export interface AgentExecution {
  id: string
  agentId: string
  agentName: string
  taskId: string | null
  milestoneId: string | null
  status: AgentExecutionStatus
  command: string
  args: string[]
  pid: number | null
  startTime: string | null
  endTime: string | null
  exitCode: number | null
  stdout: string[]
  stderr: string[]
  reasoningTrace: string[]      // Chain-of-thought / reasoning extraction
  tokenEstimate: number         // Estimated tokens consumed
  costEstimate: number          // Estimated cost in USD
  progress: number               // 0-100 if reportable
}

export interface WaveState {
  waveId: string
  milestoneId: string
  currentStep: number
  totalSteps: number
  status: 'running' | 'paused' | 'completed' | 'failed'
  executionIds: string[]
}

export interface AgentRuntimeOptions {
  maxConcurrent: number
  defaultTimeoutMs: number
  sandboxMode: 'subprocess' | 'worker_thread' | 'vm'
  envVars: Record<string, string>
  workingDirectory: string
}

// ─── Default Options ───────────────────────────────────────────────────────

const DEFAULT_OPTIONS: AgentRuntimeOptions = {
  maxConcurrent: 3,
  defaultTimeoutMs: 30 * 60 * 1000, // 30 minutes
  sandboxMode: 'subprocess',
  envVars: {},
  workingDirectory: process.cwd(),
}

// ─── Event Emitter for Status Changes ──────────────────────────────────────

class AgentRuntimeEvents extends EventEmitter {
  emitUpdate(exec: AgentExecution): void {
    this.emit('execution:update', exec)
  }

  emitComplete(exec: AgentExecution): void {
    this.emit('execution:complete', exec)
  }

  emitError(exec: AgentExecution, error: Error): void {
    this.emit('execution:error', exec, error)
  }
}

export const runtimeEvents = new AgentRuntimeEvents()

// ─── Runtime State ─────────────────────────────────────────────────────────

let runtimeOptions: AgentRuntimeOptions = { ...DEFAULT_OPTIONS }
const executions = new Map<string, AgentExecution>()
const activeProcesses = new Map<string, ChildProcessWithoutNullStreams>()
let executionQueue: string[] = []

// ─── Public API ────────────────────────────────────────────────────────────

export function configureRuntime(options: Partial<AgentRuntimeOptions>): void {
  runtimeOptions = { ...runtimeOptions, ...options }
}

export function getRuntimeOptions(): AgentRuntimeOptions {
  return { ...runtimeOptions }
}

export function listExecutions(): AgentExecution[] {
  return Array.from(executions.values()).sort(
    (a, b) => {
      if (!a.startTime || !b.startTime) return 0
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    }
  )
}

export function getExecution(id: string): AgentExecution | null {
  return executions.get(id) ?? null
}

export function getActiveExecutions(): AgentExecution[] {
  return listExecutions().filter(e => e.status === 'running' || e.status === 'queued')
}

export function getExecutionsForTask(taskId: string): AgentExecution[] {
  return listExecutions().filter(e => e.taskId === taskId)
}

export function getExecutionsForMilestone(milestoneId: string): AgentExecution[] {
  return listExecutions().filter(e => e.milestoneId === milestoneId)
}

/**
 * Spawn a new agent execution.
 *
 * Returns the execution ID immediately. The execution may be queued
 * if maxConcurrent is reached.
 */
export function spawnAgentExecution(params: {
  agentId: string
  agentName: string
  command: string
  args?: string[]
  taskId?: string
  milestoneId?: string
  env?: Record<string, string>
  timeoutMs?: number
}): string {
  const id = randomUUID()

  const exec: AgentExecution = {
    id,
    agentId: params.agentId,
    agentName: params.agentName,
    taskId: params.taskId ?? null,
    milestoneId: params.milestoneId ?? null,
    status: 'queued',
    command: params.command,
    args: params.args ?? [],
    pid: null,
    startTime: null,
    endTime: null,
    exitCode: null,
    stdout: [],
    stderr: [],
    reasoningTrace: [],
    tokenEstimate: 0,
    costEstimate: 0,
    progress: 0,
  }

  executions.set(id, exec)
  executionQueue.push(id)
  runtimeEvents.emitUpdate(exec)

  processQueue()
  return id
}

/**
 * Abort a running or queued execution.
 */
export function abortExecution(id: string): boolean {
  const exec = executions.get(id)
  if (!exec) return false

  // Remove from queue if queued
  const queueIdx = executionQueue.indexOf(id)
  if (queueIdx >= 0) {
    executionQueue.splice(queueIdx, 1)
    exec.status = 'aborted'
    exec.endTime = new Date().toISOString()
    runtimeEvents.emitUpdate(exec)
    return true
  }

  // Kill active process
  const proc = activeProcesses.get(id)
  if (proc && !proc.killed) {
    proc.kill('SIGTERM')
    // Force kill after 5s if still running
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
    }, 5000)
  }

  exec.status = 'aborted'
  exec.endTime = new Date().toISOString()
  runtimeEvents.emitUpdate(exec)
  return true
}

/**
 * Retry a failed execution.
 */
export function retryExecution(id: string): string | null {
  const exec = executions.get(id)
  if (!exec || exec.status !== 'failed') return null

  return spawnAgentExecution({
    agentId: exec.agentId,
    agentName: exec.agentName,
    command: exec.command,
    args: exec.args,
    taskId: exec.taskId ?? undefined,
    milestoneId: exec.milestoneId ?? undefined,
  })
}

// ─── Queue Processing ──────────────────────────────────────────────────────

function processQueue(): void {
  const activeCount = Array.from(executions.values()).filter(e => e.status === 'running').length
  const availableSlots = runtimeOptions.maxConcurrent - activeCount

  if (availableSlots <= 0) return

  for (let i = 0; i < availableSlots && executionQueue.length > 0; i++) {
    const nextId = executionQueue.shift()!
    const exec = executions.get(nextId)
    if (!exec) continue

    startExecution(exec)
  }
}

function startExecution(exec: AgentExecution): void {
  exec.status = 'running'
  exec.startTime = new Date().toISOString()

  const env = {
    ...process.env,
    ...runtimeOptions.envVars,
    SHA8AL_EXECUTION_ID: exec.id,
    SHA8AL_AGENT_ID: exec.agentId,
    SHA8AL_TASK_ID: exec.taskId ?? '',
  }

  try {
    const proc = spawn(exec.command, exec.args, {
      cwd: runtimeOptions.workingDirectory,
      env,
      shell: false,
    })

    exec.pid = proc.pid ?? null
    activeProcesses.set(exec.id, proc)

    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString('utf-8')
      exec.stdout.push(chunk)
      extractReasoningTrace(exec, chunk)
      runtimeEvents.emitUpdate({ ...exec })
    })

    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString('utf-8')
      exec.stderr.push(chunk)
      runtimeEvents.emitUpdate({ ...exec })
    })

    proc.on('exit', (code) => {
      exec.exitCode = code ?? null
      exec.endTime = new Date().toISOString()
      exec.status = code === 0 ? 'completed' : 'failed'
      activeProcesses.delete(exec.id)

      // Estimate tokens from stdout+stderr length (rough heuristic: ~4 chars/token)
      const allOutput = [...exec.stdout, ...exec.stderr].join('')
      exec.tokenEstimate = Math.round(allOutput.length / 4)
      exec.costEstimate = estimateCost(exec.agentId, exec.tokenEstimate)

      executions.set(exec.id, exec)
      runtimeEvents.emitComplete({ ...exec })
      processQueue()
    })

    proc.on('error', (err) => {
      exec.status = 'failed'
      exec.endTime = new Date().toISOString()
      exec.stderr.push(`[Runtime Error] ${err.message}`)
      activeProcesses.delete(exec.id)
      executions.set(exec.id, exec)
      runtimeEvents.emitError({ ...exec }, err)
      processQueue()
    })

    executions.set(exec.id, exec)
    runtimeEvents.emitUpdate({ ...exec })
  } catch (err) {
    exec.status = 'failed'
    exec.endTime = new Date().toISOString()
    exec.stderr.push(`[Spawn Error] ${(err as Error).message}`)
    executions.set(exec.id, exec)
    runtimeEvents.emitError({ ...exec }, err as Error)
    processQueue()
  }
}

// ─── Reasoning Trace Extraction ────────────────────────────────────────────

const REASONING_PATTERNS = [
  /\[REASONING\](.+?)\[\/REASONING\]/gs,
  /\<think\>(.+?)\<\/think\>/gs,
  /\<reasoning\>(.+?)\<\/reasoning\>/gs,
  /Reasoning:\s*(.+?)(?=\n\n|\n[A-Z]|$)/gs,
]

function extractReasoningTrace(exec: AgentExecution, chunk: string): void {
  for (const pattern of REASONING_PATTERNS) {
    const matches = chunk.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        exec.reasoningTrace.push(match[1].trim())
      }
    }
  }
}

// ─── Cost Estimation ───────────────────────────────────────────────────────

const COST_PER_1K_TOKENS: Record<string, number> = {
  'gpt-4': 0.03,
  'gpt-4-turbo': 0.01,
  'gpt-3.5-turbo': 0.0005,
  'claude-3-opus': 0.015,
  'claude-3-sonnet': 0.003,
  'claude-3-haiku': 0.00025,
  'default': 0.005,
}

function estimateCost(agentId: string, tokens: number): number {
  // Try to match agent ID to a model, fallback to default
  const modelKey = Object.keys(COST_PER_1K_TOKENS).find(k =>
    agentId.toLowerCase().includes(k)
  )
  const rate = modelKey ? COST_PER_1K_TOKENS[modelKey] : COST_PER_1K_TOKENS.default
  return Math.round((tokens / 1000) * rate * 1000) / 1000
}

// ─── Autonomous Loop Support ───────────────────────────────────────────────

interface WaveConfig {
  waveId: string
  milestoneId: string
  agentSequence: string[]   // Ordered list of agent IDs
  parallel: boolean
  autoApprove: boolean
}

const activeWaves = new Map<string, WaveState & { config: WaveConfig }>()

export function startAutonomousWave(waveConfig: WaveConfig): string {
  const waveState: WaveState & { config: WaveConfig } = {
    waveId: waveConfig.waveId,
    milestoneId: waveConfig.milestoneId,
    currentStep: 0,
    totalSteps: waveConfig.agentSequence.length,
    executionIds: [],
    status: 'running',
    config: waveConfig,
  }

  activeWaves.set(waveConfig.waveId, waveState)
  runtimeEvents.emit('wave:started', waveConfig)

  runNextWaveStep(waveConfig.waveId)
  return waveConfig.waveId
}

export function pauseWave(waveId: string): boolean {
  const wave = activeWaves.get(waveId)
  if (!wave || wave.status !== 'running') return false
  wave.status = 'paused'
  runtimeEvents.emit('wave:paused', waveId)
  return true
}

export function resumeWave(waveId: string): boolean {
  const wave = activeWaves.get(waveId)
  if (!wave || wave.status !== 'paused') return false
  wave.status = 'running'
  runtimeEvents.emit('wave:resumed', waveId)
  runNextWaveStep(waveId)
  return true
}

export function abortWave(waveId: string): boolean {
  const wave = activeWaves.get(waveId)
  if (!wave) return false

  // Abort all active executions in this wave
  for (const execId of wave.executionIds) {
    abortExecution(execId)
  }

  wave.status = 'failed'
  activeWaves.delete(waveId)
  runtimeEvents.emit('wave:aborted', waveId)
  return true
}

export function getWaveStatus(waveId: string): WaveState | null {
  const wave = activeWaves.get(waveId)
  if (!wave) return null
  const { config: _, ...clean } = wave
  return clean
}

function runNextWaveStep(waveId: string): void {
  const wave = activeWaves.get(waveId)
  if (!wave || wave.status !== 'running') return

  const { config, currentStep } = wave
  if (currentStep >= config.agentSequence.length) {
    wave.status = 'completed'
    runtimeEvents.emit('wave:completed', waveId)
    return
  }

  const agentId = config.agentSequence[currentStep]
  const execId = spawnAgentExecution({
    agentId,
    agentName: agentId,
    command: 'echo',
    args: [`[Wave ${waveId}] Step ${currentStep + 1}: ${agentId}`],
    milestoneId: config.milestoneId,
  })

  wave.executionIds.push(execId)
  wave.currentStep = currentStep + 1

  // Listen for completion to trigger next step
  const onComplete = (exec: AgentExecution) => {
    if (exec.id !== execId) return
    if (exec.status === 'completed' || exec.status === 'failed') {
      runtimeEvents.off('execution:complete', onComplete)
      if (exec.status === 'failed' && !config.autoApprove) {
        wave.status = 'failed'
        runtimeEvents.emit('wave:failed', waveId, exec)
        return
      }
      runNextWaveStep(waveId)
    }
  }

  runtimeEvents.on('execution:complete', onComplete)
}
