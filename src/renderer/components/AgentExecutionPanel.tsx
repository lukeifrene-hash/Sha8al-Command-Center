import { useState, useEffect, useCallback, useMemo } from 'react'
import { useStore, type AgentExecution, type AgentExecutionStatus } from '../store'

const STATUS_COLORS: Record<AgentExecutionStatus, string> = {
  idle: '#8b919f',
  queued: '#8b919f',
  running: '#0071e3',
  paused: '#BA7517',
  completed: '#1D9E75',
  failed: '#ef4444',
  aborted: '#ef4444',
}

const STATUS_ICONS: Record<AgentExecutionStatus, string> = {
  idle: '○',
  queued: '◐',
  running: '◉',
  paused: '⏸',
  completed: '✓',
  failed: '✕',
  aborted: '⊘',
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '--:--'
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  const diff = Math.floor((endMs - startMs) / 1000)
  const mins = Math.floor(diff / 60)
  const secs = diff % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function ExecutionCard({ exec }: { exec: AgentExecution }) {
  const [expanded, setExpanded] = useState(false)
  const updateAgentExecution = useStore((s) => s.updateAgentExecution)
  const addNotification = useStore((s) => s.addNotification)

  const handleAbort = useCallback(async () => {
    try {
      await window.api.agent.abort(exec.id)
      addNotification({
        level: 'info',
        message: `Aborted execution ${exec.agentName}`,
        source: 'Agent Runtime',
      })
    } catch {
      addNotification({
        level: 'error',
        message: `Failed to abort execution ${exec.id}`,
        source: 'Agent Runtime',
      })
    }
  }, [exec.id, exec.agentName, addNotification])

  const handleRetry = useCallback(async () => {
    try {
      const newId = await window.api.agent.retry(exec.id)
      if (newId) {
        addNotification({
          level: 'info',
          message: `Retried execution as ${newId}`,
          source: 'Agent Runtime',
        })
      }
    } catch {
      addNotification({
        level: 'error',
        message: `Failed to retry execution ${exec.id}`,
        source: 'Agent Runtime',
      })
    }
  }, [exec.id, addNotification])

  const isActive = exec.status === 'running' || exec.status === 'queued'
  const output = [...exec.stdout, ...exec.stderr].join('')

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--theme-surface-container)',
        borderColor: isActive ? 'rgba(0, 113, 227, 0.3)' : 'var(--theme-border)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor: STATUS_COLORS[exec.status],
            boxShadow: isActive ? `0 0 8px ${STATUS_COLORS[exec.status]}40` : 'none',
          }}
        />
        <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--theme-primary-text)' }}>
          {exec.agentName}
        </span>
        <span
          className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded flex-shrink-0"
          style={{
            color: STATUS_COLORS[exec.status],
            backgroundColor: `${STATUS_COLORS[exec.status]}18`,
          }}
        >
          {STATUS_ICONS[exec.status]} {exec.status.toUpperCase()}
        </span>
        {isActive && (
          <button
            onClick={handleAbort}
            className="text-[10px] font-semibold px-2 py-0.5 rounded transition-colors hover:bg-red-500/20"
            style={{ color: '#ef4444' }}
          >
            ABORT
          </button>
        )}
        {(exec.status === 'failed' || exec.status === 'aborted') && (
          <button
            onClick={handleRetry}
            className="text-[10px] font-semibold px-2 py-0.5 rounded transition-colors hover:bg-accent/20"
            style={{ color: '#0071e3' }}
          >
            RETRY
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="px-4 pb-2 flex items-center gap-4 text-[10px]" style={{ color: 'var(--theme-muted)' }}>
        <span>ID: {exec.id.slice(0, 8)}</span>
        {exec.taskId && <span>Task: {exec.taskId}</span>}
        {exec.milestoneId && <span>Milestone: {exec.milestoneId}</span>}
        <span>Duration: {formatDuration(exec.startTime, exec.endTime)}</span>
        {exec.tokenEstimate > 0 && (
          <span>Tokens: ~{exec.tokenEstimate.toLocaleString()}</span>
        )}
        {exec.costEstimate > 0 && (
          <span>Cost: ${exec.costEstimate.toFixed(4)}</span>
        )}
      </div>

      {/* Progress bar for running tasks */}
      {exec.status === 'running' && (
        <div className="px-4 pb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-progress-track)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${exec.progress}%`,
                backgroundColor: '#0071e3',
              }}
            />
          </div>
        </div>
      )}

      {/* Output toggle */}
      {output && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-1.5 text-[10px] font-semibold tracking-wider flex items-center justify-center gap-1 transition-colors hover:bg-white/5"
          style={{ color: 'var(--theme-muted)' }}
        >
          {expanded ? '▲ HIDE OUTPUT' : '▼ SHOW OUTPUT'}
        </button>
      )}

      {/* Output */}
      {expanded && output && (
        <div
          className="px-4 py-3 text-[10px] font-mono leading-relaxed overflow-y-auto max-h-48"
          style={{
            backgroundColor: 'var(--theme-surface-container-lowest)',
            color: 'var(--theme-on-surface-variant)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {output}
        </div>
      )}

      {/* Reasoning trace */}
      {exec.reasoningTrace.length > 0 && (
        <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="text-[10px] font-semibold tracking-wider mb-1" style={{ color: 'var(--theme-muted)' }}>
            REASONING TRACE ({exec.reasoningTrace.length} entries)
          </div>
          {exec.reasoningTrace.slice(-3).map((trace, i) => (
            <div key={i} className="text-[10px] py-1 pl-2 border-l-2" style={{ borderColor: '#0071e3', color: 'var(--theme-on-surface-variant)' }}>
              {trace.slice(0, 200)}{trace.length > 200 ? '...' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AgentExecutionPanel() {
  const agentExecutions = useStore((s) => s.agentExecutions)
  const activeWaves = useStore((s) => s.activeWaves)
  const setAgentExecutions = useStore((s) => s.setAgentExecutions)
  const setActiveWaves = useStore((s) => s.setActiveWaves)
  const addNotification = useStore((s) => s.addNotification)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all')

  // Poll for execution updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const executions = await window.api.agent.listExecutions()
        setAgentExecutions(executions)
      } catch {
        // Silently fail - agent runtime may not be initialized
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [setAgentExecutions])

  // Listen for real-time events
  useEffect(() => {
    if (!window.api.events) return
    const cleanup = window.api.events.onEvent((event) => {
      if (event.type === 'agent:spawned') {
        const p = event.payload as { executionId: string; agentId: string; taskId: string | null }
        addNotification({
          level: 'info',
          message: `Agent ${p.agentId} started execution`,
          source: 'Agent Runtime',
        })
      }
      if (event.type === 'agent:finished') {
        const p = event.payload as { executionId: string; status: string }
        addNotification({
          level: p.status === 'completed' ? 'info' : 'warning',
          message: `Execution ${p.executionId.slice(0, 8)} ${p.status}`,
          source: 'Agent Runtime',
        })
      }
      if (event.type === 'wave:started') {
        const p = event.payload as { waveId: string; milestoneId: string }
        addNotification({
          level: 'info',
          message: `Wave ${p.waveId} started for ${p.milestoneId}`,
          source: 'Wave Controller',
        })
      }
    })
    return cleanup
  }, [addNotification])

  const filtered = useMemo(() => {
    switch (filter) {
      case 'active':
        return agentExecutions.filter((e) => e.status === 'running' || e.status === 'queued')
      case 'completed':
        return agentExecutions.filter((e) => e.status === 'completed')
      case 'failed':
        return agentExecutions.filter((e) => e.status === 'failed' || e.status === 'aborted')
      default:
        return agentExecutions
    }
  }, [agentExecutions, filter])

  const activeCount = agentExecutions.filter((e) => e.status === 'running').length
  const queuedCount = agentExecutions.filter((e) => e.status === 'queued').length

  return (
    <div className="h-full flex flex-col gap-4 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-section-heading text-white" style={{ fontSize: '28px' }}>Agent Execution</h2>
          <p className="text-caption mt-1" style={{ color: 'var(--theme-muted)' }}>
            Live agent runtime · {activeCount} active · {queuedCount} queued
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'completed', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-[10px] font-semibold tracking-wider px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: filter === f ? 'rgba(0, 113, 227, 0.15)' : 'transparent',
                color: filter === f ? '#2997ff' : 'var(--theme-muted)',
                border: `1px solid ${filter === f ? 'rgba(0, 113, 227, 0.3)' : 'var(--theme-border)'}`,
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Active Waves */}
      {activeWaves.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wider" style={{ color: 'var(--theme-muted)' }}>
            AUTONOMOUS WAVES
          </h3>
          {activeWaves.map((wave) => (
            <div
              key={wave.waveId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border"
              style={{
                backgroundColor: 'var(--theme-surface-container)',
                borderColor: wave.status === 'running' ? 'rgba(0, 113, 227, 0.3)' : 'var(--theme-border)',
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: wave.status === 'running' ? '#0071e3' : '#8b919f',
                  boxShadow: wave.status === 'running' ? '0 0 8px #0071e340' : 'none',
                }}
              />
              <span className="text-xs font-medium flex-1" style={{ color: 'var(--theme-primary-text)' }}>
                {wave.waveId}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--theme-muted)' }}>
                Step {wave.currentStep} / {wave.totalSteps}
              </span>
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-progress-track)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(wave.currentStep / wave.totalSteps) * 100}%`,
                    backgroundColor: '#0071e3',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Execution list */}
      <div className="space-y-3 flex-1">
        <h3 className="text-xs font-semibold tracking-wider" style={{ color: 'var(--theme-muted)' }}>
          EXECUTIONS
        </h3>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-3xl mb-3 opacity-20">⚡</div>
            <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
              No {filter !== 'all' ? filter : ''} executions
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--theme-muted)' }}>
              Agent executions will appear here when agents are spawned
            </p>
          </div>
        )}
        {filtered.map((exec) => (
          <ExecutionCard key={exec.id} exec={exec} />
        ))}
      </div>
    </div>
  )
}
