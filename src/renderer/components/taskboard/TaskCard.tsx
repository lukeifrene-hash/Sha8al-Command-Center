import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Subtask } from '../../../main/parser'

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

const EXEC_MODE_COLORS: Record<string, string> = {
  agent: '#ef4444',   // Red
  human: '#22c55e',   // Green
  pair: '#3b82f6',    // Blue
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

      {/* Top row: domain tag + priority */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
          style={{ color: domainColor, backgroundColor: domainColor + '18' }}
        >
          {domain.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: stepStyle.color, backgroundColor: stepStyle.bg }}
        >
          {stepLabel}
        </span>
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
