import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { TrackerState } from '../store'

// ── Types ──────────────────────────────────────────────────────────────

type QAStatus = 'untested' | 'pass' | 'fail'

interface UseCase {
  id: string
  name: string
  task: string
  scope: string
  built: boolean
  test_prompt: string
  agent_status: QAStatus
  agent_tested_at: string | null
  agent_notes: string | null
  operator_status: QAStatus
  operator_tested_at: string | null
  operator_notes: string | null
  review_fix_id: string | null
}

interface Group {
  id: string
  name: string
  use_cases: UseCase[]
}

// ── Constants ──────────────────────────────────────────────────────────

const STATUS_ICON: Record<QAStatus, { icon: string; color: string }> = {
  pass: { icon: '✓', color: '#1D9E75' },
  fail: { icon: '✗', color: '#ef4444' },
  untested: { icon: '○', color: '#888780' },
}

const DOT_COLOR: Record<QAStatus, string> = {
  pass: '#1D9E75',
  fail: '#ef4444',
  untested: '#888780',
}

// ── Readiness Bar ──────────────────────────────────────────────────────

function ReadinessBar({ groups }: { groups: Group[] }) {
  const stats = useMemo(() => {
    let total = 0, verified = 0, agentPass = 0, operatorPass = 0
    for (const g of groups) {
      for (const uc of g.use_cases) {
        if (!uc.built) continue
        total++
        if (uc.agent_status === 'pass') agentPass++
        if (uc.operator_status === 'pass') operatorPass++
        if (uc.agent_status === 'pass' && uc.operator_status === 'pass') verified++
      }
    }
    return { total, verified, agentPass, operatorPass, pct: total > 0 ? Math.round((verified / total) * 100) : 0 }
  }, [groups])

  const barColor = stats.pct >= 80 ? '#1D9E75' : stats.pct >= 50 ? '#BA7517' : '#ef4444'

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold text-white">QA Verification</h1>
        <p className="text-[10px] text-muted mt-0.5">
          Agent: {stats.agentPass}/{stats.total} · Operator: {stats.operatorPass}/{stats.total}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-40 h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.pct}%`, backgroundColor: barColor }}
          />
        </div>
        <span className="text-sm font-mono font-bold" style={{ color: barColor }}>
          {stats.verified}/{stats.total}
        </span>
      </div>
    </div>
  )
}

// ── Status Dots ────────────────────────────────────────────────────────

function StatusDots({ useCases, type }: { useCases: UseCase[]; type: 'agent' | 'operator' }) {
  return (
    <div className="flex items-center gap-0.5">
      {useCases.filter(uc => uc.built).map(uc => (
        <div
          key={uc.id}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: DOT_COLOR[type === 'agent' ? uc.agent_status : uc.operator_status] }}
        />
      ))}
    </div>
  )
}

// ── Use Case Row ───────────────────────────────────────────────────────

function UseCaseRow({ uc, onMark, onReset }: {
  uc: UseCase
  onMark: (id: string, status: 'pass' | 'fail', notes?: string) => void
  onReset: (id: string) => void
}) {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [copied, setCopied] = useState(false)

  function copyPrompt() {
    navigator.clipboard.writeText(uc.test_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleFail() {
    setShowNoteInput(true)
  }

  function submitFail() {
    onMark(uc.id, 'fail', noteText || undefined)
    setShowNoteInput(false)
    setNoteText('')
  }

  const agentS = STATUS_ICON[uc.agent_status]
  const opS = STATUS_ICON[uc.operator_status]
  const hasResult = uc.operator_status !== 'untested' || uc.agent_status !== 'untested'

  function fmtDate(iso: string | null) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className={`px-4 py-2.5 border-b border-border/50 ${!uc.built ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-white">{uc.name}</div>
          <div className="text-[10px] text-muted mt-0.5 font-mono truncate">"{uc.test_prompt}"</div>
          {(uc.agent_notes || uc.operator_notes) && (
            <div className="mt-1.5 space-y-0.5">
              {uc.agent_notes && (
                <div className="text-[10px] text-muted"><span className="text-white/50">Agent:</span> {uc.agent_notes}</div>
              )}
              {uc.operator_notes && (
                <div className="text-[10px] text-muted"><span className="text-white/50">Operator:</span> {uc.operator_notes}</div>
              )}
            </div>
          )}
          {uc.review_fix_id && (
            <div className="text-[10px] mt-1" style={{ color: '#ef4444' }}>
              → Review #{uc.review_fix_id}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-center w-16">
            <div className="text-[9px] text-muted mb-0.5">Agent</div>
            <span className="text-sm font-mono" style={{ color: agentS.color }}>{agentS.icon}</span>
            {uc.agent_tested_at && (
              <div className="text-[8px] text-muted mt-0.5">{fmtDate(uc.agent_tested_at)}</div>
            )}
          </div>

          <div className="text-center w-16">
            <div className="text-[9px] text-muted mb-0.5">Operator</div>
            <span className="text-sm font-mono" style={{ color: opS.color }}>{opS.icon}</span>
            {uc.operator_tested_at && (
              <div className="text-[8px] text-muted mt-0.5">{fmtDate(uc.operator_tested_at)}</div>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-36 justify-end">
            <button
              onClick={copyPrompt}
              className="text-[9px] px-2 py-1 rounded border border-border text-muted hover:text-white hover:border-white/20 transition-colors"
            >
              {copied ? 'Copied' : 'Copy Prompt'}
            </button>
            {uc.built && uc.operator_status === 'untested' && (
              <>
                <button
                  onClick={() => onMark(uc.id, 'pass')}
                  className="text-[9px] px-2 py-1 rounded border border-green-800/50 text-green-400 hover:bg-green-500/10 transition-colors"
                >
                  PASS
                </button>
                <button
                  onClick={handleFail}
                  className="text-[9px] px-2 py-1 rounded border border-red-800/50 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  FAIL
                </button>
              </>
            )}
            {uc.built && hasResult && (
              <button
                onClick={() => onReset(uc.id)}
                className="text-[9px] px-2 py-1 rounded border border-border text-muted hover:text-white transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {showNoteInput && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitFail()}
            placeholder="What went wrong?"
            className="flex-1 text-[11px] px-3 py-1.5 rounded border border-red-800/30 bg-red-500/5 text-white placeholder-muted outline-none focus:border-red-500/50"
          />
          <button
            onClick={submitFail}
            className="text-[9px] px-3 py-1.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
          >
            Submit Fail
          </button>
          <button
            onClick={() => { setShowNoteInput(false); setNoteText('') }}
            className="text-[9px] px-2 py-1.5 text-muted hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Group Card ─────────────────────────────────────────────────────────

function GroupCard({ group, onMark, onReset }: {
  group: Group
  onMark: (id: string, status: 'pass' | 'fail', notes?: string) => void
  onReset: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const builtUcs = group.use_cases.filter(uc => uc.built)
  const verified = builtUcs.filter(uc => uc.agent_status === 'pass' && uc.operator_status === 'pass').length
  const hasFail = builtUcs.some(uc => uc.agent_status === 'fail' || uc.operator_status === 'fail')
  const allVerified = builtUcs.length > 0 && verified === builtUcs.length
  const allNotBuilt = builtUcs.length === 0

  const borderColor = allNotBuilt ? '#888780' : allVerified ? '#1D9E75' : hasFail ? '#ef4444' : '#1A2B28'

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-surface hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted">{expanded ? '▾' : '▸'}</span>
          <span className="text-[12px] font-semibold text-white">{group.name}</span>
          <span className="text-[10px] font-mono text-muted">{group.use_cases.length} use cases</span>
        </div>
        <div className="flex items-center gap-4">
          {builtUcs.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted">Agent</span>
                <StatusDots useCases={group.use_cases} type="agent" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted">Operator</span>
                <StatusDots useCases={group.use_cases} type="operator" />
              </div>
              <span className="text-[10px] font-mono" style={{ color: allVerified ? '#1D9E75' : '#9BAAA6' }}>
                {verified}/{builtUcs.length}
              </span>
            </>
          )}
          {allNotBuilt && (
            <span className="text-[9px] font-bold tracking-wider text-muted uppercase">Not built</span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/50">
          {group.use_cases.map(uc => (
            <UseCaseRow key={uc.id} uc={uc} onMark={onMark} onReset={onReset} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Not Built Summary ──────────────────────────────────────────────────

function NotBuiltSummary({ groups }: { groups: Group[] }) {
  const notBuiltGroups = groups.filter(g => g.use_cases.some(uc => !uc.built))
  const notBuiltCount = groups.reduce((sum, g) => sum + g.use_cases.filter(uc => !uc.built).length, 0)

  if (notBuiltCount === 0) return null

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="text-[10px] font-bold tracking-wider text-muted uppercase mb-2">
        Not Built ({notBuiltCount} use cases)
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {notBuiltGroups.map(g => {
          const nb = g.use_cases.filter(uc => !uc.built)
          const scopes = [...new Set(nb.map(uc => uc.scope))]
          return (
            <div key={g.id} className="text-[10px] text-muted">
              <span className="text-white/60">{g.name}</span> ({nb.length}) · {scopes.join(', ')}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Open Sessions ──────────────────────────────────────────────────────

interface SessionCheckItem {
  label: string
  done: boolean
  checked_at: string | null
}

interface Session {
  id: string
  lane: string
  title: string
  status: string
  checklist: SessionCheckItem[]
  fixes: { label: string; severity: string; task_id: string | null }[]
  created_at: string
  updated_at: string
}

function SessionCard({ session, onToggleCheck, onDelete }: {
  session: Session
  onToggleCheck: (sessionId: string, idx: number) => void
  onDelete: (sessionId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const doneCount = session.checklist.filter(c => c.done).length
  const totalCount = session.checklist.length
  const pendingFixes = (session.fixes ?? []).filter(f => !f.task_id).length

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-surface hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted">{expanded ? '▾' : '▸'}</span>
          <span className="text-[12px] font-medium text-white">{session.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-[10px] font-mono text-muted">{doneCount}/{totalCount} checked</span>
          )}
          {pendingFixes > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
              {pendingFixes} fixes
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3">
          {totalCount > 0 && (
            <>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted font-mono">{doneCount}/{totalCount}</span>
              </div>
              <div className="space-y-1.5">
                {session.checklist.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); onToggleCheck(session.id, idx) }}
                    className="flex items-start gap-2 w-full text-left group/item"
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-px ${
                      item.done
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'border-border group-hover/item:border-muted'
                    }`}>
                      {item.done && (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-6" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[11px] leading-tight ${item.done ? 'text-muted line-through' : 'text-white/80'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {totalCount === 0 && (
            <p className="text-[10px] text-muted">No checklist items. Fixes from this session appear in the Fixes inbox below.</p>
          )}

          <div className="mt-3 pt-2 border-t border-border/50">
            {!showConfirm ? (
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfirm(true) }}
                className="text-[9px] text-muted hover:text-red-400 transition-colors"
              >
                Delete session
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">Delete this session?</span>
                <button onClick={(e) => { e.stopPropagation(); onDelete(session.id) }} className="text-[10px] font-semibold text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-400/10 transition-colors">Yes</button>
                <button onClick={(e) => { e.stopPropagation(); setShowConfirm(false) }} className="text-[10px] font-semibold text-muted hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors">No</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NewSessionInput({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 rounded-lg border border-dashed border-border text-[10px] text-muted font-semibold tracking-wider hover:border-accent/40 hover:text-accent-light transition-colors"
      >
        + New Session
      </button>
    )
  }

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value)
      setValue('')
      setOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') { setValue(''); setOpen(false) }
        }}
        placeholder="Name this session..."
        className="flex-1 text-[11px] px-3 py-1.5 rounded-md bg-dark border border-border text-white placeholder:text-muted/50 outline-none focus:border-accent/40 transition-colors"
      />
      <button onClick={handleSubmit} className="text-[10px] font-semibold text-accent-light hover:text-accent px-2 py-1.5 rounded-md hover:bg-accent/10 transition-colors">Add</button>
      <button onClick={() => { setValue(''); setOpen(false) }} className="text-[10px] text-muted hover:text-white px-1.5 py-1.5 transition-colors">✕</button>
    </div>
  )
}

function OpenSessions({ sessions, updateTracker }: {
  sessions: Session[]
  updateTracker: (updater: (draft: TrackerState) => void) => void
}) {
  const toggleCheck = (sessionId: string, idx: number) => {
    updateTracker((draft: TrackerState) => {
      const session = (draft.review_sessions ?? []).find((s: any) => s.id === sessionId)
      if (!session || idx < 0 || idx >= session.checklist.length) return
      session.checklist[idx].done = !session.checklist[idx].done
      session.checklist[idx].checked_at = session.checklist[idx].done ? new Date().toISOString() : null
      session.updated_at = new Date().toISOString()
    })
  }

  const deleteSession = (id: string) => {
    updateTracker((draft: TrackerState) => {
      draft.review_sessions = (draft.review_sessions ?? []).filter((s: any) => s.id !== id)
    })
  }

  const addSession = (title: string) => {
    if (!title.trim()) return
    const id = `review-session-${Date.now()}`
    updateTracker((draft: TrackerState) => {
      if (!draft.review_sessions) draft.review_sessions = []
      draft.review_sessions.push({
        id, lane: 'backend' as any, title: title.trim(), status: 'not_started' as any, area: title.trim(),
        checklist: [], fixes: [], priority: null as any,
        source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } as any)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-bold tracking-wider text-white/50 uppercase">Open Sessions</h2>
          <span className="text-[10px] font-mono text-muted">{sessions.length}</span>
        </div>
      </div>
      <div className="space-y-2">
        {sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            onToggleCheck={toggleCheck}
            onDelete={deleteSession}
          />
        ))}
        <NewSessionInput onSubmit={addSession} />
      </div>
    </div>
  )
}

// ── Fixes Section ─────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string; sort: number }> = {
  critical: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'CRITICAL', sort: 0 },
  major: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'MAJOR', sort: 1 },
  minor: { bg: 'rgba(155,155,170,0.12)', text: '#9B9BAA', label: 'MINOR', sort: 2 },
}

interface AggregatedFix {
  label: string
  severity: 'critical' | 'major' | 'minor'
  task_id: string | null
  task_done: boolean
  session_title: string
  session_id: string
}

const MILESTONE_ID = 'debug_review'

function FixesSection({ sessions, milestones, updateTracker }: {
  sessions: { id: string; title: string; fixes?: { label: string; severity: string; task_id: string | null }[] }[]
  milestones: { id: string; subtasks: { id: string; done: boolean }[] }[]
  updateTracker: (updater: (draft: TrackerState) => void) => void
}) {
  // Build a set of done task IDs for quick lookup
  const doneTaskIds = new Set<string>()
  for (const ms of milestones) {
    for (const task of ms.subtasks) {
      if (task.done) doneTaskIds.add(task.id)
    }
  }
  const allFixes: (AggregatedFix & { fixIndex: number })[] = []
  for (const session of sessions) {
    for (let fi = 0; fi < (session.fixes ?? []).length; fi++) {
      const fix = session.fixes![fi]
      allFixes.push({
        label: fix.label,
        severity: (fix.severity as AggregatedFix['severity']) || 'major',
        task_id: fix.task_id,
        task_done: fix.task_id ? doneTaskIds.has(fix.task_id) : false,
        session_title: session.title,
        session_id: session.id,
        fixIndex: fi,
      })
    }
  }

  // Sort: critical first, then major, then minor
  allFixes.sort((a, b) => (SEVERITY_STYLES[a.severity]?.sort ?? 1) - (SEVERITY_STYLES[b.severity]?.sort ?? 1))

  const completed = allFixes.filter(f => f.task_done)
  const promoted = allFixes.filter(f => f.task_id && !f.task_done)
  const pending = allFixes.filter(f => !f.task_id)

  const promoteFix = (sessionId: string, fixIndex: number) => {
    updateTracker(draft => {
      const milestone = draft.milestones.find(m => m.id === MILESTONE_ID)
      if (!milestone) return
      const session = (draft.review_sessions ?? []).find(s => s.id === sessionId)
      if (!session?.fixes?.[fixIndex]) return
      const fix = session.fixes[fixIndex]
      if (fix.task_id) return // already promoted

      const idPattern = new RegExp(`^${MILESTONE_ID}_(\\d+)$`)
      const existingNums = milestone.subtasks
        .map((s: { id: string }) => s.id.match(idPattern))
        .filter(Boolean)
        .map((m: RegExpMatchArray) => parseInt(m[1], 10))
      const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1
      const taskNum = String(nextNum).padStart(3, '0')
      const taskId = `${MILESTONE_ID}_${taskNum}`
      const priorityMap: Record<string, string> = { critical: 'P1', major: 'P2', minor: 'P3' }

      const laneLabel = (session as any).lane === 'ui' ? 'UI' : (session as any).lane === 'ux' ? 'UX' : 'Backend'
      const notes = [
        `[${laneLabel}] From: ${session.title}`,
        `Severity: ${fix.severity}`,
        ``,
        `## Verification`,
        `After fixing, the agent MUST verify the fix before completing the task.`,
        ``,
        `### Self-verification (agent does this)`,
        `For prompt/response issues, classifier bugs, handler routing, or backend logic:`,
        `- Send a test prompt via the dev test bypass (POST to /api/chat with X-Test-Bypass: local)`,
        `- Monitor the streamed response and server logs`,
        `- Confirm the classifier output (domain, verb, confidence)`,
        `- Confirm the handler produced the expected response`,
        `- Record the test prompt sent, the classifier result, and the response summary`,
        ``,
        `For build/type/lint issues:`,
        `- Run npm run build && npm run typecheck && npm run lint`,
        `- Confirm all pass`,
        ``,
        `### Operator verification (only if needed)`,
        `If the fix involves visual UI, layout, or browser-only behavior that cannot be verified via API:`,
        `- Describe what the operator should look at (page, element, interaction)`,
        `- Describe the expected vs previous behavior`,
      ].join('\n')

      milestone.subtasks.push({
        id: taskId,
        label: fix.label,
        status: 'todo',
        done: false,
        assignee: null,
        blocked_by: null,
        blocked_reason: null,
        completed_at: null,
        completed_by: null,
        priority: priorityMap[fix.severity] ?? 'P2',
        notes,
        prompt: null,
        context_files: [],
        reference_docs: [],
        acceptance_criteria: [],
        constraints: [],
        agent_target: null,
        execution_mode: 'agent',
        depends_on: [],
        last_run_id: null,
        pipeline: null,
        builder_prompt: null,
      } as never)

      fix.task_id = taskId
      session.updated_at = new Date().toISOString()
    })
  }

  const closeFix = (sessionId: string, fixIndex: number) => {
    updateTracker(draft => {
      const session = (draft.review_sessions ?? []).find(s => s.id === sessionId)
      if (!session?.fixes?.[fixIndex]) return

      session.fixes.splice(fixIndex, 1)
      session.updated_at = new Date().toISOString()

      const removedFixId = `${sessionId}:fix-${fixIndex}`
      for (const group of draft.qa?.groups ?? []) {
        for (const useCase of group.use_cases ?? []) {
          if (!useCase.review_fix_id?.startsWith(`${sessionId}:fix-`)) continue

          if (useCase.review_fix_id === removedFixId) {
            useCase.review_fix_id = null
            continue
          }

          const match = useCase.review_fix_id.match(new RegExp(`^${sessionId}:fix-(\\d+)$`))
          if (!match) continue

          const currentIndex = parseInt(match[1], 10)
          if (currentIndex > fixIndex) {
            useCase.review_fix_id = `${sessionId}:fix-${currentIndex - 1}`
          }
        }
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold tracking-wider text-white">FIXES</h2>
          {allFixes.length > 0 && (
            <span className="text-[10px] font-mono text-muted">
              {pending.length} pending{promoted.length > 0 ? ` / ${promoted.length} in progress` : ''}{completed.length > 0 ? ` / ${completed.length} done` : ''}
            </span>
          )}
        </div>
        {pending.length > 0 && (
          <span className="text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400">
            {pending.length} AWAITING TASK BOARD
          </span>
        )}
      </div>

      {allFixes.length === 0 ? (
        <p className="text-[11px] text-muted">No fixes found yet. Fixes appear here when review tests fail.</p>
      ) : (
        <div className="space-y-2">
          {allFixes.map((fix, idx) => {
            const sev = SEVERITY_STYLES[fix.severity] ?? SEVERITY_STYLES.major
            return (
              <div
                key={`${fix.session_id}-${fix.fixIndex}-${idx}`}
                className={`group/fix flex items-start gap-3 rounded-lg border p-3 ${
                  fix.task_done
                    ? 'border-border/30 bg-dark/20 opacity-50'
                    : fix.task_id
                      ? 'border-border/50 bg-dark/30 opacity-70'
                      : 'border-border bg-dark'
                }`}
              >
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                    style={{ backgroundColor: sev.bg, color: sev.text }}
                  >
                    {fix.task_done ? 'DONE' : sev.label}
                  </span>
                  {fix.task_id ? (
                    <span className="text-[8px] font-mono text-accent">{fix.task_id}</span>
                  ) : (
                    <button
                      onClick={() => promoteFix(fix.session_id, fix.fixIndex)}
                      className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent-light hover:bg-accent/20 hover:text-accent transition-colors"
                      title="Push to task board"
                    >
                      Push
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] leading-snug ${fix.task_done ? 'text-muted line-through' : 'text-white/90'}`}>{fix.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-muted truncate">{fix.session_title}</span>
                  </div>
                </div>
                <button
                  onClick={() => closeFix(fix.session_id, fix.fixIndex)}
                  className="flex-shrink-0 text-[9px] font-semibold px-2 py-1 rounded-md border border-border/60 text-muted hover:text-white hover:border-border transition-colors"
                  title="Remove this fix from the inbox"
                >
                  Close
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────────────────

export function QAView() {
  const { tracker, updateTracker } = useStore()
  const groups: Group[] = (tracker?.qa?.groups ?? []) as Group[]
  const sessions: Session[] = (tracker?.review_sessions ?? []) as Session[]

  const builtGroups = groups.filter(g => g.use_cases.some(uc => uc.built))

  function handleMark(useCaseId: string, status: 'pass' | 'fail', notes?: string) {
    updateTracker((draft: TrackerState) => {
      for (const group of (draft as any).qa.groups) {
        const uc = group.use_cases.find((u: UseCase) => u.id === useCaseId)
        if (uc) {
          uc.operator_status = status
          uc.operator_tested_at = new Date().toISOString()
          if (notes) uc.operator_notes = notes

          if (status === 'fail') {
            if (!draft.review_sessions) draft.review_sessions = []
            let qaSession = draft.review_sessions.find((s: any) => s.id === 'qa_failures')
            if (!qaSession) {
              qaSession = {
                id: 'qa_failures', lane: 'backend' as any, title: 'QA Failures',
                status: 'in_progress' as any, area: 'QA Verification',
                checklist: [], fixes: [], priority: 'P1' as any,
                source: 'qa_tab', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              } as any
              draft.review_sessions.push(qaSession)
            }
            if (!qaSession.fixes) qaSession.fixes = []
            qaSession.fixes.push({
              label: `QA: ${uc.name} — operator fail${notes ? ': ' + notes : ''}`,
              severity: 'major' as any,
              task_id: null,
              created_at: new Date().toISOString(),
            })
            qaSession.updated_at = new Date().toISOString()
            uc.review_fix_id = `qa_failures:fix-${qaSession.fixes.length - 1}`
          }
          break
        }
      }
    })
  }

  function handleReset(useCaseId: string) {
    updateTracker((draft: TrackerState) => {
      for (const group of (draft as any).qa.groups) {
        const uc = group.use_cases.find((u: UseCase) => u.id === useCaseId)
        if (uc) {
          uc.agent_status = 'untested'
          uc.agent_tested_at = null
          uc.agent_notes = null
          uc.operator_status = 'untested'
          uc.operator_tested_at = null
          uc.operator_notes = null
          uc.review_fix_id = null
          break
        }
      }
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border bg-dark">
        <ReadinessBar groups={groups} />
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Section 1: Use Case Verification */}
        <div className="space-y-2">
          {builtGroups.map(group => (
            <GroupCard key={group.id} group={group} onMark={handleMark} onReset={handleReset} />
          ))}
          <NotBuiltSummary groups={groups} />
        </div>

        {/* Section 2: Open Sessions */}
        <OpenSessions sessions={sessions} updateTracker={updateTracker} />

        {/* Section 3: Fixes Inbox */}
        <FixesSection
          sessions={sessions}
          milestones={tracker?.milestones ?? []}
          updateTracker={updateTracker}
        />
      </div>
    </div>
  )
}
