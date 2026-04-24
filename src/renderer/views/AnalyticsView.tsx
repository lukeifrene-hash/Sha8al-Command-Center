import { useState, useMemo } from 'react'
import { useStore, selectCurrentWeek, selectOverallProgress, selectScheduleStatus } from '../store'
import type { TrackerState } from '../store'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

interface CriticalPathNode {
  milestoneId: string
  title: string
  week: number
  duration: number
  slack: number
  isCritical: boolean
}

interface MonteCarloResult {
  p50: string
  p80: string
  p95: string
  meanDays: number
  simulations: number
}

interface RiskItem {
  id: string
  taskId: string
  taskLabel: string
  milestoneTitle: string
  riskLevel: RiskLevel
  reasons: string[]
}

interface VelocityData {
  week: number
  tasksCompleted: number
  tokensUsed: number
  cost: number
  throughput: number
}

// ─── Analytics Engine (pure computation) ──────────────────────────────────────

function computeCriticalPath(tracker: TrackerState): CriticalPathNode[] {
  const nodes: CriticalPathNode[] = tracker.milestones.map((m) => {
    const total = m.subtasks.length
    const done = m.subtasks.filter((s) => s.done).length
    const remaining = total - done
    const duration = Math.max(1, Math.ceil(remaining / 3)) // ~3 tasks/week velocity
    const slack = m.drift_days < 0 ? Math.abs(m.drift_days) : 0
    const isCritical = slack <= 1 && remaining > 0
    return {
      milestoneId: m.id,
      title: m.title,
      week: m.week,
      duration,
      slack,
      isCritical,
    }
  })

  return nodes.sort((a, b) => a.week - b.week)
}

function runMonteCarlo(tracker: TrackerState, simulations = 1000): MonteCarloResult {
  const remaining = tracker.milestones.reduce(
    (sum, m) => sum + m.subtasks.filter((s) => !s.done).length,
    0
  )
  if (remaining === 0) {
    return { p50: 'Complete', p80: 'Complete', p95: 'Complete', meanDays: 0, simulations }
  }

  // Historical velocity: tasks completed per week
  const completedTasks = tracker.milestones.reduce(
    (sum, m) => sum + m.subtasks.filter((s) => s.done).length,
    0
  )
  const currentWeek = selectCurrentWeek(tracker)
  const velocityPerWeek = currentWeek > 0 ? completedTasks / currentWeek : 3
  const baseVelocity = Math.max(1, velocityPerWeek)

  const completionDays: number[] = []
  for (let i = 0; i < simulations; i++) {
    // Add variance: velocity between 0.5x and 1.8x base
    const variance = 0.5 + Math.random() * 1.3
    const effectiveVelocity = baseVelocity * variance
    const weeksNeeded = remaining / effectiveVelocity
    completionDays.push(weeksNeeded * 7)
  }

  completionDays.sort((a, b) => a - b)

  const p50Idx = Math.floor(simulations * 0.5)
  const p80Idx = Math.floor(simulations * 0.8)
  const p95Idx = Math.floor(simulations * 0.95)
  const meanDays = completionDays.reduce((s, d) => s + d, 0) / simulations

  const formatDate = (days: number) => {
    const target = new Date()
    target.setDate(target.getDate() + Math.round(days))
    return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return {
    p50: formatDate(completionDays[p50Idx]),
    p80: formatDate(completionDays[p80Idx]),
    p95: formatDate(completionDays[p95Idx]),
    meanDays: Math.round(meanDays),
    simulations,
  }
}

function computeRiskItems(tracker: TrackerState): RiskItem[] {
  const risks: RiskItem[] = []

  for (const m of tracker.milestones) {
    for (const s of m.subtasks) {
      const reasons: string[] = []
      let level: RiskLevel = 'low'

      // Unassigned task
      if (!s.assignee && !s.done) {
        reasons.push('Unassigned')
        level = 'medium'
      }

      // Blocked
      if (s.blocked_by) {
        reasons.push(`Blocked by ${s.blocked_by}`)
        level = 'high'
      }

      // High dependency depth
      const dependents = tracker.milestones.flatMap((ms) =>
        ms.subtasks.filter((t) => t.blocked_by === s.id)
      )
      if (dependents.length >= 3 && !s.done) {
        reasons.push(`${dependents.length} dependents`)
        level = level === 'high' ? 'critical' : 'high'
      }

      // Overdue milestone
      if (m.drift_days > 3 && !s.done) {
        reasons.push(`Milestone ${Math.abs(m.drift_days)}d overdue`)
        level = level === 'high' ? 'critical' : 'high'
      }

      // In-progress stale (no completion for a long time)
      if (s.status === 'in_progress' && !s.completed_at) {
        reasons.push('Stale in-progress')
        level = level === 'high' ? 'critical' : 'medium'
      }

      if (reasons.length > 0) {
        risks.push({
          id: `risk:${s.id}`,
          taskId: s.id,
          taskLabel: s.label,
          milestoneTitle: m.title,
          riskLevel: level,
          reasons,
        })
      }
    }
  }

  return risks.sort((a, b) => {
    const order: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.riskLevel] - order[b.riskLevel]
  })
}

