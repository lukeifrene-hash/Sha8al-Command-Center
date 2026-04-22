import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChecklistCategory, Milestone, TrackerState } from '../../main/parser'
import { useStore, selectCategoryProgress, selectMilestoneProgress } from '../store'
import { MilestoneDetailPanel, type PanelTarget } from '../components/swim-lane/MilestoneDetailPanel'
import {
  DOMAIN_LANES,
  getMilestoneAccentColor,
  normalizeMilestoneDomain,
  type DisplayDomain,
  type DomainLane,
} from '../domainModel'
import { getQAHubSnapshot } from '../qaHubModel'

const WEEK_W = 120
const LANE_H = 210
const LABEL_W = 140
const HEADER_H = 52
const CHECKLIST_H = 210
const MARKER_H = 64
const TOTAL_WEEKS = 12
const TOTAL_W = TOTAL_WEEKS * WEEK_W
const NODE_R = 22
const KEY_NODE_R = 28
const PANEL_W = 480
const OFFSETS_STORAGE_KEY = 'talkstore-swimlane-offsets-v4-aci'

const LANES = DOMAIN_LANES

// AI Commerce Index Platform — 8 phase bands across 12 weeks. Mirrors the
// schedule.phases in talkstore-tracker.json. Phase 2 (Backend Core) holds 4
// milestones (M3-M6) and gets 4 weeks; Phase 3 (Frontend) holds M7 and gets
// 2 weeks; every other phase is a single week.
const DISPLAY_PHASES = [
  { id: 'phase_0_prep', title: 'Prep', color: '#2A2A34', start_week: 1, end_week: 1 },
  { id: 'phase_1_foundation', title: 'Foundation', color: '#585CF0', start_week: 2, end_week: 2 },
  { id: 'phase_2_backend_core', title: 'Backend Core', color: '#14B8A6', start_week: 3, end_week: 6 },
  { id: 'phase_3_frontend', title: 'Frontend', color: '#5B6EE8', start_week: 7, end_week: 8 },
  { id: 'phase_4_ux_polish', title: 'UX Polish', color: '#8A5CF0', start_week: 9, end_week: 9 },
  { id: 'phase_5_quality', title: 'Quality', color: '#F59E0B', start_week: 10, end_week: 10 },
  { id: 'phase_6_launch', title: 'Launch', color: '#F7C948', start_week: 11, end_week: 11 },
  { id: 'phase_7_post_launch', title: 'Post-launch', color: '#22C55E', start_week: 12, end_week: 12 },
]

// Major milestone markers — dashed vertical lines on the swimlane.
// Pivot-era anchors: M1 purge complete, M9 quality gate, M10 Shopify submission.
const MAJOR_MILESTONES = [
  { label: 'Purge Complete', week: 1, color: '#585CF0' },
  { label: 'Backend Core Done', week: 6, color: '#14B8A6' },
  { label: 'Quality Gate', week: 10, color: '#F59E0B' },
  { label: 'App Store Submit', week: 11, color: '#F7C948' },
]

type NodeOffsets = Record<string, { dx: number; dy: number }>

type SwimNodeKind = 'milestone' | 'qa_hub'

interface SwimLaneNode {
  id: string
  kind: SwimNodeKind
  title: string
  laneId: DisplayDomain
  week: number
  color: string
  isKey?: boolean
  metricText: string
  caption?: string
  tooltipMeta?: string[]
  progressPct: number
  target: PanelTarget
  // Milestone-audit verdict (optional): when a milestone-auditor has run, this
  // drives an outer colored ring on the node so the operator can see at a glance
  // which milestones have been audited + the verdict without opening the panel.
  auditVerdict?: 'pass' | 'pass_with_notes' | 'fail'
}

const AUDIT_RING_COLORS: Record<NonNullable<SwimLaneNode['auditVerdict']>, string> = {
  pass: '#22C55E',
  pass_with_notes: '#F59E0B',
  fail: '#EF4444',
}

function weekX(week: number): number {
  return (week - 1) * WEEK_W + WEEK_W / 2
}

