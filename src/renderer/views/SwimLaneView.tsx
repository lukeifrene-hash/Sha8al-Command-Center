import { useRef, useEffect, useState } from 'react'
import type { Milestone, ChecklistCategory } from '../../main/parser'
import { useStore, selectCurrentWeek, selectMilestoneProgress, selectCategoryProgress } from '../store'
import { MilestoneDetailPanel, type PanelTarget } from '../components/swim-lane/MilestoneDetailPanel'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_W = 100
const LANE_H = 130
const LABEL_W = 140
const HEADER_H = 44
const CHECKLIST_H = 210
const MARKER_H = 60
const TOTAL_WEEKS = 20
const TOTAL_W = TOTAL_WEEKS * WEEK_W
const NODE_R = 20
const KEY_NODE_R = 26
const PANEL_W = 480

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

const LANES = [
  { id: 'storefront', label: 'Storefront', color: '#22c55e', domains: ['foundation', 'storefront', 'launch_prep', 'review_buffer'] },
  { id: 'product_ops', label: 'Product Ops', color: '#f59e0b', domains: ['product_ops'] },
  { id: 'commerce_intel', label: 'Commerce Intel', color: '#8286FF', domains: ['commerce_intel', 'v1_2', 'v1_5'] },
  { id: 'distribution', label: 'Distribution', color: '#9B9BAA', domains: ['distribution'] },
]

