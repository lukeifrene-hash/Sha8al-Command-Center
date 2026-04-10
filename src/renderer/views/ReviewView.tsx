import { useState, useMemo } from 'react'
import { useStore } from '../store'
import type { TrackerState } from '../store'

// ─── Types ──────────────────────────────────────────────────────────────────

type SessionStatus = 'in_progress' | 'not_started' | 'done'

interface CheckItem {
  label: string
  done: boolean
}

interface UISession {
  id: string
  title: string
  status: SessionStatus
  checklist: CheckItem[]
}

interface UXFlow {
  id: string
  title: string
  status: SessionStatus
  stepCount: number
}

interface Bug {
  id: string
  title: string
  priority: 'P1' | 'P2' | 'P3'
  source: string
}

// ─── Lane colors ────────────────────────────────────────────────────────────

const LANE_COLORS = {
  ui: '#60A5FA',
  ux: '#C084FC',
  backend: '#FB923C',
} as const

// ─── Initial hardcoded data ─────────────────────────────────────────────────

const INITIAL_UI_SESSIONS: UISession[] = [
  {
    id: 'ui-1',
    title: 'Chat page visual polish',
    status: 'in_progress',
    checklist: [
      { label: 'Landing card typography', done: false },
      { label: 'Message bubble spacing', done: false },
      { label: 'Input field border radius', done: false },
      { label: 'Contribution bar alignment', done: false },
      { label: 'Error banner styling', done: false },
      { label: 'Approval card responsiveness', done: false },
    ],
  },
  { id: 'ui-2', title: 'Billing page polish', status: 'not_started', checklist: [] },
  { id: 'ui-3', title: 'History + Settings pages', status: 'not_started', checklist: [] },
  { id: 'ui-4', title: 'Mobile responsiveness', status: 'not_started', checklist: [] },
]

const INITIAL_UX_FLOWS: UXFlow[] = [
  { id: 'ux-1', title: 'First install → onboarding scan', status: 'not_started', stepCount: 8 },
  { id: 'ux-2', title: 'ASK → RECOMMEND → EXECUTE', status: 'not_started', stepCount: 12 },
  { id: 'ux-3', title: 'Free → exhaustion → upgrade', status: 'not_started', stepCount: 10 },
  { id: 'ux-4', title: 'Navigation between all pages', status: 'not_started', stepCount: 6 },
]

const INITIAL_BUGS: Bug[] = [
  { id: 'bug-1', title: 'Onboarding scan hides empty state', priority: 'P2', source: 'review_polish_001 revision' },
]

// ─── Main Component ─────────────────────────────────────────────────────────

