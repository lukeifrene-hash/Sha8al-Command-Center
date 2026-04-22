import type { QAGroup, ReviewSession, TrackerState } from '../main/parser'

export interface QAHubSessionSummary {
  id: string
  title: string
  checklistDone: number
  checklistTotal: number
  pendingFixes: number
  linkedFixes: number
  completedLinkedFixes: number
  status: ReviewSession['status']
}

export interface QAHubGroupSummary {
  id: string
  name: string
  built: number
  total: number
  verified: number
  failed: number
  pending: number
}

export interface QAHubSnapshot {
  metricText: string
  progressPct: number
  color: string
  caption: string
  tooltipMeta: string[]
  debugTaskDone: number
  debugTaskTotal: number
  reviewSessionCount: number
  totalFixes: number
  pendingFixes: number
  linkedFixes: number
  completedLinkedFixes: number
  qaGroupCount: number
  builtUseCases: number
  totalUseCases: number
  verifiedUseCases: number
  failedUseCases: number
  pendingUseCases: number
  sessionSummaries: QAHubSessionSummary[]
  groupSummaries: QAHubGroupSummary[]
}

function getGroupSummary(group: QAGroup): QAHubGroupSummary {
  const built = group.use_cases.filter((useCase) => useCase.built)
  const verified = built.filter(
    (useCase) => useCase.agent_status === 'pass' && useCase.operator_status === 'pass',
  )
  const failed = built.filter(
    (useCase) => useCase.agent_status === 'fail' || useCase.operator_status === 'fail',
  )

  return {
    id: group.id,
    name: group.name,
    built: built.length,
    total: group.use_cases.length,
    verified: verified.length,
    failed: failed.length,
    pending: Math.max(built.length - verified.length - failed.length, 0),
  }
}

export function getQAHubSnapshot(tracker: TrackerState): QAHubSnapshot {
  const debugMilestone = tracker.milestones.find((milestone) => milestone.id === 'debug_review')
  const debugTaskDone = debugMilestone?.subtasks.filter((subtask) => subtask.done).length ?? 0
  const debugTaskTotal = debugMilestone?.subtasks.length ?? 0
  const debugTaskPct = debugTaskTotal > 0 ? Math.round((debugTaskDone / debugTaskTotal) * 100) : 0

  const doneTaskIds = new Set<string>()
  for (const milestone of tracker.milestones) {
    for (const subtask of milestone.subtasks) {
      if (subtask.done) doneTaskIds.add(subtask.id)
    }
  }

  const sessionSummaries = (tracker.review_sessions ?? [])
    .map((session) => {
      const checklistDone = session.checklist.filter((item) => item.done).length
      const linkedFixes = (session.fixes ?? []).filter((fix) => !!fix.task_id)
      const completedLinkedFixes = linkedFixes.filter(
        (fix) => fix.task_id && doneTaskIds.has(fix.task_id),
      )

      return {
        id: session.id,
        title: session.title,
        checklistDone,
        checklistTotal: session.checklist.length,
        pendingFixes: (session.fixes ?? []).filter((fix) => !fix.task_id).length,
        linkedFixes: linkedFixes.length,
        completedLinkedFixes: completedLinkedFixes.length,
        status: session.status,
      }
    })
    .sort((a, b) => b.pendingFixes - a.pendingFixes || a.title.localeCompare(b.title))

  const groupSummaries = (tracker.qa?.groups ?? [])
    .map((group) => getGroupSummary(group))
    .sort((a, b) => b.failed - a.failed || b.pending - a.pending || a.name.localeCompare(b.name))

  const totalFixes = sessionSummaries.reduce(
    (sum, session) => sum + session.pendingFixes + session.linkedFixes,
    0,
  )
  const pendingFixes = sessionSummaries.reduce((sum, session) => sum + session.pendingFixes, 0)
  const linkedFixes = sessionSummaries.reduce((sum, session) => sum + session.linkedFixes, 0)
  const completedLinkedFixes = sessionSummaries.reduce(
    (sum, session) => sum + session.completedLinkedFixes,
    0,
  )

  const qaGroupCount = groupSummaries.length
  const builtUseCases = groupSummaries.reduce((sum, group) => sum + group.built, 0)
  const totalUseCases = groupSummaries.reduce((sum, group) => sum + group.total, 0)
  const verifiedUseCases = groupSummaries.reduce((sum, group) => sum + group.verified, 0)
  const failedUseCases = groupSummaries.reduce((sum, group) => sum + group.failed, 0)
  const pendingUseCases = groupSummaries.reduce((sum, group) => sum + group.pending, 0)

  let color = '#F59E0B'
  if (pendingFixes > 0 || failedUseCases > 0) color = '#EF4444'
  else if (
    debugTaskTotal > 0 &&
    debugTaskDone === debugTaskTotal &&
    builtUseCases > 0 &&
    verifiedUseCases === builtUseCases
  ) {
    color = '#22C55E'
  }

  return {
    metricText: debugTaskTotal > 0 ? `${debugTaskDone}/${debugTaskTotal}` : `${verifiedUseCases}/${builtUseCases || totalUseCases || 0}`,
    progressPct: debugTaskTotal > 0 ? debugTaskPct : builtUseCases > 0 ? Math.round((verifiedUseCases / builtUseCases) * 100) : 0,
    color,
    caption:
      pendingFixes > 0
        ? `${pendingFixes} pending fixes`
        : `${verifiedUseCases}/${builtUseCases || totalUseCases || 0} verified`,
    tooltipMeta: [
      `${debugTaskDone}/${debugTaskTotal} debug tasks complete`,
      `${sessionSummaries.length} review sessions`,
      `${verifiedUseCases}/${builtUseCases || totalUseCases || 0} QA use cases verified`,
    ],
    debugTaskDone,
    debugTaskTotal,
    reviewSessionCount: sessionSummaries.length,
    totalFixes,
    pendingFixes,
    linkedFixes,
    completedLinkedFixes,
    qaGroupCount,
    builtUseCases,
    totalUseCases,
    verifiedUseCases,
    failedUseCases,
    pendingUseCases,
    sessionSummaries,
    groupSummaries,
  }
}