const MAJOR_MILESTONES = [
  { label: 'App Store Submit', week: 10, color: '#ef4444' },
  { label: 'V1.2 Ship', week: 16, color: '#8286FF' },
  { label: 'V1.5 Ship', week: 20, color: '#585CF0' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekX(week: number): number {
  return (week - 1) * WEEK_W + WEEK_W / 2
}

function weekColor(week: number, phases: { color: string; start_week: number; end_week: number }[]): string {
  const phase = phases.find((p) => week >= p.start_week && week <= p.end_week)
  return phase?.color || '#585CF0'
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function SwimLaneView() {
  const tracker = useStore((s) => s.tracker)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 })

  const currentWeek = tracker ? selectCurrentWeek(tracker) : 1

  // Auto-scroll to current week on mount
  useEffect(() => {
    if (scrollRef.current) {
      const targetX = LABEL_W + weekX(currentWeek) - scrollRef.current.clientWidth / 2
      scrollRef.current.scrollLeft = Math.max(0, targetX)
    }
  }, [currentWeek])

  function handleMouseDown(e: React.MouseEvent) {
    // Only drag with left mouse button, and not on interactive elements
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return

    setIsDragging(true)
    setDragStart({ x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft || 0 })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !scrollRef.current) return
    e.preventDefault()
    const dx = e.clientX - dragStart.x
    scrollRef.current.scrollLeft = dragStart.scrollLeft - dx
  }

  function handleMouseUp() {
    setIsDragging(false)
  }

  if (!tracker) return null

  const phases = tracker.schedule.phases

  // Use a ref to measure the container height and compute dynamic lane heights
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerH, setContainerH] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerH(entry.contentRect.height)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Calculate dynamic lane height: fill available space, but never smaller than LANE_H
  const fixedH = HEADER_H + CHECKLIST_H + MARKER_H
  const dynamicLaneH = containerH > 0
    ? Math.max(LANE_H, Math.floor((containerH - fixedH) / LANES.length))
    : LANE_H
  const totalContentH = HEADER_H + LANES.length * dynamicLaneH + CHECKLIST_H + MARKER_H

  return (
    <div ref={containerRef} className="h-full relative overflow-hidden">
      {/* Main scrollable area */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`h-full overflow-auto ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a2e #0A0A10' }}
      >
        <div
          className="relative"
          style={{ width: LABEL_W + TOTAL_W, minHeight: totalContentH }}
        >
          {/* ─── Phase backgrounds ─── */}
          {phases.map((phase) => (
            <div
              key={phase.id}
              className="absolute pointer-events-none"
              style={{
                left: LABEL_W + (phase.start_week - 1) * WEEK_W,
                width: (phase.end_week - phase.start_week + 1) * WEEK_W,
                top: HEADER_H,
                height: LANES.length * dynamicLaneH + CHECKLIST_H,
                backgroundColor: phase.color + '06',
              }}
            />
          ))}

          {/* ─── Week grid lines ─── */}
          {Array.from({ length: TOTAL_WEEKS + 1 }).map((_, i) => (
            <div
              key={`grid-${i}`}
              className="absolute pointer-events-none"
              style={{
                left: LABEL_W + i * WEEK_W,
                top: HEADER_H,
                height: LANES.length * dynamicLaneH + CHECKLIST_H + MARKER_H,
                borderLeft: '1px solid rgba(255,255,255,0.03)',
              }}
            />
          ))}

          {/* ─── Major milestone vertical lines ─── */}
          {MAJOR_MILESTONES.map((mm) => (
            <div
              key={mm.label}
              className="absolute pointer-events-none z-[1]"
              style={{
                left: LABEL_W + weekX(mm.week),
                top: HEADER_H,
                height: LANES.length * dynamicLaneH + CHECKLIST_H,
                borderLeft: `1.5px dashed ${mm.color}35`,
              }}
            />
          ))}

          {/* ─── NOW marker ─── */}
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: LABEL_W + weekX(currentWeek),
              top: 0,
              height: totalContentH,
              width: 2,
              backgroundColor: '#585CF0',
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] font-bold tracking-wider px-2 py-1 rounded-b"
              style={{ backgroundColor: '#585CF0', color: 'white' }}
            >
              NOW
            </div>
          </div>

          {/* ─── Week headers ─── */}
          <div className="flex" style={{ height: HEADER_H }}>
            <div
              className="flex-shrink-0 sticky left-0 z-30 bg-dark border-b border-border"
              style={{ width: LABEL_W }}
            />
            {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
              const w = i + 1
              const isNow = w === currentWeek
              const phase = phases.find((p) => w >= p.start_week && w <= p.end_week)
              // Compute the start date for this week
              const startDate = new Date(tracker.project.start_date)
              startDate.setDate(startDate.getDate() + i * 7)
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              const dateLabel = `${monthNames[startDate.getMonth()]} ${startDate.getDate()}`
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center border-b text-center ${
                    isNow ? 'border-accent/40' : 'border-border'
                  }`}
                  style={{ width: WEEK_W }}
                >
                  <span
                    className={`text-[11px] font-mono font-semibold ${
                      isNow ? 'text-accent' : 'text-muted/50'
                    }`}
                  >
                    W{w}
                  </span>
                  <span
                    className={`text-[8px] font-mono ${
                      isNow ? 'text-accent/70' : 'text-muted/30'
                    }`}
                  >
                    {dateLabel}
                  </span>
                  {phase && w === phase.start_week && (
                    <span
                      className="text-[7px] font-bold tracking-wider mt-0.5"
                      style={{ color: phase.color + '80' }}
                    >
                      {phase.title.toUpperCase()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* ─── Domain Swim Lanes ─── */}
          {LANES.map((lane, laneIdx) => {
            const laneMilestones = tracker.milestones
              .filter((m) => lane.domains.includes(m.domain))
              .sort((a, b) => a.week - b.week)

            return (
              <SwimLane
                key={lane.id}
                lane={lane}
                milestones={laneMilestones}
                selectedId={panelTarget?.type === 'milestone' ? panelTarget.id : null}
                onSelect={(id) => setPanelTarget({ type: 'milestone', id })}
                laneHeight={dynamicLaneH}
              />
            )
          })}

          {/* ─── Checklist Lane ─── */}
          <ChecklistLane
            categories={tracker.submission_checklist.categories}
            phases={phases}
            selectedId={panelTarget?.type === 'category' ? panelTarget.id : null}
            onSelect={(id) => setPanelTarget({ type: 'category', id })}
          />

          {/* ─── Major Milestone Markers ─── */}
          <div className="flex" style={{ height: MARKER_H }}>
            <div
              className="flex-shrink-0 sticky left-0 z-20 bg-dark"
              style={{ width: LABEL_W }}
            />
            <div className="relative" style={{ width: TOTAL_W }}>
              {MAJOR_MILESTONES.map((mm) => (
                <div
                  key={mm.label}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: weekX(mm.week) - 40,
                    top: 8,
                    width: 80,
                  }}
                >
                  {/* Diamond */}
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <rect
                      x="4" y="4" width="12" height="12"
                      rx="2"
                      transform="rotate(45 10 10)"
                      fill={mm.color}
                      stroke={mm.color}
                      strokeWidth="1"
                    />
                  </svg>
                  <span
                    className="text-[8px] font-bold tracking-wider mt-1 whitespace-nowrap"
                    style={{ color: mm.color }}
                  >
                    {mm.label.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Detail Panel (slide-out) ─── */}
      <div
        className="absolute top-0 right-0 h-full z-40 transition-transform duration-300 ease-out"
        style={{
          width: PANEL_W,
          transform: panelTarget ? 'translateX(0)' : `translateX(${PANEL_W}px)`,
        }}
      >
        {panelTarget && (
          <MilestoneDetailPanel
            target={panelTarget}
            onClose={() => setPanelTarget(null)}
          />
        )}
      </div>

      {/* Backdrop when panel open */}
      {panelTarget && (
        <div
          className="absolute inset-0 z-30 bg-black/30 transition-opacity"
          onClick={() => setPanelTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Swim Lane Component ──────────────────────────────────────────────────────

interface SwimLaneProps {
  lane: (typeof LANES)[number]
  milestones: Milestone[]
  selectedId: string | null
  onSelect: (id: string) => void
  laneHeight: number
}

function SwimLane({ lane, milestones, selectedId, onSelect, laneHeight }: SwimLaneProps) {
  // Handle overlapping weeks — give each node at the same week its own horizontal slot
  const weekGroups = new Map<number, number>()
  milestones.forEach((m) => weekGroups.set(m.week, (weekGroups.get(m.week) || 0) + 1))

  const weekIndexes = new Map<number, number>()
  const nodePositions = milestones.map((m) => {
    const idx = weekIndexes.get(m.week) || 0
    weekIndexes.set(m.week, idx + 1)
    const total = weekGroups.get(m.week) || 1
    const baseY = laneHeight / 2 - 8

    if (total === 1) {
      return { milestone: m, y: baseY, xOffset: 0 }
    }

    // Stack nodes vertically within the same week column
    // Center the group around baseY with enough spacing for labels
    const spacing = 70
    const groupH = (total - 1) * spacing
    const y = baseY - groupH / 2 + idx * spacing
    return { milestone: m, y, xOffset: 0 }
  })

  return (
    <div className="flex" style={{ height: laneHeight }}>
      {/* Sticky label */}
      <div
        className="flex-shrink-0 sticky left-0 z-20 bg-dark flex items-center justify-center"
        style={{
          width: LABEL_W,
          borderBottom: `1px solid ${lane.color}20`,
        }}
      >
        <span
          className="text-[11px] font-bold tracking-[0.15em] select-none"
          style={{
            color: lane.color,
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          {lane.label.toUpperCase()}
        </span>
      </div>

      {/* Lane content */}
      <div
        className="relative"
        style={{
          width: TOTAL_W,
          backgroundColor: lane.color + '04',
          borderBottom: `1px solid ${lane.color}15`,
        }}
      >
        {/* Connection lines SVG */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={TOTAL_W}
          height={laneHeight}
        >
          {nodePositions.map(({ milestone: m, y, xOffset }, i) => {
            if (i === 0) return null
            const prev = nodePositions[i - 1]
            const x1 = Math.max(NODE_R + 4, weekX(prev.milestone.week) + prev.xOffset)
            const x2 = Math.max(NODE_R + 4, weekX(m.week) + xOffset)
            return (
              <line
                key={`line-${prev.milestone.id}-${m.id}`}
                x1={x1} y1={prev.y}
                x2={x2} y2={y}
                stroke={lane.color + '25'}
                strokeWidth="1.5"
              />
            )
          })}
        </svg>

        {/* Milestone nodes with drift */}
        {nodePositions.map(({ milestone: m, y, xOffset }) => (
          <MilestoneNodeWithDrift
            key={m.id}
            milestone={m}
            laneColor={lane.color}
            baseY={y}
            xOffset={xOffset}
            isSelected={selectedId === m.id}
            onSelect={() => onSelect(m.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Milestone Node with Drift ────────────────────────────────────────────────

interface NodeDriftProps {
  milestone: Milestone
  laneColor: string
  baseY: number
  xOffset: number
  isSelected: boolean
  onSelect: () => void
}

function MilestoneNodeWithDrift({ milestone, laneColor, baseY, xOffset, isSelected, onSelect }: NodeDriftProps) {
  const { done, total, pct } = selectMilestoneProgress(milestone)
  const color = DOMAIN_COLORS[milestone.domain] || laneColor
  const isKey = milestone.is_key_milestone
  const r = isKey ? KEY_NODE_R : NODE_R
  const size = r * 2 + 4
  const circumference = 2 * Math.PI * (r - 3)

  const rawPlannedX = weekX(milestone.week) + xOffset
  const plannedX = Math.max(r + 4, rawPlannedX) // Clamp so node doesn't clip past left edge
  const driftPx = milestone.drift_days * (WEEK_W / 7)
  const actualX = Math.max(r + 4, plannedX + driftPx)
  const hasDrift = milestone.drift_days !== 0
  const isBehind = milestone.drift_days > 0

  return (
    <>
      {/* Ghost node at planned position (only when drift exists) */}
      {hasDrift && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: plannedX - size / 2,
            top: baseY - size / 2,
          }}
        >
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="opacity-25">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r - 3}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </svg>
        </div>
      )}

      {/* Drift connecting bar */}
      {hasDrift && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: Math.min(plannedX, actualX),
            top: baseY - 1,
            width: Math.abs(driftPx),
            height: 2,
            backgroundColor: isBehind ? '#ef4444' : '#22c55e',
            borderRadius: 1,
          }}
        />
      )}

      {/* Actual node */}
      <div
        className="absolute cursor-pointer group"
        style={{
          left: actualX - size / 2,
          top: baseY - size / 2 - (isKey ? 4 : 0),
        }}
        onClick={onSelect}
      >
        <div className="flex flex-col items-center">
          <div className="relative">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r - 3}
                fill="rgba(17,17,24,0.95)"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="2.5"
              />
              {/* Progress arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r - 3}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              {/* Center text */}
              <text
                x={size / 2}
                y={size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={isKey ? '10' : '9'}
                fontFamily="JetBrains Mono, monospace"
              >
                {done}/{total}
              </text>
            </svg>

            {/* Key milestone glow */}
            {isKey && (
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: `0 0 16px 3px ${color}30` }}
              />
            )}

            {/* Selection indicator */}
            {isSelected && (
              <div
                className="absolute -inset-1 rounded-full border-2 pointer-events-none"
                style={{ borderColor: color }}
              />
            )}
          </div>

          {/* Label */}
          <div className="mt-1 text-center" style={{ maxWidth: 94 }}>
            {isKey && milestone.key_milestone_label && (
              <div
                className="text-[7px] font-bold tracking-wider leading-none mb-0.5"
                style={{ color }}
              >
                ★ {milestone.key_milestone_label}
              </div>
            )}
            <div className="text-[8px] text-white/60 truncate leading-tight group-hover:text-white/90 transition-colors">
              {milestone.title}
            </div>
          </div>

          {/* Drift badge */}
          {hasDrift && (
            <div
              className="text-[7px] font-bold mt-0.5 whitespace-nowrap"
              style={{ color: isBehind ? '#ef4444' : '#22c55e' }}
            >
              {Math.abs(milestone.drift_days)} DAY{Math.abs(milestone.drift_days) !== 1 ? 'S' : ''}{' '}
              {isBehind ? '▸' : '◂'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Checklist Lane ───────────────────────────────────────────────────────────

interface ChecklistLaneProps {
  categories: ChecklistCategory[]
  phases: { color: string; start_week: number; end_week: number }[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function ChecklistLane({ categories, phases, selectedId, onSelect }: ChecklistLaneProps) {
  return (
    <div className="flex" style={{ height: CHECKLIST_H }}>
      {/* Sticky label */}
      <div
        className="flex-shrink-0 sticky left-0 z-20 bg-dark flex items-center justify-center border-b border-border"
        style={{ width: LABEL_W }}
      >
        <span
          className="text-[10px] font-bold tracking-[0.15em] text-accent-light select-none"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          CHECKLIST
        </span>
      </div>

      {/* Lane content */}
      <div
        className="relative border-b border-border"
        style={{
          width: TOTAL_W,
          backgroundColor: 'rgba(88,92,240,0.02)',
        }}
      >
        {/* Compliance bar spanning W1-W10 */}
        <div
          className="absolute rounded-lg p-3 overflow-hidden"
          style={{
            left: 4,
            width: 10 * WEEK_W - 8,
            top: 4,
            bottom: 4,
            backgroundColor: 'rgba(88,92,240,0.05)',
            border: '1px solid rgba(88,92,240,0.12)',
          }}
        >
          <div className="text-[8px] font-bold tracking-[0.2em] text-accent-light/70 mb-2">
            BUILD COMPLIANCE FROM WEEK 1
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {categories.map((cat) => {
              const { done, total, pct } = selectCategoryProgress(cat)
              const isCritical = cat.risk_level === 'critical'
              const isPreSubmit = cat.id === 'pre_submit'
              const dotColor = weekColor(cat.target_week, phases)

              return (
                <div
                  key={cat.id}
                  className={`rounded px-2 py-1.5 cursor-pointer transition-all hover:brightness-125 ${
                    selectedId === cat.id ? 'ring-1 ring-accent' : ''
                  } ${
                    isCritical
                      ? 'border border-behind/50 bg-behind/8'
                      : isPreSubmit
                        ? 'border border-accent/30 bg-accent/8'
                        : 'border border-white/6 bg-white/4'
                  }`}
                  onClick={() => onSelect(cat.id)}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {isCritical && <span className="text-[7px] text-behind">⚠</span>}
                    <span className="text-[8px] text-white/80 font-medium truncate leading-none">
                      {cat.title}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto"
                      style={{ backgroundColor: dotColor }}
                    />
                  </div>
                  <div className="w-full h-[3px] bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isCritical ? '#ef4444' : '#585CF0',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[7px] text-muted font-mono">
                      {done}/{total}
                    </span>
                    {isCritical && (
                      <span className="text-[6px] text-behind font-bold">
                        #1 RISK
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Post-W10 fade out indicator */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: 10 * WEEK_W + 16,
            top: 0,
            bottom: 0,
            width: 10 * WEEK_W - 32,
          }}
        >
          <span className="text-[10px] text-muted/30 font-mono tracking-wider">
            POST-SUBMISSION
          </span>
        </div>
      </div>
    </div>
  )
}
