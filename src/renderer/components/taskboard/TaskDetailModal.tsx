import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import type { Subtask, Agent, AgentLogEntry, Pipeline, PipelineStepName, PipelineStep } from '../../../main/parser'
import { PipelineStepCard } from './PipelineStepCard'

type TabId = 'details' | 'prompt' | 'history'

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
  human: { label: 'Human', icon: '👤', color: '#9B9BAA' },
  agent: { label: 'Agent', icon: '⚡', color: '#585CF0' },
  pair: { label: 'Pair', icon: '🤝', color: '#22c55e' },
}

const AGENT_TARGETS: { id: string; label: string; desc: string; profileHint: string }[] = [
  { id: 'explorer', label: 'Explorer', desc: 'Read-only codebase search', profileHint: 'Minimal context, no manifesto, summary siblings only' },
  { id: 'planner', label: 'Planner', desc: 'Architecture + design', profileHint: 'Full context, all manifesto sections, all siblings' },
  { id: 'builder', label: 'Builder', desc: 'Full implementation', profileHint: 'Conventions + principles, relevant siblings only' },
]

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

  // Prompt tab state
  const [prompt, setPrompt] = useState(subtask.prompt || '')
  const [contextFiles, setContextFiles] = useState(subtask.context_files?.join('\n') || '')
  const [referenceDocs, setReferenceDocs] = useState(subtask.reference_docs?.join('\n') || '')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(subtask.acceptance_criteria?.join('\n') || '')
  const [constraints, setConstraints] = useState(subtask.constraints?.join('\n') || '')
  const [agentTarget, setAgentTarget] = useState<Subtask['agent_target']>(subtask.agent_target || null)

  // Pipeline state
  const [pipeline, setPipeline] = useState<Pipeline | null>(subtask.pipeline || null)

  // Automated pipeline state (lifted from PromptTab for footer access)
  const [pipelineRunning, setPipelineRunning] = useState(false)

  // Dispatch state
  const [dispatching, setDispatching] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

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

  function splitLines(str: string): string[] {
    return str.split('\n').map((s) => s.trim()).filter(Boolean)
  }

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

      // Prompt layer
      task.prompt = prompt || null
      task.context_files = splitLines(contextFiles)
      task.reference_docs = splitLines(referenceDocs)
      task.acceptance_criteria = splitLines(acceptanceCriteria)
      task.constraints = splitLines(constraints)
      task.agent_target = agentTarget

      // Pipeline
      task.pipeline = pipeline
    })
  }

  function handleSave() {
    doSave()
    onClose()
  }

  async function handleDispatch() {
    setDispatching(true)
    setCopyFeedback(null)
    try {
      // 1. Save current edits first
      doSave()

      // 2. Small delay to let debounced write complete
      await new Promise((r) => setTimeout(r, 600))

      // 3. Launch in Warp (main process handles assembly, reporting protocol, tracker update, and logging)
      const result = await window.api.dispatch.launchInWarp(subtask.id, null)
      if (result.success) {
        setCopyFeedback('Tab opened — paste ⌘V to run')
      } else {
        setCopyFeedback('Error: ' + (result.error || 'Launch failed'))
      }

      // 4. Clear feedback after 5 seconds
      setTimeout(() => setCopyFeedback(null), 5000)
    } catch (err) {
      setCopyFeedback('Error: ' + String(err))
    } finally {
      setDispatching(false)
    }
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
    { id: 'prompt', label: 'Prompt' },
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
                {agentTarget && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded text-accent bg-accent/10">
                    {agentTarget.toUpperCase()}
                  </span>
                )}
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

          {activeTab === 'prompt' && (
            <PromptTab
              subtaskId={subtask.id}
              prompt={prompt}
              setPrompt={setPrompt}
              contextFiles={contextFiles}
              setContextFiles={setContextFiles}
              referenceDocs={referenceDocs}
              setReferenceDocs={setReferenceDocs}
              acceptanceCriteria={acceptanceCriteria}
              setAcceptanceCriteria={setAcceptanceCriteria}
              constraints={constraints}
              setConstraints={setConstraints}
              agentTarget={agentTarget}
              setAgentTarget={setAgentTarget}
              subtaskLabel={subtask.label}
              milestoneTitle={milestoneTitle}
              domain={domain}
              domainColor={domainColor}
              doSave={doSave}
              pipeline={pipeline}
              setPipeline={setPipeline}
              milestoneId={milestoneId}
              updateTracker={updateTracker}
              pipelineRunning={pipelineRunning}
              setPipelineRunning={setPipelineRunning}
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
            <button
              onClick={handleDispatch}
              disabled={dispatching || executionMode === 'human' || (pipeline?.active === true) || pipelineRunning}
              title={
                pipelineRunning
                  ? 'Automated pipeline is running'
                  : pipeline?.active
                    ? 'Use pipeline step buttons in the Prompt tab'
                    : executionMode === 'human'
                      ? 'Set execution mode to Agent or Pair to enable dispatch'
                      : 'Assemble prompt and launch in Warp'
              }
              className={`px-4 py-2 rounded text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                executionMode === 'human' || pipeline?.active
                  ? 'border-accent/20 text-accent/30 cursor-not-allowed'
                  : copyFeedback
                    ? 'border-on-track text-on-track bg-on-track/10'
                    : 'border-accent text-accent hover:bg-accent/10'
              }`}
            >
              <span>{dispatching ? '...' : copyFeedback ? '✓' : '⚡'}</span>
              {dispatching
                ? 'Launching...'
                : copyFeedback
                  ? copyFeedback
                  : pipeline?.active
                    ? 'Pipeline Active'
                    : 'Run in Warp'}
            </button>
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

// ─── Prompt Tab ───────────────────────────────────────────────────────────────

const PIPELINE_STEPS: PipelineStepName[] = ['explorer', 'planner', 'builder']

function createDefaultPipeline(): Pipeline {
  const makeStep = (): PipelineStep => ({
    enabled: true,
    status: 'idle',
    dispatched_at: null,
    completed_at: null,
    output: null,
    run_id: null,
    error: null,
    duration_ms: null,
  })
  return {
    active: true,
    steps: { explorer: makeStep(), planner: makeStep(), builder: makeStep() },
    current_step: 'explorer',
  }
}

function computeCurrentStep(pipeline: Pipeline): PipelineStepName | null {
  for (const step of PIPELINE_STEPS) {
    if (pipeline.steps[step].enabled && pipeline.steps[step].status !== 'complete') {
      return step
    }
  }
  return null
}

function hasPriorOutputForStep(pipeline: Pipeline, step: PipelineStepName): boolean {
  if (step === 'explorer') return false
  if (step === 'planner') {
    return pipeline.steps.explorer.status === 'complete' && !!pipeline.steps.explorer.output
  }
  if (step === 'builder') {
    const p = pipeline.steps.planner
    const e = pipeline.steps.explorer
    return (p.status === 'complete' && !!p.output) || (e.status === 'complete' && !!e.output)
  }
  return false
}

function PromptTab({
  subtaskId,
  prompt, setPrompt,
  contextFiles, setContextFiles,
  referenceDocs, setReferenceDocs,
  acceptanceCriteria, setAcceptanceCriteria,
  constraints, setConstraints,
  agentTarget, setAgentTarget,
  subtaskLabel, milestoneTitle, domain, domainColor,
  doSave,
  pipeline, setPipeline,
  milestoneId, updateTracker,
  pipelineRunning, setPipelineRunning,
}: {
  subtaskId: string
  prompt: string
  setPrompt: (v: string) => void
  contextFiles: string
  setContextFiles: (v: string) => void
  referenceDocs: string
  setReferenceDocs: (v: string) => void
  acceptanceCriteria: string
  setAcceptanceCriteria: (v: string) => void
  constraints: string
  setConstraints: (v: string) => void
  agentTarget: Subtask['agent_target']
  setAgentTarget: (v: Subtask['agent_target']) => void
  subtaskLabel: string
  milestoneTitle: string
  domain: string
  domainColor: string
  doSave: () => void
  pipeline: Pipeline | null
  setPipeline: (v: Pipeline | null) => void
  milestoneId: string
  updateTracker: (updater: (draft: import('../../../main/parser').TrackerState) => void) => void
  pipelineRunning: boolean
  setPipelineRunning: (v: boolean) => void
}) {
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewMeta, setPreviewMeta] = useState<AssembledPrompt['layerSummary'] | null>(null)

  // Automated pipeline streaming state
  const [streamingOutputs, setStreamingOutputs] = useState<Record<PipelineStepName, string>>({
    explorer: '', planner: '', builder: '',
  })

  // Ref to always have the latest pipeline in event handlers (avoids stale closures)
  const pipelineRef = useRef(pipeline)
  pipelineRef.current = pipeline

  // Subscribe to pipeline progress events — only re-subscribe when subtaskId changes
  useEffect(() => {
    const unsubs: (() => void)[] = []

    unsubs.push(window.api.pipeline.onStepStarted((data) => {
      if (data.subtaskId !== subtaskId) return
      const current = pipelineRef.current
      if (data.step && current) {
        const step = data.step as PipelineStepName
        setPipeline({
          ...current,
          steps: {
            ...current.steps,
            [step]: { ...current.steps[step], status: 'running' as const, run_id: data.runId || null, error: null },
          },
          current_step: step,
        })
      }
    }))

    unsubs.push(window.api.pipeline.onStepOutput((data) => {
      if (data.subtaskId !== subtaskId || !data.step || !data.chunk) return
      const step = data.step as PipelineStepName
      setStreamingOutputs((prev) => ({
        ...prev,
        [step]: prev[step] + data.chunk,
      }))
    }))

    unsubs.push(window.api.pipeline.onStepCompleted((data) => {
      if (data.subtaskId !== subtaskId || !data.step) return
      const current = pipelineRef.current
      if (!current) return
      const step = data.step as PipelineStepName
      const updated: Pipeline = {
        ...current,
        steps: {
          ...current.steps,
          [step]: {
            ...current.steps[step],
            status: 'complete' as const,
            output: data.output || null,
            completed_at: new Date().toISOString(),
            duration_ms: data.durationMs || null,
            error: null,
          },
        },
      }
      updated.current_step = computeCurrentStep(updated)
      setPipeline(updated)
    }))

    unsubs.push(window.api.pipeline.onCompleted((data) => {
      if (data.subtaskId !== subtaskId) return
      setPipelineRunning(false)
    }))

    unsubs.push(window.api.pipeline.onError((data) => {
      if (data.subtaskId !== subtaskId) return
      setPipelineRunning(false)
      const current = pipelineRef.current
      if (data.step && current) {
        const step = data.step as PipelineStepName
        setPipeline({
          ...current,
          steps: {
            ...current.steps,
            [step]: { ...current.steps[step], status: 'error' as const, error: data.error || 'Unknown error' },
          },
        })
      }
    }))

    return () => unsubs.forEach((u) => u())
  }, [subtaskId]) // Only subtaskId — pipeline accessed via ref to avoid stale closures

  const pipelineActive = pipeline?.active === true

  function handleTogglePipeline() {
    if (pipelineActive) {
      setPipeline(null)
    } else {
      setPipeline(createDefaultPipeline())
    }
  }

  function handleToggleStep(stepName: PipelineStepName, enabled: boolean) {
    if (!pipeline) return
    const enabledCount = PIPELINE_STEPS.filter((s) => s === stepName ? enabled : pipeline.steps[s].enabled).length
    if (enabledCount < 1) return // At least 1 step must be enabled

    const updated: Pipeline = {
      ...pipeline,
      steps: {
        ...pipeline.steps,
        [stepName]: { ...pipeline.steps[stepName], enabled },
      },
    }
    updated.current_step = computeCurrentStep(updated)
    setPipeline(updated)
  }

  function handleSaveStepOutput(stepName: PipelineStepName, output: string) {
    if (!pipeline) return
    const updated: Pipeline = {
      ...pipeline,
      steps: {
        ...pipeline.steps,
        [stepName]: {
          ...pipeline.steps[stepName],
          output: output || null,
          status: output ? 'complete' : 'idle',
          completed_at: output ? new Date().toISOString() : null,
        },
      },
    }
    updated.current_step = computeCurrentStep(updated)
    setPipeline(updated)

    // Also persist immediately via doSave
    doSave()
  }

  function handleStepDispatch(stepName: PipelineStepName) {
    if (!pipeline) return
    const runId = `run_${Date.now()}`
    const updated: Pipeline = {
      ...pipeline,
      steps: {
        ...pipeline.steps,
        [stepName]: {
          ...pipeline.steps[stepName],
          status: 'dispatched',
          dispatched_at: new Date().toISOString(),
          run_id: runId,
        },
      },
    }
    setPipeline(updated)

    // Log dispatch
    updateTracker((draft) => {
      draft.agent_log.push({
        id: runId,
        agent_id: stepName,
        action: 'pipeline_dispatch',
        target_type: 'subtask',
        target_id: subtaskId,
        description: `Pipeline step "${stepName}" dispatched. Prompt copied to clipboard.`,
        timestamp: new Date().toISOString(),
        tags: ['pipeline', 'dispatch', stepName],
      })
      const ms = draft.milestones.find((m) => m.id === milestoneId)
      const task = ms?.subtasks.find((s) => s.id === subtaskId)
      if (task) {
        task.last_run_id = runId
        if (task.status === 'todo') task.status = 'in_progress'
        task.pipeline = updated
      }
    })
  }

  async function handleRunPipeline() {
    doSave()
    await new Promise((r) => setTimeout(r, 600))
    setPipelineRunning(true)
    setStreamingOutputs({ explorer: '', planner: '', builder: '' })
    const result = await window.api.pipeline.run(subtaskId)
    if (!result.success) {
      setPipelineRunning(false)
    }
  }

  async function handleCancelPipeline() {
    await window.api.pipeline.cancel(subtaskId)
    setPipelineRunning(false)
  }

  // ─── Pipeline Mode ───────────────────────────────────────────────────────

  if (pipelineActive && pipeline) {
    const STEP_COLORS: Record<PipelineStepName, string> = {
      explorer: '#f59e0b',
      planner: '#585CF0',
      builder: '#22c55e',
    }

    return (
      <div className="space-y-4">
        {/* Pipeline toggle + Run Pipeline button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={true}
                onChange={handleTogglePipeline}
                disabled={pipelineRunning}
                className="w-3.5 h-3.5 rounded border-border accent-accent"
              />
              <span className="text-[10px] text-white font-bold tracking-wider">PIPELINE MODE</span>
            </label>
            <button
              onClick={handleRunPipeline}
              disabled={pipelineRunning}
              className={`px-3 py-1 rounded text-[10px] font-medium transition-colors ${
                pipelineRunning
                  ? 'bg-blue-500/20 text-blue-400 cursor-not-allowed'
                  : 'bg-accent text-white hover:bg-accent-light'
              }`}
            >
              {pipelineRunning ? 'Running...' : 'Run Pipeline'}
            </button>
            {pipelineRunning && (
              <button
                onClick={handleCancelPipeline}
                className="px-3 py-1 rounded text-[10px] font-medium border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          <span className="text-[9px] text-muted">
            {pipelineRunning
              ? 'Automated execution in progress...'
              : pipeline.current_step
                ? `Current: ${pipeline.current_step.charAt(0).toUpperCase() + pipeline.current_step.slice(1)}`
                : 'All steps complete'}
          </span>
        </div>

        {/* Step indicator bar */}
        <div className="flex items-center gap-1 px-2">
          {PIPELINE_STEPS.map((step, i) => {
            const s = pipeline.steps[step]
            const isCurrent = pipeline.current_step === step
            const color = STEP_COLORS[step]
            return (
              <div key={step} className="flex items-center gap-1 flex-1">
                <div className="flex items-center gap-1.5 flex-1">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
                      !s.enabled ? 'opacity-20' : ''
                    }`}
                    style={{
                      backgroundColor: s.status === 'complete' ? color : isCurrent ? color : '#3A3A4A',
                      boxShadow: isCurrent ? `0 0 6px ${color}50` : 'none',
                    }}
                  />
                  <span
                    className={`text-[9px] font-medium ${
                      !s.enabled ? 'text-muted/30 line-through' : isCurrent ? 'text-white' : s.status === 'complete' ? 'text-muted' : 'text-muted/60'
                    }`}
                  >
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <span className="text-border text-[10px] mx-1">→</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Shared task config (collapsed) */}
        <details className="group">
          <summary className="text-[10px] text-muted font-bold tracking-wider cursor-pointer hover:text-white transition-colors">
            TASK CONFIG
            <span className="font-normal tracking-normal ml-1 opacity-60">— prompt, criteria, constraints</span>
          </summary>
          <div className="mt-3 space-y-3 pl-0">
            <div>
              <label className="block text-[10px] text-muted font-bold tracking-wider mb-1">
                PROMPT OVERRIDE
                {!prompt && (
                  <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium tracking-normal">
                    AUTO-GENERATED
                  </span>
                )}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder={`Auto-generated from: "${subtaskLabel}"`}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted font-bold tracking-wider mb-1">ACCEPTANCE CRITERIA</label>
                <textarea
                  value={acceptanceCriteria}
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  rows={2}
                  placeholder="One per line"
                  className="w-full bg-surface border border-border rounded px-3 py-2 text-[10px] text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted font-bold tracking-wider mb-1">CONSTRAINTS</label>
                <textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  rows={2}
                  placeholder="What NOT to do"
                  className="w-full bg-surface border border-border rounded px-3 py-2 text-[10px] text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted font-bold tracking-wider mb-1">CONTEXT FILES</label>
                <textarea
                  value={contextFiles}
                  onChange={(e) => setContextFiles(e.target.value)}
                  rows={2}
                  placeholder="One path per line"
                  className="w-full bg-surface border border-border rounded px-3 py-2 text-[10px] text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted font-bold tracking-wider mb-1">REFERENCE DOCS</label>
                <textarea
                  value={referenceDocs}
                  onChange={(e) => setReferenceDocs(e.target.value)}
                  rows={2}
                  placeholder="URLs or file paths"
                  className="w-full bg-surface border border-border rounded px-3 py-2 text-[10px] text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                />
              </div>
            </div>
          </div>
        </details>

        {/* Pipeline step cards */}
        <div className="space-y-2">
          {PIPELINE_STEPS.map((stepName) => (
            <PipelineStepCard
              key={stepName}
              stepName={stepName}
              step={pipeline.steps[stepName]}
              subtaskId={subtaskId}
              isCurrent={pipeline.current_step === stepName}
              hasPriorOutput={hasPriorOutputForStep(pipeline, stepName)}
              onToggleEnabled={(enabled) => handleToggleStep(stepName, enabled)}
              onSaveOutput={(output) => handleSaveStepOutput(stepName, output)}
              onDispatch={() => handleStepDispatch(stepName)}
              doSave={doSave}
              streamingOutput={streamingOutputs[stepName]}
              isAutomatedRun={pipelineRunning}
            />
          ))}
        </div>
      </div>
    )
  }

  // ─── Single Dispatch Mode (original) ─────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Pipeline toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={false}
            onChange={handleTogglePipeline}
            className="w-3.5 h-3.5 rounded border-border accent-accent"
          />
          <span className="text-[10px] text-muted font-bold tracking-wider">PIPELINE MODE</span>
          <span className="text-[9px] text-muted/50">Explorer → Planner → Builder chain</span>
        </label>
      </div>

      {/* Agent Target */}
      <div>
        <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">AGENT TYPE</label>
        <div className="grid grid-cols-3 gap-2">
          {AGENT_TARGETS.map((t) => {
            const isActive = agentTarget === t.id
            return (
              <button
                key={t.id}
                onClick={() => setAgentTarget(isActive ? null : t.id as Subtask['agent_target'])}
                className={`px-3 py-2 rounded border text-left transition-all ${
                  isActive
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface hover:border-accent/30'
                }`}
              >
                <div className={`text-xs font-medium ${isActive ? 'text-white' : 'text-muted'}`}>
                  {t.label}
                </div>
                <div className="text-[9px] text-muted mt-0.5">{t.desc}</div>
              </button>
            )
          })}
        </div>
        {agentTarget && (
          <p className="text-[9px] text-muted/70 mt-1.5 italic">
            {AGENT_TARGETS.find((t) => t.id === agentTarget)?.profileHint}
          </p>
        )}
      </div>

      {/* Prompt Override */}
      <div>
        <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">
          PROMPT OVERRIDE
          <span className="font-normal tracking-normal ml-1 opacity-60">— optional, overrides auto-generated prompt</span>
          {!prompt && (
            <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium tracking-normal">
              AUTO-GENERATED
            </span>
          )}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={`Auto-generated from task label:\n"${subtaskLabel}"\n\nWrite a custom prompt here to override...`}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* Acceptance Criteria */}
      <div>
        <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">
          ACCEPTANCE CRITERIA
          <span className="font-normal tracking-normal ml-1 opacity-60">— one per line</span>
        </label>
        <textarea
          value={acceptanceCriteria}
          onChange={(e) => setAcceptanceCriteria(e.target.value)}
          rows={3}
          placeholder="Code compiles without errors&#10;Unit tests pass&#10;Feature works end-to-end in dev"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* Constraints */}
      <div>
        <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">
          CONSTRAINTS
          <span className="font-normal tracking-normal ml-1 opacity-60">— what NOT to do</span>
        </label>
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={2}
          placeholder="Do not modify existing tests&#10;Do not add new dependencies"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* Context Files */}
      <div>
        <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">
          CONTEXT FILES
          <span className="font-normal tracking-normal ml-1 opacity-60">— one path per line, agent reads these first</span>
        </label>
        <textarea
          value={contextFiles}
          onChange={(e) => setContextFiles(e.target.value)}
          rows={2}
          placeholder="src/main/index.ts&#10;src/renderer/store.ts"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* Reference Docs */}
      <div>
        <label className="block text-[10px] text-muted font-bold tracking-wider mb-1.5">
          REFERENCE DOCS
          <span className="font-normal tracking-normal ml-1 opacity-60">— URLs or file paths</span>
        </label>
        <textarea
          value={referenceDocs}
          onChange={(e) => setReferenceDocs(e.target.value)}
          rows={2}
          placeholder="docs/manifesto.md&#10;docs/tasks.md"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-white font-mono placeholder:text-muted/40 focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* Assembled prompt preview */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-muted font-bold tracking-wider">
            ASSEMBLED PROMPT PREVIEW
          </label>
          <button
            onClick={async () => {
              setPreviewLoading(true)
              setPreviewError(null)
              try {
                doSave()
                await new Promise((r) => setTimeout(r, 600))
                const result = await window.api.prompt.assemble(subtaskId)
                if ('error' in result) {
                  setPreviewError(result.error)
                  setPreviewText(null)
                  setPreviewMeta(null)
                } else {
                  setPreviewText(result.fullText)
                  setPreviewMeta(result.layerSummary)
                  setPreviewError(null)
                }
              } catch (err) {
                setPreviewError(String(err))
              } finally {
                setPreviewLoading(false)
              }
            }}
            disabled={previewLoading}
            className="text-[10px] text-accent hover:text-accent-light transition-colors font-medium"
          >
            {previewLoading ? 'Generating...' : previewText ? 'Regenerate' : 'Generate Preview'}
          </button>
        </div>

        {previewError && (
          <div className="bg-behind/10 border border-behind/30 rounded p-3 text-[10px] text-behind font-mono">
            {previewError}
          </div>
        )}

        {!previewText && !previewError && (
          <div className="bg-surface border border-border rounded p-4 text-center">
            <p className="text-[10px] text-muted">
              Click "Generate Preview" to assemble the prompt.
            </p>
            <p className="text-[9px] text-muted/50 mt-1">
              {agentTarget
                ? `${agentTarget.charAt(0).toUpperCase() + agentTarget.slice(1)} profile — content filtered by agent type`
                : 'Select an agent type above for optimized prompts'}
            </p>
          </div>
        )}

        {previewText && (
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-dark space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted font-mono">
                    {previewText.length.toLocaleString()} / {previewMeta?.budgetChars?.toLocaleString() || '12,000'} chars
                  </span>
                  {previewMeta?.trimmed && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-behind/15 text-behind font-medium">
                      TRIMMED
                    </span>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await window.api.prompt.copyToClipboard(previewText)
                  }}
                  className="text-[9px] text-accent hover:text-accent-light transition-colors"
                >
                  Copy to clipboard
                </button>
              </div>
              {previewMeta && previewMeta.totalChars > 0 && (
                <div className="space-y-1">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-border">
                    {previewMeta.layer1Chars > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(previewMeta.layer1Chars / previewMeta.budgetChars) * 100}%`,
                          backgroundColor: '#585CF0',
                        }}
                        title={`L1 Project: ${previewMeta.layer1Chars.toLocaleString()} chars`}
                      />
                    )}
                    <div
                      className="h-full"
                      style={{
                        width: `${(previewMeta.layer2Chars / previewMeta.budgetChars) * 100}%`,
                        backgroundColor: '#22c55e',
                      }}
                      title={`L2 Milestone: ${previewMeta.layer2Chars.toLocaleString()} chars`}
                    />
                    {previewMeta.layer3Chars > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(previewMeta.layer3Chars / previewMeta.budgetChars) * 100}%`,
                          backgroundColor: '#f59e0b',
                        }}
                        title={`L3 Codebase: ${previewMeta.layer3Chars.toLocaleString()} chars`}
                      />
                    )}
                    <div
                      className="h-full"
                      style={{
                        width: `${(previewMeta.taskSectionChars / previewMeta.budgetChars) * 100}%`,
                        backgroundColor: '#ef4444',
                      }}
                      title={`Task: ${previewMeta.taskSectionChars.toLocaleString()} chars`}
                    />
                  </div>
                  <div className="flex gap-3 text-[8px] text-muted">
                    {previewMeta.layer1Chars > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#585CF0' }} />
                        L1 {previewMeta.layer1Chars.toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                      L2 {previewMeta.layer2Chars.toLocaleString()}
                    </span>
                    {previewMeta.layer3Chars > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                        L3 {previewMeta.layer3Chars.toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                      Task {previewMeta.taskSectionChars.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <pre className="p-3 text-[10px] text-white/70 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
              {previewText}
            </pre>
          </div>
        )}
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
