import { useMemo, useState } from 'react'
import data from '../data/birds-eye-data.json'

// ── Types ──────────────────────────────────────────────────────────────

type SubTab = 'system' | 'roadmap'
type Status = 'working' | 'partial' | 'not_started'

interface UseCase {
  id: string
  name: string
  description: string
  status: Status
  version: string
  task_cost: string
  blockers: string[]
}

interface Category {
  id: string
  name: string
  color: string
  use_cases: UseCase[]
}

// ── Constants ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Status, string> = {
  working: '#1D9E75',
  partial: '#BA7517',
  not_started: '#888780',
}

const STATUS_LABELS: Record<Status, string> = {
  working: 'Working',
  partial: 'Partial',
  not_started: 'Not started',
}

const COST_STYLE: Record<string, { bg: string; text: string }> = {
  Free: { bg: 'rgba(29, 158, 117, 0.15)', text: '#1D9E75' },
}
const COST_PAID = { bg: 'rgba(88, 92, 240, 0.15)', text: '#8286FF' }

function costStyle(cost: string) {
  return COST_STYLE[cost] || COST_PAID
}

// ── Components ────────────────────────────────────────────────────────

function CostBadge({ cost }: { cost: string }) {
  const s = costStyle(cost)
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider inline-block"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {cost}
    </span>
  )
}

function RoadmapTab({ categories }: { categories: Category[] }) {
  const { v1, v1_5, v2_uc } = useMemo(() => {
    const v1: UseCase[] = []
    const v1_5: UseCase[] = []
    const v2_uc: UseCase[] = []
    for (const cat of categories) {
      for (const uc of cat.use_cases) {
        if (uc.version === 'v1') v1.push(uc)
        else if (uc.version === 'v1_5') v1_5.push(uc)
        else v2_uc.push(uc)
      }
    }
    return { v1, v1_5, v2_uc }
  }, [categories])

  const v1_5_blockers = useMemo(() => {
    const all = new Set<string>()
    for (const uc of v1_5) {
      for (const b of uc.blockers) all.add(b)
    }
    return Array.from(all)
  }, [v1_5])

  const rm = data.roadmap
  const v2caps = data.v2_capabilities

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* V1 */}
      <div className="rounded-lg border-2 border-border bg-surface p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-white">V1 — {rm.v1.label}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider text-white"
            style={{ backgroundColor: rm.v1.badge_color }}>
            {rm.v1.badge.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">{rm.v1.unlocks}</p>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          Use cases ({v1.length})
        </div>
        <div className="space-y-1 flex-1">
          {v1.map(uc => (
            <div key={uc.id} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.working }} />
              <span className="text-[11px] text-white/80">{uc.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-border">
          <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.working }}>
            {v1.filter(u => u.status === 'working').length}/{v1.length} working
          </span>
        </div>
      </div>

      {/* V1.5 */}
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-white">V1.5 — {rm.v1_5.label}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider text-white"
            style={{ backgroundColor: rm.v1_5.badge_color }}>
            {rm.v1_5.badge.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">{rm.v1_5.unlocks}</p>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          New use cases ({v1_5.length})
        </div>
        <div className="space-y-1 mb-3">
          {v1_5.map(uc => (
            <div key={uc.id} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[uc.status as Status] }} />
              <span className="text-[11px] text-white/80">{uc.name}</span>
            </div>
          ))}
        </div>
        {v1_5_blockers.length > 0 && (
          <>
            <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
              Blockers ({v1_5_blockers.length})
            </div>
            <div className="space-y-1 flex-1">
              {v1_5_blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[10px] text-behind mt-0.5">!</span>
                  <span className="text-[10px] text-muted">{b}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* V2 */}
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-white">V2 — {rm.v2.label}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider text-white"
            style={{ backgroundColor: rm.v2.badge_color }}>
            {rm.v2.badge.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">{rm.v2.unlocks}</p>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          Capabilities ({v2caps.length})
        </div>
        <div className="space-y-1.5 mb-3">
          {v2caps.map((cap, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#888780' }} />
              <span className="text-[11px] text-white/80">{cap.name}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          Depends on
        </div>
        <div className="space-y-1 flex-1">
          {Array.from(new Set(v2caps.map(c => c.depends_on))).map((dep, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[10px] text-muted mt-0.5">~</span>
              <span className="text-[10px] text-muted">{dep}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────────────────

export function BirdsEyeView() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('system')
  const categories = data.categories as Category[]

  const subTabs: { id: SubTab; icon: string; label: string }[] = [
    { id: 'system', icon: '◆', label: 'System' },
    { id: 'roadmap', icon: '▸', label: 'Roadmap' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border bg-dark z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-semibold text-white">Product View</h1>
            <p className="text-[10px] text-muted mt-0.5">
              Built from codebase scan — {new Date(data.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.working }}>
              {data.totals.working} working
            </span>
            <span className="text-[10px] text-muted">/</span>
            <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.partial }}>
              {data.totals.partial} partial
            </span>
            <span className="text-[10px] text-muted">/</span>
            <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.not_started }}>
              {data.totals.not_started} not started
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === tab.id
                  ? 'bg-accent/15 text-accent-light'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeSubTab === 'system' && <div className="text-muted text-sm">System tab — placeholder</div>}
        {activeSubTab === 'roadmap' && <RoadmapTab categories={categories} />}
      </div>
    </div>
  )
}