export function ReviewView() {
  const tracker = useStore((s) => s.tracker)
  const [uiSessions, setUISessions] = useState<UISession[]>(INITIAL_UI_SESSIONS)
  const [uxFlows, setUXFlows] = useState<UXFlow[]>(INITIAL_UX_FLOWS)
  const [bugs, setBugs] = useState<Bug[]>(INITIAL_BUGS)

  if (!tracker) return null

  const uiInProgress = uiSessions.filter((s) => s.status === 'in_progress').length
  const uiDone = uiSessions.filter((s) => s.status === 'done').length

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Review & Debug</h1>
        <p className="text-sm text-muted mt-1">Interactive debugging organized by domain</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="UI Sessions" value={uiSessions.length} color={LANE_COLORS.ui} />
        <StatBox label="UX Flows" value={uxFlows.length} color={LANE_COLORS.ux} />
        <StatBox label="Backend Bugs" value={bugs.length} color={LANE_COLORS.backend} />
        <StatBox
          label="Review Progress"
          value={`${uiDone + uiInProgress}/${uiSessions.length + uxFlows.length + bugs.length}`}
          color="#585CF0"
          isText
        />
      </div>

      {/* Debug lanes */}
      <div className="grid grid-cols-3 gap-4">
        <DebugLane title="UI Polish" color={LANE_COLORS.ui} count={uiSessions.length}>
          {uiSessions.map((session) => (
            <SessionCard
              key={session.id}
              title={session.title}
              status={session.status}
              checklist={session.checklist}
              onToggleCheck={(idx) => {
                setUISessions((prev) =>
                  prev.map((s) =>
                    s.id === session.id
                      ? {
                          ...s,
                          checklist: s.checklist.map((c, i) =>
                            i === idx ? { ...c, done: !c.done } : c
                          ),
                        }
                      : s
                  )
                )
              }}
            />
          ))}
          <NewButton label="+ New session" onClick={() => {
            const id = `ui-${Date.now()}`
            setUISessions((prev) => [...prev, { id, title: 'New UI session', status: 'not_started', checklist: [] }])
          }} />
        </DebugLane>

        <DebugLane title="UX Flows" color={LANE_COLORS.ux} count={uxFlows.length}>
          {uxFlows.map((flow) => (
            <SessionCard
              key={flow.id}
              title={flow.title}
              status={flow.status}
              stepCount={flow.stepCount}
            />
          ))}
          <NewButton label="+ New session" onClick={() => {
            const id = `ux-${Date.now()}`
            setUXFlows((prev) => [...prev, { id, title: 'New UX flow', status: 'not_started', stepCount: 0 }])
          }} />
        </DebugLane>

        <DebugLane title="Backend Fixes" color={LANE_COLORS.backend} count={bugs.length}>
          {bugs.map((bug) => (
            <BugCard key={bug.id} title={bug.title} priority={bug.priority} source={bug.source} />
          ))}
          <NewButton label="+ Report bug" onClick={() => {
            const id = `bug-${Date.now()}`
            setBugs((prev) => [...prev, { id, title: 'New bug', priority: 'P3', source: 'manual' }])
          }} />
        </DebugLane>
      </div>

      {/* Pre-Submission Review Protocol */}
      <ReviewProtocolSection tracker={tracker} />
    </div>
  )
}

// ─── StatBox ────────────────────────────────────────────────────────────────

function StatBox({ label, value, color, isText }: {
  label: string; value: number | string; color: string; isText?: boolean
}) {
  return (
    <div className="bg-surface rounded-lg p-3 border border-border">
      <div className={`${isText ? 'text-lg' : 'text-2xl'} font-semibold font-mono`} style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-muted font-semibold tracking-wider mt-1">{label.toUpperCase()}</div>
    </div>
  )
}

// ─── DebugLane ──────────────────────────────────────────────────────────────

function DebugLane({ title, color, count, children }: {
  title: string; color: string; count: number; children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/30 flex flex-col">
      {/* Lane header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold tracking-wider text-white flex-1">{title.toUpperCase()}</span>
        <span className="text-[10px] font-mono text-muted">{count}</span>
      </div>
      {/* Cards */}
      <div className="p-3 space-y-2 flex-1">
        {children}
      </div>
    </div>
  )
}

// ─── SessionCard ────────────────────────────────────────────────────────────

