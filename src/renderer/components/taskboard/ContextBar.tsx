import { selectMilestoneProgress } from '../../store'
import type { Milestone } from '../../../main/parser'

// AI Commerce Index Platform — 4-lane palette. Mirrors DOMAIN_COLOR_MAP in
// ../../domainModel.ts.
const DOMAIN_COLORS: Record<string, string> = {
  foundation: '#585CF0',
  product_engines: '#14B8A6',
  merchant_facing: '#5B6EE8',
  ship_and_operate: '#F59E0B',
  backend: '#585CF0',
  data: '#585CF0',
  compliance: '#F59E0B',
  product_ops: '#14B8A6',
  autopilot: '#14B8A6',
  attribution: '#14B8A6',
  scoring: '#14B8A6',
  llm_scoring: '#14B8A6',
  frontend: '#5B6EE8',
  quality: '#F59E0B',
  launch: '#F59E0B',
  launch_gtm: '#F59E0B',
}

interface ContextBarProps {
  milestones: Milestone[]
  activeMilestoneIndex: number
  onMilestoneChange: (index: number) => void
}

function ProgressRing({ milestone, size = 32 }: { milestone: Milestone; size?: number }) {
  const { done, total, pct } = selectMilestoneProgress(milestone)
  const color = DOMAIN_COLORS[milestone.domain] || '#9B9BAA'
  const r = (size - 4) / 2
  const circumference = 2 * Math.PI * r

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize="7" fontFamily="JetBrains Mono, monospace"
      >
        {done}/{total}
      </text>
    </svg>
  )
}

export function ContextBar({ milestones, activeMilestoneIndex, onMilestoneChange }: ContextBarProps) {
  const active = milestones[activeMilestoneIndex]
  const next = milestones[activeMilestoneIndex + 1] ?? null
  if (!active) return null

  const color = DOMAIN_COLORS[active.domain] || '#9B9BAA'
  const { done, total } = selectMilestoneProgress(active)

  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-surface/50">
      {/* Active milestone */}
      <ProgressRing milestone={active} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
            style={{ color, backgroundColor: color + '18' }}
          >
            {active.domain.replace(/_/g, ' ').toUpperCase()}
          </span>
          <span className="text-sm text-white font-medium truncate">{active.title}</span>
          {active.is_key_milestone && (
            <span className="text-[10px] text-accent-light flex-shrink-0">
              ★ {active.key_milestone_label}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted font-mono">
          Week {active.week} · {done}/{total} tasks
        </span>
      </div>

      {/* Milestone navigation */}
      <div className="flex items-center gap-1">
        <button
          className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted hover:text-white hover:border-accent/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={activeMilestoneIndex <= 0}
          onClick={() => onMilestoneChange(activeMilestoneIndex - 1)}
          title="Previous milestone"
        >
          ‹
        </button>
        <select
          className="bg-surface border border-border rounded px-2 py-1 text-xs text-white font-mono appearance-none cursor-pointer hover:border-accent/50 transition-colors max-w-48 truncate"
          value={activeMilestoneIndex}
          onChange={(e) => onMilestoneChange(Number(e.target.value))}
        >
          {milestones.map((m, i) => (
            <option key={m.id} value={i}>
              W{m.week} — {m.title}
            </option>
          ))}
        </select>
        <button
          className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted hover:text-white hover:border-accent/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={activeMilestoneIndex >= milestones.length - 1}
          onClick={() => onMilestoneChange(activeMilestoneIndex + 1)}
          title="Next milestone"
        >
          ›
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-border" />

      {/* Next up */}
      {next ? (
        <div className="flex items-center gap-2 opacity-60">
          <span className="text-[9px] text-muted tracking-wider font-bold">NEXT UP</span>
          <ProgressRing milestone={next} size={24} />
          <span className="text-xs text-muted truncate max-w-32">{next.title}</span>
        </div>
      ) : (
        <span className="text-[9px] text-muted tracking-wider font-bold opacity-40">FINAL MILESTONE</span>
      )}
    </div>
  )
}
