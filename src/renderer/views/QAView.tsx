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

// ── Main View ──────────────────────────────────────────────────────────

export function QAView() {
  const { tracker, updateTracker } = useStore()
  const groups: Group[] = (tracker?.qa?.groups ?? []) as Group[]

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
                id: 'qa_failures', lane: 'backend' as const, title: 'QA Failures',
                status: 'in_progress' as const, area: 'QA Verification',
                checklist: [], fixes: [], priority: 'P1' as const,
                source: 'qa_tab', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              }
              draft.review_sessions.push(qaSession)
            }
            if (!qaSession.fixes) qaSession.fixes = []
            qaSession.fixes.push({
              label: `QA: ${uc.name} — operator fail${notes ? ': ' + notes : ''}`,
              severity: 'major' as const,
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
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {builtGroups.map(group => (
          <GroupCard key={group.id} group={group} onMark={handleMark} onReset={handleReset} />
        ))}
        <NotBuiltSummary groups={groups} />
      </div>
    </div>
  )
}
