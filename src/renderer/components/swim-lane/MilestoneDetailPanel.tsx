import { useState, useMemo } from 'react'
import type { Milestone, ChecklistCategory } from '../../../main/parser'
import { useStore, selectMilestoneProgress, selectCategoryProgress } from '../../store'

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  todo: { label: 'TO DO', color: '#9B9BAA' },
  in_progress: { label: 'IN PROGRESS', color: '#585CF0' },
  review: { label: 'REVIEW', color: '#f59e0b' },
  done: { label: 'DONE', color: '#22c55e' },
  blocked: { label: 'BLOCKED', color: '#ef4444' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z')
  const db = new Date(b + 'T00:00:00Z')
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function findDownstream(milestoneId: string, milestones: Milestone[]): Milestone[] {
  const result: Milestone[] = []
  const visited = new Set<string>()
  const queue = [milestoneId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const m of milestones) {
      if (m.dependencies.includes(current) && !visited.has(m.id)) {
        result.push(m)
        queue.push(m.id)
      }
    }
  }

  return result
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PanelTarget =
  | { type: 'milestone'; id: string }
  | { type: 'category'; id: string }

interface PanelProps {
  target: PanelTarget
  onClose: () => void
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function MilestoneDetailPanel({ target, onClose }: PanelProps) {
  const tracker = useStore((s) => s.tracker)!

  if (target.type === 'milestone') {
    const milestone = tracker.milestones.find((m) => m.id === target.id)
    if (!milestone) return null
    return <MilestoneView milestone={milestone} onClose={onClose} />
  } else {
    const category = tracker.submission_checklist.categories.find((c) => c.id === target.id)
    if (!category) return null
    return <CategoryView category={category} onClose={onClose} />
  }
}

// ─── Milestone View ───────────────────────────────────────────────────────────

function MilestoneView({
  milestone,
  onClose,
}: {
  milestone: Milestone
  onClose: () => void
}) {
  const tracker = useStore((s) => s.tracker)!
  const updateTracker = useStore((s) => s.updateTracker)

  const [editStart, setEditStart] = useState(milestone.planned_start)
  const [editEnd, setEditEnd] = useState(milestone.planned_end)
  const [showRipple, setShowRipple] = useState(false)
  const [newNote, setNewNote] = useState('')

  const { done, total, pct } = selectMilestoneProgress(milestone)
  const color = DOMAIN_COLORS[milestone.domain] || '#9B9BAA'

  const downstream = useMemo(
    () => findDownstream(milestone.id, tracker.milestones),
    [milestone.id, tracker.milestones],
  )

  const startDelta = daysBetween(milestone.planned_start, editStart)
  const endDelta = daysBetween(milestone.planned_end, editEnd)
  const hasDateChange = startDelta !== 0 || endDelta !== 0

  const depMilestones = useMemo(
    () =>
      milestone.dependencies
        .map((depId) => tracker.milestones.find((m) => m.id === depId))
        .filter(Boolean) as Milestone[],
    [milestone.dependencies, tracker.milestones],
  )

  function toggleSubtask(subtaskId: string) {
    updateTracker((draft) => {
      const m = draft.milestones.find((m) => m.id === milestone.id)
      if (!m) return
      const s = m.subtasks.find((s) => s.id === subtaskId)
      if (!s) return
      s.done = !s.done
      s.status = s.done ? 'done' : 'todo'
      s.completed_at = s.done ? new Date().toISOString() : null
    })
  }

  function applyDateChange() {
    updateTracker((draft) => {
      const m = draft.milestones.find((m) => m.id === milestone.id)
      if (!m) return
      m.planned_start = editStart
      m.planned_end = editEnd

      // Ripple effect: shift all downstream by the start delta
      if (startDelta !== 0) {
        for (const down of downstream) {
          const dm = draft.milestones.find((x) => x.id === down.id)
          if (!dm) continue
          dm.planned_start = shiftDate(dm.planned_start, startDelta)
          dm.planned_end = shiftDate(dm.planned_end, startDelta)
        }
      }
    })
    setShowRipple(false)
  }

  function addNote() {
    if (!newNote.trim()) return
    updateTracker((draft) => {
      const m = draft.milestones.find((m) => m.id === milestone.id)
      if (!m) return
      m.notes.push(newNote.trim())
    })
    setNewNote('')
  }

  const driftLabel = milestone.drift_days === 0
    ? null
    : milestone.drift_days > 0
      ? { text: `${milestone.drift_days} DAY${milestone.drift_days !== 1 ? 'S' : ''} BEHIND`, color: '#ef4444' }
      : { text: `${Math.abs(milestone.drift_days)} DAY${Math.abs(milestone.drift_days) !== 1 ? 'S' : ''} AHEAD`, color: '#22c55e' }

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      {/* Header */}
      <div className="flex-shrink-0 p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                style={{ color, backgroundColor: color + '18' }}
              >
                {milestone.domain.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="text-[10px] text-muted font-mono">W{milestone.week}</span>
              {milestone.is_key_milestone && milestone.key_milestone_label && (
                <span className="text-[10px] font-semibold" style={{ color }}>
                  ★ {milestone.key_milestone_label}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-white leading-tight">{milestone.title}</h3>
            {milestone.notes.length > 0 && (
              <p className="text-xs text-muted mt-1 line-clamp-2">{milestone.notes[0]}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-white hover:bg-white/8 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted font-mono">
              {done}/{total} subtasks
            </span>
            <span className="text-[10px] font-bold font-mono" style={{ color }}>
              {pct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Schedule section */}
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">SCHEDULE</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted/70 block mb-1">Planned Start</label>
              <input
                type="date"
                value={editStart}
                onChange={(e) => {
                  setEditStart(e.target.value)
                  setShowRipple(true)
                }}
                className="w-full bg-dark border border-border rounded px-2 py-1.5 text-[11px] text-white font-mono focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted/70 block mb-1">Planned End</label>
              <input
                type="date"
                value={editEnd}
                onChange={(e) => {
                  setEditEnd(e.target.value)
                  setShowRipple(true)
                }}
                className="w-full bg-dark border border-border rounded px-2 py-1.5 text-[11px] text-white font-mono focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted/70 block mb-1">Actual Start</label>
              <div className="text-[11px] text-muted font-mono px-2 py-1.5">
                {milestone.actual_start || '—'}
              </div>
            </div>
            <div>
              <label className="text-[9px] text-muted/70 block mb-1">Actual End</label>
              <div className="text-[11px] text-muted font-mono px-2 py-1.5">
                {milestone.actual_end || '—'}
              </div>
            </div>
          </div>

          {/* Drift indicator */}
          {driftLabel && (
            <div
              className="mt-2 px-2 py-1 rounded text-[10px] font-bold"
              style={{ color: driftLabel.color, backgroundColor: driftLabel.color + '15' }}
            >
              {driftLabel.text}
            </div>
          )}

          {/* Ripple effect warning */}
          {hasDateChange && showRipple && downstream.length > 0 && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/8 p-3">
              <div className="text-[10px] font-bold text-accent-light mb-1.5">
                Ripple Effect — {downstream.length} milestone{downstream.length !== 1 ? 's' : ''} affected
              </div>
              <div className="space-y-1 mb-3">
                {downstream.map((dm) => {
                  const { done: dd, total: dt } = selectMilestoneProgress(dm)
                  return (
                    <div key={dm.id} className="flex items-center gap-2 text-[10px]">
                      <span className="text-muted">→</span>
                      <span className="text-white/80 truncate">{dm.title}</span>
                      <span className="text-muted font-mono ml-auto flex-shrink-0">
                        {dd}/{dt}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="text-[9px] text-muted mb-2">
                Shifting by {startDelta > 0 ? '+' : ''}{startDelta} day{Math.abs(startDelta) !== 1 ? 's' : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyDateChange}
                  className="px-3 py-1 bg-accent text-white text-[10px] font-bold rounded hover:bg-accent-light transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setEditStart(milestone.planned_start)
                    setEditEnd(milestone.planned_end)
                    setShowRipple(false)
                  }}
                  className="px-3 py-1 bg-white/8 text-muted text-[10px] font-bold rounded hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Apply if no downstream */}
          {hasDateChange && (downstream.length === 0 || !showRipple) && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  if (downstream.length > 0) {
                    setShowRipple(true)
                  } else {
                    applyDateChange()
                  }
                }}
                className="px-3 py-1 bg-accent text-white text-[10px] font-bold rounded hover:bg-accent-light transition-colors"
              >
                Save Dates
              </button>
              <button
                onClick={() => {
                  setEditStart(milestone.planned_start)
                  setEditEnd(milestone.planned_end)
                  setShowRipple(false)
                }}
                className="px-3 py-1 bg-white/8 text-muted text-[10px] font-bold rounded hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </section>

        {/* Sub-tasks checklist */}
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">
            SUB-TASKS ({done}/{total})
          </h4>
          <div className="space-y-0.5">
            {milestone.subtasks.map((s) => {
              const statusInfo = STATUS_LABELS[s.status] || STATUS_LABELS.todo
              return (
                <div
                  key={s.id}
                  className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-white/4 ${
                    s.done ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleSubtask(s.id)}
                    className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
                      s.done
                        ? 'bg-on-track/20 border-on-track'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    {s.done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4 7.5L8 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] leading-relaxed ${s.done ? 'line-through text-muted' : 'text-white/90'}`}>
                      {s.label}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.assignee && (
                        <span className="text-[8px] font-medium px-1.5 py-0.5 rounded bg-white/6 text-muted">
                          {s.assignee}
                        </span>
                      )}
                      {s.blocked_by && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-behind/15 text-behind">
                          BLOCKED
                        </span>
                      )}
                      <span
                        className="text-[8px] font-bold px-1 py-0.5 rounded"
                        style={{ color: statusInfo.color, backgroundColor: statusInfo.color + '15' }}
                      >
                        {s.priority}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Dependencies */}
        {depMilestones.length > 0 && (
          <section>
            <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">
              DEPENDENCIES ({depMilestones.length})
            </h4>
            <div className="space-y-1.5">
              {depMilestones.map((dep) => {
                const { done: dd, total: dt, pct: dp } = selectMilestoneProgress(dep)
                const depColor = DOMAIN_COLORS[dep.domain] || '#9B9BAA'
                return (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-white/3 border border-white/5"
                  >
                    {/* Mini progress ring */}
                    <svg width="24" height="24" viewBox="0 0 24 24" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                      <circle
                        cx="12" cy="12" r="9" fill="none" stroke={depColor} strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={`${(dp / 100) * 56.55} 56.55`}
                        transform="rotate(-90 12 12)"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-white/80 truncate">{dep.title}</div>
                      <div className="text-[9px] text-muted font-mono">{dd}/{dt}</div>
                    </div>
                    <span className="text-[9px] text-muted font-mono flex-shrink-0">W{dep.week}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Notes */}
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">NOTES</h4>
          {milestone.notes.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {milestone.notes.map((note, i) => (
                <div key={i} className="text-[11px] text-white/70 px-2.5 py-2 rounded-md bg-white/3 leading-relaxed">
                  {note}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 bg-dark border border-border rounded px-2.5 py-2 text-[11px] text-white placeholder-muted/50 focus:border-accent focus:outline-none resize-none"
            />
            <button
              onClick={addNote}
              disabled={!newNote.trim()}
              className="self-end px-3 py-1.5 bg-accent text-white text-[10px] font-bold rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent-light transition-colors"
            >
              Add
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Category View ────────────────────────────────────────────────────────────

function CategoryView({
  category,
  onClose,
}: {
  category: ChecklistCategory
  onClose: () => void
}) {
  const updateTracker = useStore((s) => s.updateTracker)
  const { done, total, pct } = selectCategoryProgress(category)
  const isCritical = category.risk_level === 'critical'
  const color = isCritical ? '#ef4444' : '#585CF0'

  function toggleItem(itemId: string) {
    updateTracker((draft) => {
      const cat = draft.submission_checklist.categories.find((c) => c.id === category.id)
      if (!cat) return
      const item = cat.items.find((i) => i.id === itemId)
      if (!item) return
      item.done = !item.done
      item.completed_at = item.done ? new Date().toISOString() : null
    })
  }

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      {/* Header */}
      <div className="flex-shrink-0 p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                style={{ color, backgroundColor: color + '18' }}
              >
                CHECKLIST
              </span>
              <span className="text-[10px] text-muted font-mono">Target W{category.target_week}</span>
              {isCritical && (
                <span className="text-[10px] font-bold text-behind">⚠ #1 REVIEW RISK</span>
              )}
            </div>
            <h3 className="text-base font-semibold text-white leading-tight">{category.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-white hover:bg-white/8 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted font-mono">{done}/{total} items</span>
            <span className="text-[10px] font-bold font-mono" style={{ color }}>{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-0.5">
          {category.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-white/4 ${
                item.done ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggleItem(item.id)}
                className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
                  item.done
                    ? 'bg-on-track/20 border-on-track'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                {item.done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5.5L4 7.5L8 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] leading-relaxed ${item.done ? 'line-through text-muted' : 'text-white/90'}`}>
                  {item.label}
                </div>
                {item.completed_at && (
                  <div className="text-[8px] text-muted font-mono mt-0.5">
                    Done {new Date(item.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
