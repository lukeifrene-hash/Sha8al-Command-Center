import { useMemo } from 'react'
import type { ChecklistCategory, Milestone, QAGroup, ReviewSession } from '../../../main/parser'
import { useStore, selectCategoryProgress, selectMilestoneProgress } from '../../store'
import {
  getDisplayDomainMeta,
  getDomainLane,
  getMilestoneAccentColor,
  normalizeQAGroupDomain,
  normalizeReviewSessionDomain,
} from '../../domainModel'
import { getQAHubSnapshot } from '../../qaHubModel'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  todo: { label: 'TO DO', color: '#9B9BAA' },
  in_progress: { label: 'IN PROGRESS', color: '#585CF0' },
  review: { label: 'REVIEW', color: '#F59E0B' },
  done: { label: 'DONE', color: '#22C55E' },
  blocked: { label: 'BLOCKED', color: '#EF4444' },
}

export type PanelTarget =
  | { type: 'milestone'; id: string }
  | { type: 'category'; id: string }
  | { type: 'qa_hub'; id: string }
  | { type: 'review_session'; id: string }
  | { type: 'qa_group'; id: string }

interface PanelProps {
  target: PanelTarget
  onClose: () => void
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="flex-shrink-0 ml-3 w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-white hover:bg-white/8 transition-colors"
    >
      ✕
    </button>
  )
}

export function MilestoneDetailPanel({ target, onClose }: PanelProps) {
  const tracker = useStore((s) => s.tracker)

  if (!tracker) return null

  if (target.type === 'milestone') {
    const milestone = tracker.milestones.find((m) => m.id === target.id)
    if (!milestone) return null
    return <MilestoneView milestone={milestone} onClose={onClose} />
  }

  if (target.type === 'review_session') {
    const session = (tracker.review_sessions ?? []).find((s) => s.id === target.id)
    if (!session) return null
    return <ReviewSessionView session={session} onClose={onClose} />
  }

  if (target.type === 'qa_group') {
    const group = (tracker.qa?.groups ?? []).find((g) => g.id === target.id)
    if (!group) return null
    return <QAGroupView group={group} onClose={onClose} />
  }

  if (target.type === 'qa_hub') {
    return <QAHubView onClose={onClose} />
  }

  const category = tracker.submission_checklist.categories.find((c) => c.id === target.id)
  if (!category) return null
  return <CategoryView category={category} onClose={onClose} />
}

