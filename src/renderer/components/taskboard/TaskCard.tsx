import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Subtask } from '../../../main/parser'

// AI Commerce Index Platform — 4-lane palette. Mirrors DOMAIN_COLOR_MAP in
// ../../domainModel.ts. Legacy raw-domain keys retained so stale milestones
// don't render with missing colors.
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

// Execution-mode palette (used for left border + badge) — operator's spec:
//   agent = red    (fully autonomous — the agent owns this)
//   pair  = blue   (agent + operator collaboration required)
//   human = green  (operator-only; outside agent capability)
const EXEC_MODE_COLORS: Record<string, string> = {
  agent: '#EF4444',
  pair: '#3B82F6',
  human: '#22C55E',
}

const EXEC_MODE_LABELS: Record<string, string> = {
  agent: 'AGENT',
  pair: 'PAIR',
  human: 'HUMAN',
}

// Complexity badge palette:
//   S small, M medium, L large, A architectural
const COMPLEXITY_PALETTE: Record<string, { label: string; color: string }> = {
  small: { label: 'S', color: '#9B9BAA' },
  medium: { label: 'M', color: '#5B6EE8' },
  large: { label: 'L', color: '#8A5CF0' },
  architectural: { label: 'A', color: '#EF4444' },
}

const STEP_STYLE = { color: '#c4b5fd', bg: 'rgba(196,181,253,0.15)' }
const PARALLEL_STYLE = { color: '#facc15', bg: 'rgba(250,204,21,0.15)' }

interface TaskCardProps {
  subtask: Subtask
  domain: string
  onClick: () => void
}

export function TaskCard({ subtask, domain, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const domainColor = DOMAIN_COLORS[domain] || '#9B9BAA'
  const execModeColor = EXEC_MODE_COLORS[subtask.execution_mode || 'human'] || EXEC_MODE_COLORS.human
  const isParallel = subtask.notes?.includes('🔀') ?? false
  const stepStyle = isParallel ? PARALLEL_STYLE : STEP_STYLE
  const stepLabel = subtask.priority && /^\d+$/.test(subtask.priority)
    ? (isParallel ? `🔀 #${subtask.priority}` : `#${subtask.priority}`)
    : subtask.priority
  const isInProgress = subtask.status === 'in_progress'
  const isBlocked = subtask.status === 'blocked'

  // Split label into title + description if long
  const parts = subtask.label.split(/[:.–—]\s+/, 2)
  const title = parts[0]
  const description = parts.length > 1 ? subtask.label.slice(parts[0].length).replace(/^[:.–—]\s+/, '') : null

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftColor: execModeColor,
        borderLeftWidth: '3px',
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group relative rounded-lg border bg-surface p-3 cursor-grab active:cursor-grabbing transition-all hover:border-accent/30 ${
        isDragging ? 'opacity-50 shadow-lg shadow-accent/10 scale-[1.02] z-50' : ''
      } ${isInProgress ? 'border-accent/40' : isBlocked ? 'border-border' : 'border-border'}`}
    >
      {/* In-progress pulsing indicator */}
      {isInProgress && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent animate-pulse" />
      )}

      {/* Top row: domain tag + audit badge (left) · complexity + exec-mode + wave (right) */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
            style={{ color: domainColor, backgroundColor: domainColor + '18' }}
          >
            {domain.replace(/_/g, ' ').toUpperCase()}
          </span>
          {/* Audit badge — visible when the auditor has submitted results */}
          {subtask.audit_results && (
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
              style={{
                color: subtask.audit_results.pass ? '#22C55E' : '#EF4444',
                backgroundColor: (subtask.audit_results.pass ? '#22C55E' : '#EF4444') + '1a',
              }}
              title={
                subtask.audit_results.pass
                  ? `Audit passed (${subtask.audit_results.items.filter((i) => i.status === 'pass').length}/12)`
                  : `Audit failed: ${subtask.audit_results.items.filter((i) => i.status === 'fail').map((i) => i.id).join(', ')}`
              }
            >
              {subtask.audit_results.pass ? '✓ AUDIT' : '✗ AUDIT'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Complexity badge */}
          {subtask.complexity && COMPLEXITY_PALETTE[subtask.complexity] && (
            <span
              className="text-[9px] font-bold w-4 h-4 rounded flex items-center justify-center"
              style={{
                color: COMPLEXITY_PALETTE[subtask.complexity].color,
                backgroundColor: COMPLEXITY_PALETTE[subtask.complexity].color + '22',
              }}
              title={`Complexity: ${subtask.complexity}`}
            >
              {COMPLEXITY_PALETTE[subtask.complexity].label}
            </span>
          )}
          {/* Exec-mode badge */}
          {subtask.execution_mode && EXEC_MODE_LABELS[subtask.execution_mode] && (
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider"
              style={{ color: execModeColor, backgroundColor: execModeColor + '1a' }}
              title={`Execution mode: ${subtask.execution_mode}`}
            >
              {EXEC_MODE_LABELS[subtask.execution_mode]}
            </span>
          )}
          {/* Wave / priority badge */}
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: stepStyle.color, backgroundColor: stepStyle.bg }}
            title={`Parallel wave: ${stepLabel}`}
          >
            {stepLabel}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="text-xs text-white font-medium leading-snug mb-1">{title}</p>

      {/* Description */}
      {description && (
        <p className="text-[10px] text-muted leading-snug mb-1.5 line-clamp-2">{description}</p>
      )}

      {/* Blocker bar */}
      {isBlocked && subtask.blocked_reason && (
        <div className="mt-2 px-2 py-1.5 rounded bg-behind/10 border border-behind/20">
          <span className="text-[10px] text-behind leading-snug">{subtask.blocked_reason}</span>
        </div>
      )}

      {/* Bottom row: assignee */}
      {subtask.assignee && (
        <div className="flex items-center justify-end mt-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted font-medium">
            {subtask.assignee}
            {/* Pulsing dot for agent assignees */}
            {subtask.assignee !== 'Luqman' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-on-track ml-1 animate-pulse" />
            )}
          </span>
        </div>
      )}
    </div>
  )
}
