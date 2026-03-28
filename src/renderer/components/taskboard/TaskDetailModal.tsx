import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import type { Subtask, Agent, AgentLogEntry } from '../../../main/parser'

type TabId = 'details' | 'history'

const PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  P1: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  P2: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  P3: { color: '#9B9BAA', bg: 'rgba(155,155,170,0.12)' },
}

const DOMAIN_COLORS: Record<string, string> = {
  foundation: '#585CF0',
  storefront: '#22c55e',
  product_ops: '#f59e0b',
  commerce_intel: '#8286FF',
  launch_prep: '#ef4444',
  review_buffer: '#9B9BAA',
  v1_2: '#8286FF',
  v1_5: '#585CF0',
  distribution: '#9B9BAA',
}

const EXEC_MODE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  human: { label: 'Human', icon: '👤', color: '#22c55e' },
  agent: { label: 'Agent', icon: '⚡', color: '#ef4444' },
  pair: { label: 'Pair', icon: '🤝', color: '#3b82f6' },
}

interface TaskDetailModalProps {
  subtask: Subtask
  milestoneId: string
  milestoneTitle: string
  domain: string
  onClose: () => void
  onSwitchToSwimLane?: () => void
}

export function TaskDetailModal({
  subtask,
  milestoneId,
  milestoneTitle,
  domain,
  onClose,
  onSwitchToSwimLane,
}: TaskDetailModalProps) {
  const tracker = useStore((s) => s.tracker)
  const updateTracker = useStore((s) => s.updateTracker)

  const [activeTab, setActiveTab] = useState<TabId>('details')

  // Details tab state
  const [status, setStatus] = useState(subtask.status)
  const [assignee, setAssignee] = useState(subtask.assignee || '')
  const [priority, setPriority] = useState(subtask.priority)
  const [isBlocked, setIsBlocked] = useState(subtask.status === 'blocked')
  const [blockedReason, setBlockedReason] = useState(subtask.blocked_reason || '')
  const [notes, setNotes] = useState(subtask.notes || '')
  const [executionMode, setExecutionMode] = useState<Subtask['execution_mode']>(subtask.execution_mode || 'human')

  const agents: Agent[] = tracker?.agents || []
  const agentLog: AgentLogEntry[] = tracker?.agent_log || []
  const domainColor = DOMAIN_COLORS[domain] || '#9B9BAA'

  // Find dependencies
  const currentMs = tracker?.milestones.find((ms) => ms.id === milestoneId)
  const dependentMilestones = tracker?.milestones.filter((m) =>
    currentMs?.dependencies.includes(m.id)
  ) || []

  // Find sibling subtasks in the same milestone
  const siblings = currentMs?.subtasks.filter((s) => s.id !== subtask.id) || []

  // Find execution history for this task
  const taskHistory = agentLog.filter((entry) => entry.target_id === subtask.id)

  // Sync blocked status
  useEffect(() => {
    if (isBlocked && status !== 'blocked') setStatus('blocked')
    if (!isBlocked && status === 'blocked') setStatus('todo')
  }, [isBlocked])

  function doSave() {
    updateTracker((draft) => {
      const milestone = draft.milestones.find((m) => m.id === milestoneId)
      if (!milestone) return
      const task = milestone.subtasks.find((s) => s.id === subtask.id)
      if (!task) return

      // Details
      task.status = isBlocked ? 'blocked' : status
      task.done = status === 'done'
      task.assignee = assignee || null
      task.priority = priority
      task.blocked_by = isBlocked ? (assignee || 'unknown') : null
      task.blocked_reason = isBlocked ? (blockedReason || null) : null
      task.notes = notes || null
      task.execution_mode = executionMode

      if (status === 'done' && !task.completed_at) {
        task.completed_at = new Date().toISOString()
        task.completed_by = assignee || 'Luqman'
      }
      if (status !== 'done') {
        task.completed_at = null
        task.completed_by = null
      }

    })
  }

  function handleSave() {
    doSave()
    onClose()
  }

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const TABS: { id: TabId; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl mx-4 bg-dark border border-border rounded-xl shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-dark border-b border-border px-5 py-4 rounded-t-xl flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                  style={{ color: domainColor, backgroundColor: domainColor + '18' }}
                >
                  {domain.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: PRIORITY_STYLES[priority].color,
                    backgroundColor: PRIORITY_STYLES[priority].bg,
                  }}
                >
                  {priority}
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    color: EXEC_MODE_LABELS[executionMode].color,
                    backgroundColor: EXEC_MODE_LABELS[executionMode].color + '18',
                  }}
                >
                  {EXEC_MODE_LABELS[executionMode].icon} {EXEC_MODE_LABELS[executionMode].label}
                </span>
              </div>
              <h3 className="text-sm text-white font-semibold leading-snug">{subtask.label}</h3>
              <p className="text-[10px] text-muted font-mono mt-1">{subtask.id}</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted hover:text-white hover:border-accent/50 transition-colors flex-shrink-0"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-3 -mb-4 border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-muted hover:text-white/70'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ backgroundColor: domainColor }}
                  />
                )}
                {tab.id === 'history' && taskHistory.length > 0 && (
                  <span className="ml-1.5 text-[9px] text-muted font-mono">
                    {taskHistory.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === 'details' && (
            <DetailsTab
              status={status}
              setStatus={setStatus}
              assignee={assignee}
              setAssignee={setAssignee}
              priority={priority}
              setPriority={setPriority}
              isBlocked={isBlocked}
              setIsBlocked={setIsBlocked}
              blockedReason={blockedReason}
              setBlockedReason={setBlockedReason}
              notes={notes}
              setNotes={setNotes}
              executionMode={executionMode}
              setExecutionMode={setExecutionMode}
              agents={agents}
              dependentMilestones={dependentMilestones}
              siblings={siblings}
              milestoneTitle={milestoneTitle}
              onSwitchToSwimLane={onSwitchToSwimLane}
              onClose={onClose}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab
              taskHistory={taskHistory}
              subtask={subtask}
              domainColor={domainColor}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-dark border-t border-border px-5 py-3 flex items-center justify-between rounded-b-xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted">
              Status: <span className="text-white font-medium">{status.replace(/_/g, ' ')}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs text-muted hover:text-white border border-border hover:border-accent/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded text-xs text-white font-medium bg-accent hover:bg-accent-light transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Details Tab ──────────────────────────────────────────────────────────────

function DetailsTab({
  status, setStatus,
  assignee, setAssignee,
  priority, setPriority,
  isBlocked, setIsBlocked,
  blockedReason, setBlockedReason,
  notes, setNotes,
  executionMode, setExecutionMode,
  agents,
  dependentMilestones,
  siblings,
  milestoneTitle,
  onSwitchToSwimLane,
  onClose,
}: {
  status: Subtask['status']
  setStatus: (v: Subtask['status']) => void
  assignee: string
  setAssignee: (v: string) => void
  priority: Subtask['priority']
  setPriority: (v: Subtask['priority']) => void
  isBlocked: boolean
  setIsBlocked: (v: boolean) => void
  blockedReason: string
  setBlockedReason: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  executionMode: Subtask['execution_mode']
  setExecutionMode: (v: Subtask['execution_mode']) => void
  agents: Agent[]
  dependentMilestones: { id: string; title: string; subtasks: Subtask[] }[]
  siblings: Subtask[]
  milestoneTitle: string
  onSwitchToSwimLane?: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Row 1: Status + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">STATUS</label>
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value as Subtask['status']
              setStatus(v)
              if (v === 'blocked') setIsBlocked(true)
              else setIsBlocked(false)
            }}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono appearance-none cursor-pointer hover:border-accent/50 transition-colors"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">PRIORITY</label>
          <div className="flex gap-2">
            {(['P1', 'P2', 'P3'] as const).map((p) => {
              const s = PRIORITY_STYLES[p]
              const isActive = priority === p
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all border ${
                    isActive ? 'border-current' : 'border-transparent opacity-50 hover:opacity-75'
                  }`}
                  style={{ color: s.color, backgroundColor: s.bg }}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Assignee + Execution Mode */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">ASSIGNEE</label>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono appearance-none cursor-pointer hover:border-accent/50 transition-colors"
          >
            <option value="">Unassigned</option>
            <option value="Luqman">Luqman</option>
            {agents.map((a) => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">EXECUTION MODE</label>
          <div className="flex gap-1.5">
            {(Object.entries(EXEC_MODE_LABELS) as [Subtask['execution_mode'], typeof EXEC_MODE_LABELS[string]][]).map(
              ([mode, meta]) => {
                const isActive = executionMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => setExecutionMode(mode)}
                    className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-all border ${
                      isActive
                        ? 'border-current'
                        : 'border-transparent opacity-40 hover:opacity-70'
                    }`}
                    style={{ color: meta.color, backgroundColor: meta.color + '15' }}
                  >
                    {meta.icon} {meta.label}
                  </button>
                )
              }
            )}
          </div>
        </div>
      </div>

      {/* Blocker */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer mb-1.5">
          <input
            type="checkbox"
            checked={isBlocked}
            onChange={(e) => setIsBlocked(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border accent-behind"
          />
          <span className="text-[10px] text-muted font-bold tracking-wider">BLOCKED</span>
        </label>
        {isBlocked && (
          <input
            type="text"
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            placeholder="Reason for block..."
            className="w-full bg-surface border border-behind/30 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/50 focus:outline-none focus:border-behind/60 transition-colors"
          />
        )}
      </div>

      {/* Dependencies */}
      {dependentMilestones.length > 0 && (
        <div>
          <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">
            DEPENDS ON
          </label>
          <div className="space-y-1">
            {dependentMilestones.map((m) => {
              const done = m.subtasks.filter((s) => s.done).length
              const total = m.subtasks.length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              const allDone = done === total
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-surface border border-border"
                >
                  <span className={`text-[10px] ${allDone ? 'text-on-track' : 'text-white'}`}>
                    {allDone ? '✓' : '○'}
                  </span>
                  <span className="text-[10px] text-white flex-1">{m.title}</span>
                  <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: allDone ? '#22c55e' : '#585CF0',
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted font-mono w-8 text-right">{done}/{total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sibling tasks context */}
      {siblings.length > 0 && (
        <div>
          <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">
            SIBLING TASKS ({siblings.filter((s) => s.done).length}/{siblings.length} done)
          </label>
          <div className="max-h-32 overflow-y-auto space-y-0.5 rounded bg-surface border border-border p-2">
            {siblings.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-0.5">
                <span className={`text-[9px] ${s.done ? 'text-on-track' : s.status === 'in_progress' ? 'text-accent' : 'text-muted'}`}>
                  {s.done ? '✓' : s.status === 'in_progress' ? '▶' : '○'}
                </span>
                <span className={`text-[10px] truncate ${s.done ? 'text-muted line-through' : 'text-white/70'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">NOTES</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add notes, context, blockers..."
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* Parent milestone */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-muted font-bold tracking-wider">MILESTONE</span>
            <p className="text-xs text-white mt-0.5">{milestoneTitle}</p>
          </div>
          {onSwitchToSwimLane && (
            <button
              onClick={() => {
                onSwitchToSwimLane()
                onClose()
              }}
              className="text-[10px] text-accent hover:text-accent-light transition-colors"
            >
              View in Swim Lane →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({
  taskHistory,
  subtask,
  domainColor,
}: {
  taskHistory: AgentLogEntry[]
  subtask: Subtask
  domainColor: string
}) {
  if (taskHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-2xl mb-2 opacity-30">⚡</div>
        <p className="text-xs text-muted">No execution history yet</p>
        <p className="text-[10px] text-muted/60 mt-1">
          Run this task to see agent actions, file changes, and results here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {taskHistory.map((entry) => (
        <div key={entry.id} className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: domainColor, backgroundColor: domainColor + '18' }}
              >
                {entry.agent_id}
              </span>
              <span className="text-[10px] text-white font-medium">{entry.action}</span>
            </div>
            <span className="text-[9px] text-muted font-mono">
              {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">{entry.description}</p>
          {entry.tags.length > 0 && (
            <div className="flex gap-1 mt-2">
              {entry.tags.map((tag) => (
                <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-border text-muted">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