function MilestoneView({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const tracker = useStore((s) => s.tracker)
  const milestones = tracker?.milestones ?? []
  const { done, total, pct } = selectMilestoneProgress(milestone)
  const displayDomain = getDisplayDomainMeta(milestone)
  const color = getMilestoneAccentColor(milestone)

  const depMilestones = useMemo(
    () =>
      milestone.dependencies
        .map((depId) => milestones.find((m) => m.id === depId))
        .filter(Boolean) as Milestone[],
    [milestone.dependencies, milestones],
  )

  // Drift/planned-date display removed post-pivot — the swimlane no longer
  // pretends to be a calendar. `actual_start` / `actual_end` remain visible
  // when populated by MCP start_task / approve_task. Timestamps otherwise
  // flow through the Calendar tab (completed_at) and Agent Hub (agent_log).
  const phaseLabel = milestone.phase.replace(/^phase_/, '').replace(/_/g, ' ').toUpperCase()
  const hasActualTimestamps = !!(milestone.actual_start || milestone.actual_end)

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="flex-shrink-0 p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider" style={{ color, backgroundColor: color + '18' }}>
                {displayDomain.label.toUpperCase()}
              </span>
              <span className="text-[10px] text-muted font-mono">Milestone</span>
            </div>
            <h3 className="text-base font-semibold text-white leading-tight">{milestone.title}</h3>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted font-mono">{done}/{total} subtasks</span>
            <span className="text-[10px] font-bold font-mono" style={{ color }}>{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">STATUS</h4>
          <div className="grid grid-cols-2 gap-2">
            <InfoField label="Phase" value={phaseLabel} />
            <InfoField
              label="Key Milestone"
              value={milestone.is_key_milestone ? (milestone.key_milestone_label || 'Yes') : 'No'}
              muted={!milestone.is_key_milestone}
            />
            {hasActualTimestamps && (
              <>
                <InfoField label="Started" value={milestone.actual_start || '—'} muted />
                <InfoField label="Completed" value={milestone.actual_end || '—'} muted />
              </>
            )}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">SUB-TASKS ({done}/{total})</h4>
          <div className="space-y-0.5">
            {milestone.subtasks.map((subtask) => {
              const statusInfo = STATUS_LABELS[subtask.status] || STATUS_LABELS.todo
              return (
                <div key={subtask.id} className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/4 ${subtask.done ? 'opacity-60' : ''}`}>
                  <div className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center ${subtask.done ? 'bg-on-track/20 border-on-track' : 'border-white/20'}`}>
                    {subtask.done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4 7.5L8 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] leading-relaxed ${subtask.done ? 'line-through text-muted' : 'text-white/90'}`}>{subtask.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {subtask.assignee && (
                        <span className="text-[8px] font-medium px-1.5 py-0.5 rounded bg-white/6 text-muted">{subtask.assignee}</span>
                      )}
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ color: statusInfo.color, backgroundColor: statusInfo.color + '15' }}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {depMilestones.length > 0 && (
          <section>
            <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">DEPENDENCIES ({depMilestones.length})</h4>
            <div className="space-y-1.5">
              {depMilestones.map((dep) => {
                const progress = selectMilestoneProgress(dep)
                const depColor = getMilestoneAccentColor(dep)
                return (
                  <div key={dep.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-white/3 border border-white/5">
                    <svg width="24" height="24" viewBox="0 0 24 24" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke={depColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={`${(progress.pct / 100) * 56.55} 56.55`}
                        transform="rotate(-90 12 12)"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-white/80 truncate">{dep.title}</div>
                      <div className="text-[9px] text-muted font-mono">{progress.done}/{progress.total}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">NOTES</h4>
          {milestone.notes.length > 0 ? (
            <div className="space-y-1.5">
              {milestone.notes.map((note, index) => (
                <div key={`${milestone.id}-note-${index}`} className="text-[11px] text-white/70 px-2.5 py-2 rounded-md bg-white/3 leading-relaxed">
                  {note}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted px-2.5 py-2 rounded-md bg-white/3">No notes recorded.</div>
          )}
        </section>
      </div>
    </div>
  )
}

function ReviewSessionView({ session, onClose }: { session: ReviewSession; onClose: () => void }) {
  const tracker = useStore((s) => s.tracker)
  const domainLane = getDomainLane(normalizeReviewSessionDomain(session))
  const checklistDone = session.checklist.filter((item) => item.done).length
  const checklistTotal = session.checklist.length
  const taskStates = new Map<string, boolean>()

  for (const milestone of tracker?.milestones ?? []) {
    for (const subtask of milestone.subtasks) {
      taskStates.set(subtask.id, subtask.done)
    }
  }

  const pendingFixes = (session.fixes ?? []).filter((fix) => !fix.task_id).length
  const linkedFixes = (session.fixes ?? []).filter((fix) => !!fix.task_id).length
  const completedLinkedFixes = (session.fixes ?? []).filter((fix) => fix.task_id && taskStates.get(fix.task_id)).length

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="flex-shrink-0 p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider" style={{ color: domainLane.color, backgroundColor: domainLane.color + '18' }}>
                {domainLane.label.toUpperCase()}
              </span>
              <span className="text-[10px] text-muted font-mono">{session.lane.toUpperCase()} SESSION</span>
            </div>
            <h3 className="text-base font-semibold text-white leading-tight">{session.title}</h3>
            <p className="text-[11px] text-muted mt-1">Status: {session.status.replace(/_/g, ' ')}</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">SESSION STATUS</h4>
          <div className="grid grid-cols-2 gap-2">
            <InfoField label="Checklist" value={`${checklistDone}/${checklistTotal}`} />
            <InfoField label="Pending Fixes" value={String(pendingFixes)} />
            <InfoField label="Linked Fixes" value={String(linkedFixes)} muted />
            <InfoField label="Completed Linked Fixes" value={String(completedLinkedFixes)} muted />
          </div>
        </section>

        {session.checklist.length > 0 && (
          <section>
            <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">CHECKLIST</h4>
            <div className="space-y-1.5">
              {session.checklist.map((item, index) => (
                <div key={`${session.id}-check-${index}`} className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-white/3 ${item.done ? 'opacity-60' : ''}`}>
                  <div className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center ${item.done ? 'bg-on-track/20 border-on-track' : 'border-white/20'}`}>
                    {item.done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4 7.5L8 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className={`text-[11px] leading-relaxed ${item.done ? 'line-through text-muted' : 'text-white/90'}`}>{item.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">FIXES ({session.fixes.length})</h4>
          {session.fixes.length > 0 ? (
            <div className="space-y-1.5">
              {session.fixes.map((fix, index) => {
                const taskDone = fix.task_id ? !!taskStates.get(fix.task_id) : false
                const severityColor = fix.severity === 'critical' ? '#EF4444' : fix.severity === 'major' ? '#F59E0B' : '#9B9BAA'
                return (
                  <div key={`${session.id}-fix-${index}`} className="px-2.5 py-2 rounded-md bg-white/3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ color: severityColor, backgroundColor: severityColor + '15' }}>
                        {fix.severity.toUpperCase()}
                      </span>
                      {fix.task_id ? (
                        <span className="text-[8px] font-mono text-muted">
                          {fix.task_id} {taskDone ? '· done' : '· open'}
                        </span>
                      ) : (
                        <span className="text-[8px] font-mono text-muted">not promoted</span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/90 leading-relaxed">{fix.label}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-[11px] text-muted px-2.5 py-2 rounded-md bg-white/3">No fixes logged in this session.</div>
          )}
        </section>
      </div>
    </div>
  )
}

function QAGroupView({ group, onClose }: { group: QAGroup; onClose: () => void }) {
  const domainLane = getDomainLane(normalizeQAGroupDomain(group))
  const builtCases = group.use_cases.filter((uc) => uc.built)
  const verifiedCases = builtCases.filter((uc) => uc.agent_status === 'pass' && uc.operator_status === 'pass')
  const failedCases = builtCases.filter((uc) => uc.agent_status === 'fail' || uc.operator_status === 'fail')
  const progressPct = builtCases.length > 0 ? Math.round((verifiedCases.length / builtCases.length) * 100) : 0

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="flex-shrink-0 p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider" style={{ color: domainLane.color, backgroundColor: domainLane.color + '18' }}>
                {domainLane.label.toUpperCase()}
              </span>
              <span className="text-[10px] text-muted font-mono">QA GROUP</span>
            </div>
            <h3 className="text-base font-semibold text-white leading-tight">{group.name}</h3>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted font-mono">{verifiedCases.length}/{builtCases.length || group.use_cases.length} verified</span>
            <span className="text-[10px] font-bold font-mono" style={{ color: domainLane.color }}>{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, backgroundColor: domainLane.color }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">READINESS</h4>
          <div className="grid grid-cols-2 gap-2">
            <InfoField label="Built Use Cases" value={`${builtCases.length}/${group.use_cases.length}`} />
            <InfoField label="Verified" value={`${verifiedCases.length}/${builtCases.length || group.use_cases.length}`} />
            <InfoField label="Failures" value={String(failedCases.length)} muted />
            <InfoField label="Pending" value={String(Math.max(builtCases.length - verifiedCases.length - failedCases.length, 0))} muted />
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">USE CASES ({group.use_cases.length})</h4>
          <div className="space-y-1.5">
            {group.use_cases.map((uc) => {
              const builtBadge = uc.built ? 'BUILT' : 'NOT BUILT'
              const builtColor = uc.built ? '#22C55E' : '#9B9BAA'
              return (
                <div key={uc.id} className={`px-2.5 py-2 rounded-md bg-white/3 border border-white/5 ${uc.built ? '' : 'opacity-60'}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ color: builtColor, backgroundColor: builtColor + '15' }}>
                      {builtBadge}
                    </span>
                    <StatusChip label={`Agent: ${uc.agent_status}`} status={uc.agent_status} />
                    <StatusChip label={`Operator: ${uc.operator_status}`} status={uc.operator_status} />
                  </div>
                  <div className="text-[11px] text-white/92 leading-relaxed">{uc.name}</div>
                  <div className="text-[9px] text-muted font-mono mt-1">{uc.task}</div>
                  {(uc.agent_notes || uc.operator_notes) && (
                    <div className="space-y-1 mt-2">
                      {uc.agent_notes && <div className="text-[10px] text-muted"><span className="text-white/50">Agent:</span> {uc.agent_notes}</div>}
                      {uc.operator_notes && <div className="text-[10px] text-muted"><span className="text-white/50">Operator:</span> {uc.operator_notes}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function QAHubView({ onClose }: { onClose: () => void }) {
  const tracker = useStore((s) => s.tracker)
  if (!tracker) return null

  const snapshot = getQAHubSnapshot(tracker)
  // QA Hub lives in the Ship & Operate lane post-pivot (was 'launch' pre-pivot).
  const launchLane = getDomainLane('ship_and_operate')
  const debugMilestone = tracker.milestones.find((milestone) => milestone.id === 'debug_review')

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="flex-shrink-0 p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                style={{ color: launchLane.color, backgroundColor: launchLane.color + '18' }}
              >
                {launchLane.label.toUpperCase()}
              </span>
              <span className="text-[10px] text-muted font-mono">QA HUB</span>
            </div>
            <h3 className="text-base font-semibold text-white leading-tight">QA</h3>
            <p className="text-[11px] text-muted mt-1">
              Review sessions, promoted fixes, and QA verification in one place.
            </p>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted font-mono">
              {snapshot.debugTaskDone}/{snapshot.debugTaskTotal} debug tasks
            </span>
            <span className="text-[10px] font-bold font-mono" style={{ color: snapshot.color }}>
              {snapshot.progressPct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${snapshot.progressPct}%`, backgroundColor: snapshot.color }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">QA STATUS</h4>
          <div className="grid grid-cols-2 gap-2">
            <InfoField label="Review Sessions" value={String(snapshot.reviewSessionCount)} />
            <InfoField label="QA Groups" value={String(snapshot.qaGroupCount)} />
            <InfoField label="Pending Fixes" value={String(snapshot.pendingFixes)} />
            <InfoField label="Promoted Fixes" value={String(snapshot.linkedFixes)} muted />
            <InfoField
              label="Verified Use Cases"
              value={`${snapshot.verifiedUseCases}/${snapshot.builtUseCases || snapshot.totalUseCases}`}
            />
            <InfoField label="Failing Use Cases" value={String(snapshot.failedUseCases)} muted />
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">
            REVIEW SESSIONS ({snapshot.sessionSummaries.length})
          </h4>
          <div className="space-y-1.5">
            {snapshot.sessionSummaries.map((session) => (
              <div key={session.id} className="px-2.5 py-2 rounded-md bg-white/3 border border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-white/92 leading-relaxed">{session.title}</div>
                  <StatusChip label={session.status.replace(/_/g, ' ')} status={session.pendingFixes > 0 ? 'fail' : session.status === 'done' ? 'pass' : 'untested'} />
                </div>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-muted font-mono flex-wrap">
                  <span>{session.checklistDone}/{session.checklistTotal} checklist</span>
                  <span>{session.pendingFixes} pending fixes</span>
                  <span>{session.completedLinkedFixes}/{session.linkedFixes} promoted fixes done</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">
            QA GROUPS ({snapshot.groupSummaries.length})
          </h4>
          <div className="space-y-1.5">
            {snapshot.groupSummaries.map((group) => (
              <div key={group.id} className="px-2.5 py-2 rounded-md bg-white/3 border border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-white/92 leading-relaxed">{group.name}</div>
                  <div className="text-[9px] font-mono text-muted">
                    {group.verified}/{group.built || group.total}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-muted font-mono flex-wrap">
                  <span>{group.built}/{group.total} built</span>
                  <span>{group.pending} pending</span>
                  <span>{group.failed} failing</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {debugMilestone && (
          <section>
            <h4 className="text-[10px] font-bold tracking-wider text-muted mb-3">
              {debugMilestone.title.toUpperCase()} TASKS ({snapshot.debugTaskDone}/{snapshot.debugTaskTotal})
            </h4>
            <div className="space-y-0.5">
              {debugMilestone.subtasks.map((subtask) => {
                const statusInfo = STATUS_LABELS[subtask.status] || STATUS_LABELS.todo
                return (
                  <div
                    key={subtask.id}
                    className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-white/3 ${subtask.done ? 'opacity-60' : ''}`}
                  >
                    <div
                      className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center ${
                        subtask.done ? 'bg-on-track/20 border-on-track' : 'border-white/20'
                      }`}
                    >
                      {subtask.done && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M2 5.5L4 7.5L8 3"
                            stroke="#22c55e"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[11px] leading-relaxed ${
                          subtask.done ? 'line-through text-muted' : 'text-white/90'
                        }`}
                      >
                        {subtask.label}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {subtask.assignee && (
                          <span className="text-[8px] font-medium px-1.5 py-0.5 rounded bg-white/6 text-muted">
                            {subtask.assignee}
                          </span>
                        )}
                        <span
                          className="text-[8px] font-bold px-1 py-0.5 rounded"
                          style={{
                            color: statusInfo.color,
                            backgroundColor: statusInfo.color + '15',
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function CategoryView({ category, onClose }: { category: ChecklistCategory; onClose: () => void }) {
  const { done, total, pct } = selectCategoryProgress(category)
  const isCritical = category.risk_level === 'critical'
  const color = isCritical ? '#EF4444' : '#585CF0'

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="flex-shrink-0 p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider" style={{ color, backgroundColor: color + '18' }}>
                CHECKLIST
              </span>
              <span className="text-[10px] text-muted font-mono">Target W{category.target_week}</span>
            </div>
            <h3 className="text-base font-semibold text-white leading-tight">{category.title}</h3>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted font-mono">{done}/{total} items</span>
            <span className="text-[10px] font-bold font-mono" style={{ color }}>{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-0.5">
          {category.items.map((item) => (
            <div key={item.id} className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-white/4 ${item.done ? 'opacity-60' : ''}`}>
              <div className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center ${item.done ? 'bg-on-track/20 border-on-track' : 'border-white/20'}`}>
                {item.done && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5.5L4 7.5L8 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] leading-relaxed ${item.done ? 'line-through text-muted' : 'text-white/90'}`}>{item.label}</div>
                {item.completed_at && <div className="text-[8px] text-muted font-mono mt-0.5">Done {new Date(item.completed_at).toLocaleDateString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfoField({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <label className="text-[9px] text-muted/70 block mb-1">{label}</label>
      <div className={`text-[11px] font-mono px-2 py-1.5 rounded border border-border bg-dark ${muted ? 'text-muted' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function StatusChip({ label, status }: { label: string; status: 'untested' | 'pass' | 'fail' }) {
  const color = status === 'pass' ? '#22C55E' : status === 'fail' ? '#EF4444' : '#9B9BAA'
  return (
    <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ color, backgroundColor: color + '15' }}>
      {label}
    </span>
  )
}
