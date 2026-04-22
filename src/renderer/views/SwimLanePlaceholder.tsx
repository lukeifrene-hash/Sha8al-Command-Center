import { useStore, selectMilestoneProgress, selectCategoryProgress, selectCurrentWeek } from '../store'

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
  product_ops_tae: '#14B8A6',
  commerce_billing: '#f59e0b',
  polish_submit: '#ef4444',
}

export function SwimLanePlaceholder() {
  const tracker = useStore((s) => s.tracker)
  if (!tracker) return null

  const week = selectCurrentWeek(tracker)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Swim Lane View</h2>
          <p className="text-xs text-muted mt-0.5">Phase 2 will render the full horizontal timeline here.</p>
        </div>
        <span className="text-xs text-muted font-mono">
          {tracker.milestones.length} milestones · {tracker.schedule.phases.length} phases
        </span>
      </div>

      {/* Phase bar */}
      <div className="flex gap-0.5 rounded-lg overflow-hidden">
        {tracker.schedule.phases.map((phase) => {
          const span = phase.end_week - phase.start_week + 1
          const isActive = week >= phase.start_week && week <= phase.end_week
          return (
            <div
              key={phase.id}
              className={`h-9 flex items-center justify-center text-[10px] font-semibold tracking-wide transition-all ${
                isActive ? 'text-white' : 'text-white/60'
              }`}
              style={{
                backgroundColor: phase.color + (isActive ? '40' : '18'),
                borderBottom: `2px solid ${phase.color}`,
                flex: span,
              }}
            >
              {phase.title} (W{phase.start_week}–{phase.end_week})
            </div>
          )
        })}
      </div>

      {/* Milestone list grouped by week */}
      <div className="grid grid-cols-1 gap-2">
        {tracker.milestones.map((m) => {
          const { done, total, pct } = selectMilestoneProgress(m)
          const color = DOMAIN_COLORS[m.domain] || '#9B9BAA'
          return (
            <div
              key={m.id}
              className="flex items-center gap-4 bg-surface rounded-lg px-4 py-2.5 border border-border"
            >
              {/* Progress ring */}
              <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 87.96} 87.96`}
                  transform="rotate(-90 18 18)"
                />
                <text x="18" y="19" textAnchor="middle" dominantBaseline="central"
                  fill="white" fontSize="8" fontFamily="JetBrains Mono, monospace"
                >
                  {done}/{total}
                </text>
              </svg>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
                    style={{ color, backgroundColor: color + '18' }}
                  >
                    {m.domain.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-xs text-white font-medium truncate">{m.title}</span>
                  {m.is_key_milestone && (
                    <span className="text-[10px] text-accent-light flex-shrink-0">
                      ★ {m.key_milestone_label}
                    </span>
                  )}
                </div>
              </div>

              {/* Week */}
              <span className="text-[10px] text-muted font-mono flex-shrink-0">
                W{m.week}{m.planned_end !== m.planned_start ? `–${m.planned_end.slice(8)}` : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Checklist summary */}
      <div>
        <h3 className="text-xs font-bold tracking-wider text-muted mb-2">SUBMISSION CHECKLIST</h3>
        <div className="grid grid-cols-4 gap-2">
          {tracker.submission_checklist.categories.map((cat) => {
            const { done, total, pct } = selectCategoryProgress(cat)
            const isCritical = cat.risk_level === 'critical'
            return (
              <div
                key={cat.id}
                className={`rounded-md px-2.5 py-2 bg-surface border ${
                  isCritical ? 'border-behind/50' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  {isCritical && <span className="text-[10px] text-behind">⚠</span>}
                  <span className="text-[10px] text-white font-medium truncate">{cat.title}</span>
                </div>
                <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: isCritical ? '#ef4444' : '#585CF0' }}
                  />
                </div>
                <span className="text-[9px] text-muted font-mono">{done}/{total}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