function computeVelocity(tracker: TrackerState): VelocityData[] {
  const currentWeek = selectCurrentWeek(tracker)
  const weeks: VelocityData[] = []

  for (let w = 1; w <= currentWeek; w++) {
    const weekStart = new Date(tracker.project.start_date + 'T00:00:00Z')
    weekStart.setDate(weekStart.getDate() + (w - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const completedInWeek = tracker.milestones.reduce((sum, m) => {
      return (
        sum +
        m.subtasks.filter((s) => {
          if (!s.completed_at) return false
          const d = new Date(s.completed_at)
          return d >= weekStart && d < weekEnd
        }).length
      )
    }, 0)

    const logInWeek = tracker.agent_log.filter((e) => {
      const d = new Date(e.timestamp)
      return d >= weekStart && d < weekEnd
    })

    const tokens = logInWeek.length * 500 // rough estimate
    const cost = tokens * 0.000005

    weeks.push({
      week: w,
      tasksCompleted: completedInWeek,
      tokensUsed: tokens,
      cost: Math.round(cost * 100) / 100,
      throughput: completedInWeek,
    })
  }

  return weeks
}

// ─── Risk Level Badge ─────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string }> = {
  low: { bg: 'rgba(29,158,117,0.12)', text: '#1D9E75' },
  medium: { bg: 'rgba(186,117,23,0.12)', text: '#BA7517' },
  high: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
  critical: { bg: 'rgba(255,0,0,0.15)', text: '#ff0000' },
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const style = RISK_STYLES[level]
  return (
    <span
      className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {level.toUpperCase()}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnalyticsView() {
  const tracker = useStore((s) => s.tracker)
  const [activeSection, setActiveSection] = useState<'overview' | 'critical-path' | 'monte-carlo' | 'risk' | 'velocity'>('overview')

  if (!tracker) return null

  const criticalPath = computeCriticalPath(tracker)
  const monteCarlo = runMonteCarlo(tracker)
  const risks = computeRiskItems(tracker)
  const velocity = computeVelocity(tracker)
  const overallProgress = selectOverallProgress(tracker)
  const scheduleStatus = selectScheduleStatus(tracker)

  const riskSummary = {
    critical: risks.filter((r) => r.riskLevel === 'critical').length,
    high: risks.filter((r) => r.riskLevel === 'high').length,
    medium: risks.filter((r) => r.riskLevel === 'medium').length,
    low: risks.filter((r) => r.riskLevel === 'low').length,
  }

  const sections = [
    { id: 'overview' as const, label: 'Overview', icon: '◉' },
    { id: 'critical-path' as const, label: 'Critical Path', icon: '⟿' },
    { id: 'monte-carlo' as const, label: 'Monte Carlo ETA', icon: '⚂' },
    { id: 'risk' as const, label: 'Risk Heatmap', icon: '⚠' },
    { id: 'velocity' as const, label: 'Velocity', icon: '↗' },
  ]

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 border-r border-border p-4 space-y-1">
        <h2 className="text-xs font-bold tracking-wider text-muted mb-4">ANALYTICS</h2>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeSection === s.id
                ? 'bg-accent/15 text-accent-light'
                : 'text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-sm">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === 'overview' && (
          <OverviewSection
            tracker={tracker}
            progress={overallProgress}
            scheduleStatus={scheduleStatus}
            criticalPath={criticalPath}
            monteCarlo={monteCarlo}
            riskSummary={riskSummary}
            velocity={velocity}
          />
        )}
        {activeSection === 'critical-path' && (
          <CriticalPathSection nodes={criticalPath} />
        )}
        {activeSection === 'monte-carlo' && (
          <MonteCarloSection result={monteCarlo} />
        )}
        {activeSection === 'risk' && (
          <RiskHeatmapSection risks={risks} summary={riskSummary} />
        )}
        {activeSection === 'velocity' && (
          <VelocitySection data={velocity} />
        )}
      </div>
    </div>
  )
}