function SessionCard({ title, status, checklist, stepCount, onToggleCheck }: {
  title: string
  status: SessionStatus
  checklist?: CheckItem[]
  stepCount?: number
  onToggleCheck?: (idx: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-dark p-3 hover:border-border/80 hover:bg-dark/80 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => checklist && checklist.length > 0 && setExpanded(!expanded)}
          className="text-xs text-white font-medium text-left flex-1 min-w-0 truncate"
        >
          {title}
        </button>
        <StatusBadge status={status} />
      </div>

      {stepCount !== undefined && (
        <div className="text-[10px] text-muted mt-1.5 font-mono">{stepCount} steps</div>
      )}

      {checklist && checklist.length > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${(checklist.filter((c) => c.done).length / checklist.length) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-muted font-mono">
            {checklist.filter((c) => c.done).length}/{checklist.length}
          </span>
        </div>
      )}

      {expanded && checklist && checklist.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border space-y-1">
          {checklist.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onToggleCheck?.(idx)}
              className="flex items-center gap-2 w-full text-left group"
            >
              <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                item.done
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'border-border group-hover:border-muted'
              }`}>
                {item.done && (
                  <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-6" />
                  </svg>
                )}
              </div>
              <span className={`text-[11px] ${item.done ? 'text-muted line-through' : 'text-white/80'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BugCard ────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  P1: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  P2: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  P3: { bg: 'rgba(155,155,170,0.12)', text: '#9B9BAA' },
}

function BugCard({ title, priority, source }: { title: string; priority: string; source: string }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.P3

  return (
    <div className="rounded-lg border border-border bg-dark p-3 hover:border-border/80 hover:bg-dark/80 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-white font-medium flex-1 min-w-0">{title}</span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
          style={{ backgroundColor: style.bg, color: style.text }}
        >
          {priority}
        </span>
      </div>
      <div className="text-[10px] text-muted mt-1.5 font-mono truncate">{source}</div>
    </div>
  )
}

// ─── StatusBadge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SessionStatus }) {
  const config: Record<SessionStatus, { label: string; bg: string; text: string }> = {
    in_progress: { label: 'In Progress', bg: 'rgba(88,92,240,0.15)', text: '#8286FF' },
    not_started: { label: 'Not started', bg: 'rgba(155,155,170,0.12)', text: '#9B9BAA' },
    done: { label: 'Done', bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  }

  const c = config[status]

  return (
    <span
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded tracking-wider whitespace-nowrap flex-shrink-0"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {c.label.toUpperCase()}
    </span>
  )
}

// ─── NewButton ──────────────────────────────────────────────────────────────

function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 rounded-lg border border-dashed border-border text-[10px] text-muted font-semibold tracking-wider hover:border-accent/40 hover:text-accent-light transition-colors"
    >
      {label}
    </button>
  )
}

// ─── ReviewProtocolSection ──────────────────────────────────────────────────

function ReviewProtocolSection({ tracker }: { tracker: TrackerState }) {
  const reviewMilestone = useMemo(() => {
    return tracker.milestones.find((m) => m.id === 'pre_submission_review') ?? null
  }, [tracker.milestones])

  if (!reviewMilestone || reviewMilestone.subtasks.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6">
        <h2 className="text-sm font-bold tracking-wider text-muted mb-2">PRE-SUBMISSION REVIEW PROTOCOL</h2>
        <p className="text-xs text-muted">No pre-submission review milestone found in tracker.</p>
      </div>
    )
  }

  const totalChecks = reviewMilestone.subtasks.length
  const doneChecks = reviewMilestone.subtasks.filter((s) => s.done).length
  const overallPct = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0

  return (
    <div className="rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold tracking-wider text-white">PRE-SUBMISSION REVIEW PROTOCOL</h2>
          <p className="text-[10px] text-muted mt-0.5">{doneChecks}/{totalChecks} sessions complete</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-accent-light">{overallPct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {reviewMilestone.subtasks.map((subtask, idx) => {
          const checksDone = subtask.done ? subtask.acceptance_criteria.length : 0
          const checksTotal = subtask.acceptance_criteria.length || 1
          const pct = subtask.done ? 100 : Math.round((checksDone / checksTotal) * 100)

          return (
            <div
              key={subtask.id}
              className="bg-dark rounded-lg border border-border p-3 hover:border-border/80 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono text-muted">#{idx + 1}</span>
                <StatusBadge status={subtask.done ? 'done' : subtask.status === 'in_progress' ? 'in_progress' : 'not_started'} />
              </div>
              <p className="text-[11px] text-white font-medium leading-snug mb-2 line-clamp-2">
                {subtask.label}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: subtask.done ? '#22c55e' : '#585CF0',
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted font-mono">
                  {subtask.done ? checksTotal : checksDone}/{checksTotal}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