function getStoredNodeOffsets(): NodeOffsets {
  try {
    const raw = localStorage.getItem(OFFSETS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as NodeOffsets
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Per-milestone display-week overrides (ROADMAP.md ordering).
// Each milestone sits at a single column in the swimlane; dependencies read
// left-to-right. Phase 2 (Backend Core) packs 4 milestones in W3-W6.
const MILESTONE_DISPLAY_WEEK: Record<string, number> = {
  m1_purge_and_foundation_reset: 1,
  m2_multi_llm_and_async_infra: 2,
  m3_scoring_engine: 3,
  m4_catalog_intelligence_engine: 4,
  m5_autopilot_and_guard: 5,
  m6_attribution_pipeline: 6,
  m7_merchant_surfaces: 7,
  m8_ux_polish_and_marketing: 9,
  m9_quality_security_compliance: 10,
  m10_launch_and_post_launch: 11,
}

// Phase → default start week (used when a milestone has no ID override).
const PHASE_START_WEEK: Record<string, number> = {
  phase_0_prep: 1,
  phase_1_foundation: 2,
  phase_2_backend_core: 3,
  phase_3_frontend: 7,
  phase_4_ux_polish: 9,
  phase_5_quality: 10,
  phase_6_launch: 11,
  phase_7_post_launch: 12,
}

function getMilestoneDisplayWeek(milestone: Milestone): number {
  const byId = MILESTONE_DISPLAY_WEEK[milestone.id]
  if (byId !== undefined) return byId

  const byPhase = PHASE_START_WEEK[milestone.phase]
  if (byPhase !== undefined) return byPhase

  return Math.max(1, Math.min(TOTAL_WEEKS, milestone.week || 1))
}

// Pick the column to scroll the viewport to on mount. The swimlane no longer
// has a calendar axis, so "NOW" is meaningless. Instead we focus on the first
// milestone that still has outstanding work — the operator lands where action
// is needed. Falls back to week 1 (pre-build prep) if everything is done.
function resolveFocusWeek(tracker: TrackerState): number {
  for (const m of tracker.milestones) {
    const total = m.subtasks.length
    const done = m.subtasks.filter((s) => s.done).length
    if (total === 0 || done < total) {
      const byId = MILESTONE_DISPLAY_WEEK[m.id]
      if (byId !== undefined) return byId
      const byPhase = PHASE_START_WEEK[m.phase]
      if (byPhase !== undefined) return byPhase
      return Math.max(1, Math.min(TOTAL_WEEKS, m.week || 1))
    }
  }
  return 1
}

function buildSwimLaneNodes(tracker: TrackerState): SwimLaneNode[] {
  const milestoneNodes: SwimLaneNode[] = tracker.milestones
    .filter((milestone) => milestone.id !== 'debug_review')
    .map((milestone) => {
      const progress = selectMilestoneProgress(milestone)
      // `milestone.audit` is set by mcp submit_milestone_audit when a milestone-
      // audit cycle completes. Surfacing it as a colored outer ring lets the
      // operator see audit state at a glance without opening the detail panel.
      const auditVerdict = milestone.audit?.verdict
      const auditTooltip = auditVerdict
        ? `Milestone audit: ${auditVerdict.toUpperCase().replace(/_/g, ' ')}`
        : null
      return {
        id: `milestone:${milestone.id}`,
        kind: 'milestone' as const,
        title: milestone.title,
        laneId: normalizeMilestoneDomain(milestone),
        week: getMilestoneDisplayWeek(milestone),
        color: getMilestoneAccentColor(milestone),
        isKey: milestone.is_key_milestone,
        metricText: `${progress.done}/${progress.total}`,
        caption: milestone.phase.replace(/_/g, ' '),
        tooltipMeta: [
          `${progress.done}/${progress.total} subtasks complete`,
          milestone.drift_days !== 0
            ? `${Math.abs(milestone.drift_days)} day${Math.abs(milestone.drift_days) !== 1 ? 's' : ''} ${milestone.drift_days > 0 ? 'behind' : 'ahead'}`
            : 'On schedule',
          ...(auditTooltip ? [auditTooltip] : []),
        ],
        progressPct: progress.pct,
        target: { type: 'milestone' as const, id: milestone.id },
        auditVerdict,
      }
    })

  // QA Hub is a synthesized node (not a tracker milestone). Anchor it to the
  // Quality phase (W10) in the Ship & Operate lane so it renders alongside M9
  // without colliding with any real milestone's W10 slot.
  const qaHub = getQAHubSnapshot(tracker)
  const qaNode: SwimLaneNode = {
    id: 'qa-hub',
    kind: 'qa_hub',
    title: 'QA',
    laneId: 'ship_and_operate',
    week: 10,
    color: qaHub.color,
    metricText: qaHub.metricText,
    caption: qaHub.caption,
    tooltipMeta: qaHub.tooltipMeta,
    progressPct: qaHub.progressPct,
    target: { type: 'qa_hub', id: 'qa' },
  }

  return [...milestoneNodes, qaNode]
}

function getTargetKey(target: PanelTarget | null): string | null {
  return target ? `${target.type}:${target.id}` : null
}

function weekColor(
  week: number,
  phases: { color: string; start_week: number; end_week: number }[],
): string {
  const phase = phases.find((p) => week >= p.start_week && week <= p.end_week)
  return phase?.color || '#585CF0'
}

export function SwimLaneView() {
  const tracker = useStore((s) => s.tracker)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null)
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 })
  const [nodeOffsets, setNodeOffsets] = useState<NodeOffsets>(() => getStoredNodeOffsets())
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [recentlyDraggedId, setRecentlyDraggedId] = useState<string | null>(null)
  const [containerH, setContainerH] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const phases = DISPLAY_PHASES
  const nodes = useMemo(() => (tracker ? buildSwimLaneNodes(tracker) : []), [tracker])
  const focusWeek = tracker ? resolveFocusWeek(tracker) : 1
  const selectedTargetKey = getTargetKey(panelTarget)

  useEffect(() => {
    if (scrollRef.current) {
      const targetX = LABEL_W + weekX(focusWeek) - scrollRef.current.clientWidth / 2
      scrollRef.current.scrollLeft = Math.max(0, targetX)
    }
  }, [focusWeek])

  useEffect(() => {
    try {
      localStorage.setItem(OFFSETS_STORAGE_KEY, JSON.stringify(nodeOffsets))
    } catch {
      // ignore storage failures
    }
  }, [nodeOffsets])

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

  const handleNodeDragStart = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDraggingNodeId(id)
    const startX = e.clientX
    const startY = e.clientY
    const startOffset = nodeOffsets[id] || { dx: 0, dy: 0 }
    let moved = false

    function onMove(ev: MouseEvent) {
      ev.preventDefault()
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true

      setNodeOffsets((prev) => ({
        ...prev,
        [id]: {
          dx: startOffset.dx + dx,
          dy: startOffset.dy + dy,
        },
      }))
    }

    function onUp() {
      setDraggingNodeId(null)
      if (moved) {
        setRecentlyDraggedId(id)
        window.setTimeout(() => setRecentlyDraggedId((prev) => (prev === id ? null : prev)), 120)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [nodeOffsets])

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('[data-drag-node]')) return

    setIsDraggingCanvas(true)
    setDragStart({ x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft || 0 })
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDraggingCanvas || !scrollRef.current) return
    e.preventDefault()
    const dx = e.clientX - dragStart.x
    scrollRef.current.scrollLeft = dragStart.scrollLeft - dx
  }

  function handleMouseUp() {
    setIsDraggingCanvas(false)
  }

  if (!tracker) return null

  const fixedH = HEADER_H + CHECKLIST_H + MARKER_H
  const dynamicLaneH =
    containerH > 0 ? Math.max(LANE_H, Math.floor((containerH - fixedH) / LANES.length)) : LANE_H
  const totalContentH = HEADER_H + LANES.length * dynamicLaneH + CHECKLIST_H + MARKER_H

  return (
    <div ref={containerRef} className="h-full relative overflow-hidden">
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`h-full overflow-auto ${isDraggingCanvas ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a2e #0A0A10' }}
      >
        <div className="relative" style={{ width: LABEL_W + TOTAL_W, minHeight: totalContentH }}>
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

          {/*
            Swimlane header — dateless. We render one label per PHASE band
            (centered over its column range), not one label per week, because
            the x-axis now represents dependency order, not calendar time.
            Timestamps remain available everywhere else: Calendar (completed_at),
            Agent Hub (agent_log.timestamp), Milestone detail panel (actual_start
            / actual_end when populated by MCP start_task/complete_task), and
            the tracker's project.start_date remains in the JSON for agents
            that need a project reference point.
          */}
          <div className="flex" style={{ height: HEADER_H }}>
            <div
              className="flex-shrink-0 sticky left-0 z-30 bg-dark border-b border-border"
              style={{ width: LABEL_W }}
            />
            <div className="relative border-b border-border" style={{ width: TOTAL_W }}>
              {phases.map((phase) => {
                const widthCols = phase.end_week - phase.start_week + 1
                return (
                  <div
                    key={phase.id}
                    className="absolute inset-y-0 flex flex-col items-center justify-center text-center px-2"
                    style={{
                      left: (phase.start_week - 1) * WEEK_W,
                      width: widthCols * WEEK_W,
                    }}
                  >
                    <span
                      className="text-[10px] font-bold tracking-[0.18em]"
                      style={{ color: phase.color }}
                    >
                      {phase.title.toUpperCase()}
                    </span>
                    <span className="text-[7px] font-mono uppercase tracking-widest text-muted/40 mt-0.5">
                      {phase.id.replace(/^phase_/, 'phase ')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {LANES.map((lane) => {
            const laneNodes = nodes
              .filter((node) => node.laneId === lane.id)
              .sort((a, b) => a.week - b.week || a.title.localeCompare(b.title))

            return (
              <SwimLane
                key={lane.id}
                lane={lane}
                nodes={laneNodes}
                selectedTargetKey={selectedTargetKey}
                onSelect={(target) => setPanelTarget(target)}
                laneHeight={dynamicLaneH}
                nodeOffsets={nodeOffsets}
                draggingNodeId={draggingNodeId}
                recentlyDraggedId={recentlyDraggedId}
                onNodeDragStart={handleNodeDragStart}
              />
            )
          })}

          <ChecklistLane
            categories={tracker.submission_checklist.categories}
            phases={phases}
            selectedId={panelTarget?.type === 'category' ? panelTarget.id : null}
            onSelect={(id) => setPanelTarget({ type: 'category', id })}
          />

          <div className="flex" style={{ height: MARKER_H }}>
            <div className="flex-shrink-0 sticky left-0 z-20 bg-dark" style={{ width: LABEL_W }} />
            <div className="relative" style={{ width: TOTAL_W }}>
              {MAJOR_MILESTONES.map((mm) => (
                <div
                  key={mm.label}
                  className="absolute flex flex-col items-center"
                  style={{ left: weekX(mm.week) - 40, top: 8, width: 80 }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <rect
                      x="4"
                      y="4"
                      width="12"
                      height="12"
                      rx="2"
                      transform="rotate(45 10 10)"
                      fill={mm.color}
                      stroke={mm.color}
                      strokeWidth="1"
                    />
                  </svg>
                  <span className="text-[8px] font-bold tracking-wider mt-1 whitespace-nowrap" style={{ color: mm.color }}>
                    {mm.label.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 right-0 h-full z-40 transition-transform duration-300 ease-out"
        style={{
          width: PANEL_W,
          transform: panelTarget ? 'translateX(0)' : `translateX(${PANEL_W}px)`,
        }}
      >
        {panelTarget && <MilestoneDetailPanel target={panelTarget} onClose={() => setPanelTarget(null)} />}
      </div>

      {panelTarget && (
        <div className="absolute inset-0 z-30 bg-black/30 transition-opacity" onClick={() => setPanelTarget(null)} />
      )}
    </div>
  )
}

interface SwimLaneProps {
  lane: DomainLane
  nodes: SwimLaneNode[]
  selectedTargetKey: string | null
  onSelect: (target: PanelTarget) => void
  laneHeight: number
  nodeOffsets: NodeOffsets
  draggingNodeId: string | null
  recentlyDraggedId: string | null
  onNodeDragStart: (id: string, e: React.MouseEvent) => void
}

function SwimLane({
  lane,
  nodes,
  selectedTargetKey,
  onSelect,
  laneHeight,
  nodeOffsets,
  draggingNodeId,
  recentlyDraggedId,
  onNodeDragStart,
}: SwimLaneProps) {
  const weekGroups = new Map<number, number>()
  nodes.forEach((node) => weekGroups.set(node.week, (weekGroups.get(node.week) || 0) + 1))

  const weekIndexes = new Map<number, number>()
  const nodePositions = nodes.map((node) => {
    const idx = weekIndexes.get(node.week) || 0
    weekIndexes.set(node.week, idx + 1)
    const total = weekGroups.get(node.week) || 1
    const baseY = laneHeight / 2 - 8

    if (total === 1) return { node, y: baseY, stacked: false }

    const spacing = total >= 3 ? 60 : 78
    const groupH = (total - 1) * spacing
    const y = baseY - groupH / 2 + idx * spacing
    return { node, y, stacked: true }
  })

  return (
    <div className="flex" style={{ height: laneHeight, position: 'relative' }}>
      <div
        className="flex-shrink-0 sticky left-0 z-20 bg-dark flex items-center justify-center"
        style={{ width: LABEL_W, borderBottom: `1px solid ${lane.color}20` }}
      >
        <span
          className="text-[11px] font-bold tracking-[0.15em] select-none"
          style={{ color: lane.color, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {lane.label.toUpperCase()}
        </span>
      </div>

      <div
        className="relative"
        style={{ width: TOTAL_W, backgroundColor: lane.color + '04', borderBottom: `1px solid ${lane.color}15` }}
      >
        {nodePositions.map(({ node, y, stacked }) => (
          <SwimLaneNodeCard
            key={node.id}
            node={node}
            baseY={y}
            isSelected={selectedTargetKey === getTargetKey(node.target)}
            labelSide={stacked ? 'right' : 'bottom'}
            dragOffset={nodeOffsets[node.id]}
            isDragging={draggingNodeId === node.id}
            recentlyDragged={recentlyDraggedId === node.id}
            onSelect={() => onSelect(node.target)}
            onDragStart={(e) => onNodeDragStart(node.id, e)}
          />
        ))}
      </div>
    </div>
  )
}

interface SwimLaneNodeCardProps {
  node: SwimLaneNode
  baseY: number
  isSelected: boolean
  labelSide: 'bottom' | 'right'
  dragOffset?: { dx: number; dy: number }
  isDragging?: boolean
  recentlyDragged?: boolean
  onSelect: () => void
  onDragStart?: (e: React.MouseEvent) => void
}

function SwimLaneNodeCard({
  node,
  baseY,
  isSelected,
  labelSide,
  dragOffset,
  isDragging,
  recentlyDragged,
  onSelect,
  onDragStart,
}: SwimLaneNodeCardProps) {
  const r = node.isKey ? KEY_NODE_R : NODE_R
  const size = r * 2 + 4
  const circumference = 2 * Math.PI * (r - 3)
  const x = weekX(node.week)

  return (
    <div
      data-drag-node
      className={`absolute group ${isDragging ? 'cursor-grabbing z-50' : 'cursor-grab'}`}
      style={{
        left: x - size / 2 + (dragOffset?.dx || 0),
        top: baseY - size / 2 - (node.isKey ? 4 : 0) + (dragOffset?.dy || 0),
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        filter: isDragging ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' : undefined,
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return
        onDragStart?.(e)
      }}
      onClick={() => {
        if (!recentlyDragged) onSelect()
      }}
    >
      <div className={labelSide === 'right' ? 'flex flex-row items-center gap-3' : 'flex flex-col items-center'}>
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Outer audit-verdict ring — appears only after a milestone audit has run */}
            {node.auditVerdict && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r + 1}
                fill="none"
                stroke={AUDIT_RING_COLORS[node.auditVerdict]}
                strokeWidth="1.5"
                strokeDasharray={node.auditVerdict === 'fail' ? '3 2' : undefined}
                opacity={0.85}
              />
            )}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r - 3}
              fill="rgba(17,17,24,0.95)"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="2.5"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r - 3}
              fill="none"
              stroke={node.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${(node.progressPct / 100) * circumference} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            <text
              x={size / 2}
              y={size / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={node.kind === 'milestone' ? (node.isKey ? '9' : '8') : '8'}
              fontFamily="JetBrains Mono, monospace"
            >
              {node.metricText}
            </text>
          </svg>

          {node.isKey && (
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: `0 0 16px 3px ${node.color}30` }} />
          )}

          {isSelected && (
            <div className="absolute -inset-1 rounded-full border-2 pointer-events-none" style={{ borderColor: node.color }} />
          )}
        </div>

        <div className={`min-w-0 ${labelSide === 'right' ? 'max-w-[180px] text-left' : 'mt-2 max-w-[120px] text-center'}`}>
          <div className="text-[9px] font-medium leading-tight text-white/92">
            {node.title}
          </div>
          {node.caption && (
            <div className="text-[7px] font-mono uppercase tracking-wider text-muted mt-1">
              {node.caption}
            </div>
          )}
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50"
          style={{ top: size + 8 }}
        >
          <div
            className="rounded px-2.5 py-1.5 text-center whitespace-nowrap shadow-lg backdrop-blur-sm"
            style={{ backgroundColor: 'rgba(10,10,16,0.97)', border: `1px solid ${node.color}50` }}
          >
            <div className="text-[9px] leading-tight font-medium text-white">{node.title}</div>
            {(node.tooltipMeta ?? []).map((line) => (
              <div key={`${node.id}-${line}`} className="text-[7px] mt-1" style={{ color: node.color }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ChecklistLaneProps {
  categories: ChecklistCategory[]
  phases: { color: string; start_week: number; end_week: number }[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function ChecklistLane({ categories, phases, selectedId, onSelect }: ChecklistLaneProps) {
  return (
    <div className="flex" style={{ height: CHECKLIST_H }}>
      <div
        className="flex-shrink-0 sticky left-0 z-20 bg-dark flex items-center justify-center border-b border-border"
        style={{ width: LABEL_W }}
      >
        <span
          className="text-[10px] font-bold tracking-[0.15em] text-accent-light select-none"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          CHECKLIST
        </span>
      </div>

      <div className="relative border-b border-border" style={{ width: TOTAL_W, backgroundColor: 'rgba(88,92,240,0.02)' }}>
        <div
          className="absolute rounded-lg p-3 overflow-hidden"
          style={{
            left: 4,
            width: TOTAL_W - 8,
            top: 4,
            bottom: 4,
            backgroundColor: 'rgba(88,92,240,0.05)',
            border: '1px solid rgba(88,92,240,0.12)',
          }}
        >
          <div className="text-[8px] font-bold tracking-[0.2em] text-accent-light/70 mb-2">
            SUBMISSION CHECKLIST
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {categories.map((cat) => {
              const { done, total, pct } = selectCategoryProgress(cat)
              const isCritical = cat.risk_level === 'critical'
              const dotColor = weekColor(Math.min(cat.target_week, TOTAL_WEEKS), phases)

              return (
                <div
                  key={cat.id}
                  className={`rounded px-2 py-1.5 cursor-pointer transition-all hover:brightness-125 ${
                    selectedId === cat.id ? 'ring-1 ring-accent' : ''
                  } ${
                    isCritical ? 'border border-behind/50 bg-behind/8' : 'border border-white/6 bg-white/4'
                  }`}
                  onClick={() => onSelect(cat.id)}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {isCritical && <span className="text-[7px] text-behind">⚠</span>}
                    <span className="text-[8px] text-white/80 font-medium truncate leading-none">{cat.title}</span>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto" style={{ backgroundColor: dotColor }} />
                  </div>
                  <div className="w-full h-[3px] bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: isCritical ? '#ef4444' : '#585CF0' }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[7px] text-muted font-mono">{done}/{total}</span>
                    {isCritical && <span className="text-[6px] text-behind font-bold">#1 RISK</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