// ─── Overview Section ─────────────────────────────────────────────────────────

function OverviewSection({ tracker, progress, scheduleStatus, criticalPath, monteCarlo, riskSummary, velocity }: {
  tracker: TrackerState
  progress: number
  scheduleStatus: string
  criticalPath: CriticalPathNode[]
  monteCarlo: MonteCarloResult
  riskSummary: Record<RiskLevel, number>
  velocity: VelocityData[]
}) {
  const totalTasks = tracker.milestones.reduce((s, m) => s + m.subtasks.length, 0)
  const doneTasks = tracker.milestones.reduce((s, m) => s + m.subtasks.filter((t) => t.done).length, 0)
  const blockedTasks = tracker.milestones.reduce((s, m) => s + m.subtasks.filter((t) => t.blocked_by).length, 0)
  const criticalMilestones = criticalPath.filter((n) => n.isCritical).length
  const avgVelocity = velocity.length > 0
    ? velocity.reduce((s, v) => s + v.tasksCompleted, 0) / velocity.length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-white" style={{ fontSize: '28px' }}>Predictive Analytics</h2>
        <p className="text-caption mt-1" style={{ color: 'var(--theme-muted)' }}>
          Critical path, Monte Carlo forecasting, risk analysis, and velocity tracking
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Progress" value={`${Math.round(progress * 100)}%`} sub={`${doneTasks}/${totalTasks} tasks`} color="#0071e3" />
        <KPICard label="Schedule" value={scheduleStatus.replace(/_/g, ' ').toUpperCase()} sub={criticalMilestones > 0 ? `${criticalMilestones} critical` : 'No bottlenecks'} color={scheduleStatus === 'on_track' ? '#1D9E75' : '#ef4444'} />
        <KPICard label="ETA (p80)" value={monteCarlo.p80} sub={`±${monteCarlo.meanDays}d mean`} color="#0071e3" />
        <KPICard label="Risk Items" value={String(riskSummary.critical + riskSummary.high)} sub={`${riskSummary.critical} critical · ${riskSummary.high} high`} color={riskSummary.critical > 0 ? '#ef4444' : riskSummary.high > 0 ? '#BA7517' : '#1D9E75'} />
      </div>

      {/* Mini charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Progress donut */}
        <div className="rounded-lg border border-border p-5">
          <h3 className="text-xs font-bold tracking-wider text-muted mb-4">COMPLETION BY MILESTONE</h3>
          <div className="space-y-2">
            {tracker.milestones.map((m) => {
              const done = m.subtasks.filter((s) => s.done).length
              const total = m.subtasks.length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-[10px] text-muted w-4 font-mono">{m.week}</span>
                  <span className="text-xs text-white flex-1 truncate">{m.title}</span>
                  <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-progress-track)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#1D9E75' : '#0071e3' }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Velocity sparkline */}
        <div className="rounded-lg border border-border p-5">
          <h3 className="text-xs font-bold tracking-wider text-muted mb-4">WEEKLY VELOCITY</h3>
          {velocity.length === 0 ? (
            <div className="text-xs text-muted text-center py-8">No velocity data yet</div>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {velocity.map((v) => {
                const maxTasks = Math.max(...velocity.map((vv) => vv.tasksCompleted), 1)
                const height = Math.max(4, (v.tasksCompleted / maxTasks) * 100)
                return (
                  <div key={v.week} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono text-muted">{v.tasksCompleted}</span>
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${height}%`,
                        backgroundColor: v.tasksCompleted > 0 ? '#0071e3' : 'var(--theme-progress-track)',
                        minHeight: '4px',
                      }}
                    />
                    <span className="text-[8px] text-muted">W{v.week}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
            <span>Avg: {avgVelocity.toFixed(1)} tasks/wk</span>
            <span>Cost: ${velocity.reduce((s, v) => s + v.cost, 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-[10px] font-bold tracking-wider text-muted mb-1">{label.toUpperCase()}</div>
      <div className="text-xl font-semibold font-mono" style={{ color }}>{value}</div>
      <div className="text-[10px] text-muted mt-1">{sub}</div>
    </div>
  )
}

// ─── Critical Path Section ────────────────────────────────────────────────────

function CriticalPathSection({ nodes }: { nodes: CriticalPathNode[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-white" style={{ fontSize: '28px' }}>Critical Path</h2>
        <p className="text-caption mt-1" style={{ color: 'var(--theme-muted)' }}>
          Auto-computed dependency critical path — milestones with zero slack are bottlenecks
        </p>
      </div>

      <div className="space-y-2">
        {nodes.map((node, idx) => {
          const isLast = idx === nodes.length - 1
          return (
            <div key={node.milestoneId} className="flex items-stretch gap-4">
              {/* Timeline connector */}
              <div className="flex flex-col items-center w-8">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    node.isCritical ? 'animate-pulse-glow' : ''
                  }`}
                  style={{
                    backgroundColor: node.isCritical ? '#ef4444' : '#1D9E75',
                  }}
                />
                {!isLast && (
                  <div className="w-0.5 flex-1" style={{ backgroundColor: 'var(--theme-border)' }} />
                )}
              </div>

              {/* Node content */}
              <div
                className="flex-1 rounded-lg border p-4 mb-1"
                style={{
                  borderColor: node.isCritical ? 'rgba(239,68,68,0.3)' : 'var(--theme-border)',
                  backgroundColor: node.isCritical ? 'rgba(239,68,68,0.05)' : 'var(--theme-surface-container)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{node.title}</span>
                    {node.isCritical && (
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-behind/15 text-behind">
                        CRITICAL
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted">Week {node.week}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted">
                  <span>Duration: {node.duration}wk</span>
                  <span>Slack: {node.slack}d</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Monte Carlo Section ──────────────────────────────────────────────────────

function MonteCarloSection({ result }: { result: MonteCarloResult }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-white" style={{ fontSize: '28px' }}>Monte Carlo ETA</h2>
        <p className="text-caption mt-1" style={{ color: 'var(--theme-muted)' }}>
          Forecast completion dates using {result.simulations.toLocaleString()} simulations with historical velocity variance
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MonteCarloCard percentile="50%" date={result.p50} confidence="Optimistic" color="#1D9E75" />
        <MonteCarloCard percentile="80%" date={result.p80} confidence="Likely" color="#0071e3" />
        <MonteCarloCard percentile="95%" date={result.p95} confidence="Conservative" color="#BA7517" />
      </div>

      <div className="rounded-lg border border-border p-5">
        <h3 className="text-xs font-bold tracking-wider text-muted mb-3">HOW IT WORKS</h3>
        <div className="text-xs text-on-surface-variant leading-relaxed space-y-2">
          <p>The Monte Carlo simulation runs {result.simulations.toLocaleString()} iterations, each with a randomized velocity factor between 0.5x and 1.8x the observed historical rate.</p>
          <p>The <strong>p50</strong> date means 50% of simulations finished by then — this is the optimistic target. The <strong>p80</strong> is a more realistic estimate, and <strong>p95</strong> accounts for significant delays.</p>
          <p>Mean estimated remaining: <strong>{result.meanDays} days</strong>.</p>
        </div>
      </div>
    </div>
  )
}

function MonteCarloCard({ percentile, date, confidence, color }: {
  percentile: string; date: string; confidence: string; color: string
}) {
  return (
    <div className="rounded-lg border border-border p-5 text-center">
      <div className="text-[10px] font-bold tracking-wider text-muted mb-2">{percentile} CONFIDENCE</div>
      <div className="text-2xl font-semibold font-mono" style={{ color }}>{date}</div>
      <div className="text-[10px] text-muted mt-2">{confidence}</div>
    </div>
  )
}

// ─── Risk Heatmap Section ─────────────────────────────────────────────────────

function RiskHeatmapSection({ risks, summary }: { risks: RiskItem[]; summary: Record<RiskLevel, number> }) {
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all')

  const filtered = filter === 'all' ? risks : risks.filter((r) => r.riskLevel === filter)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-white" style={{ fontSize: '28px' }}>Risk Heatmap</h2>
        <p className="text-caption mt-1" style={{ color: 'var(--theme-muted)' }}>
          Auto-flagged high-dependency, unassigned, overdue, and stale tasks
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <RiskSummaryCard level="critical" count={summary.critical} />
        <RiskSummaryCard level="high" count={summary.high} />
        <RiskSummaryCard level="medium" count={summary.medium} />
        <RiskSummaryCard level="low" count={summary.low} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((f) => (
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

      {/* Risk table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--theme-surface-container)' }}>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">RISK</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">TASK</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">MILESTONE</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">REASONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No risk items{filter !== 'all' ? ` at ${filter} level` : ''}
                </td>
              </tr>
            )}
            {filtered.map((risk) => (
              <tr key={risk.id} className="border-t border-border hover:bg-white/5 transition-colors">
                <td className="px-4 py-3"><RiskBadge level={risk.riskLevel} /></td>
                <td className="px-4 py-3 text-white max-w-[200px] truncate">{risk.taskLabel}</td>
                <td className="px-4 py-3 text-muted max-w-[150px] truncate">{risk.milestoneTitle}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {risk.reasons.map((r, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-surface text-muted">
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RiskSummaryCard({ level, count }: { level: RiskLevel; count: number }) {
  const style = RISK_STYLES[level]
  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <div className="text-2xl font-semibold font-mono" style={{ color: style.text }}>{count}</div>
      <div className="text-[10px] font-bold tracking-wider mt-1" style={{ color: style.text }}>{level.toUpperCase()}</div>
    </div>
  )
}

// ─── Velocity Section ──────────────────────────────────────────────────────────

function VelocitySection({ data }: { data: VelocityData[] }) {
  const totalTasks = data.reduce((s, v) => s + v.tasksCompleted, 0)
  const totalCost = data.reduce((s, v) => s + v.cost, 0)
  const avgThroughput = data.length > 0 ? totalTasks / data.length : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section-heading text-white" style={{ fontSize: '28px' }}>Velocity Tracking</h2>
        <p className="text-caption mt-1" style={{ color: 'var(--theme-muted)' }}>
          Task throughput, token usage, and cost per week
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Completed" value={String(totalTasks)} sub={`across ${data.length} weeks`} color="#1D9E75" />
        <KPICard label="Avg Throughput" value={`${avgThroughput.toFixed(1)}/wk`} sub="tasks per week" color="#0071e3" />
        <KPICard label="Total Cost" value={`$${totalCost.toFixed(2)}`} sub="estimated token cost" color="#BA7517" />
      </div>

      {/* Weekly breakdown */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: 'var(--theme-surface-container)' }}>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">WEEK</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">TASKS DONE</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">TOKENS (est.)</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">COST</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold tracking-wider text-muted">THROUGHPUT</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No velocity data yet — complete tasks to see weekly metrics
                </td>
              </tr>
            )}
            {data.map((v) => (
              <tr key={v.week} className="border-t border-border hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-mono text-white">W{v.week}</td>
                <td className="px-4 py-3 font-mono text-on-track">{v.tasksCompleted}</td>
                <td className="px-4 py-3 font-mono text-muted">{v.tokensUsed.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-muted">${v.cost.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-progress-track)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (v.tasksCompleted / Math.max(avgThroughput * 2, 1)) * 100)}%`,
                          backgroundColor: '#0071e3',
                        }}
                      />
                    </div>
                    <span className="font-mono text-muted">{v.throughput}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
