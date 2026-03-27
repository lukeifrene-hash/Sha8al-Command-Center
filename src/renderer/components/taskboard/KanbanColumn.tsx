import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import type { Subtask } from '../../../main/parser'

export type ColumnId = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'

interface ColumnConfig {
  id: ColumnId
  label: string
  color: string
}

export const COLUMNS: ColumnConfig[] = [
  { id: 'todo', label: 'TO DO', color: '#9B9BAA' },
  { id: 'in_progress', label: 'IN PROGRESS', color: '#585CF0' },
  { id: 'review', label: 'REVIEW', color: '#f59e0b' },
  { id: 'done', label: 'DONE', color: '#22c55e' },
  { id: 'blocked', label: 'BLOCKED', color: '#ef4444' },
]

interface KanbanColumnProps {
  column: ColumnConfig
  subtasks: Subtask[]
  domain: string
  onCardClick: (subtask: Subtask) => void
}

export function KanbanColumn({ column, subtasks, domain, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const ids = subtasks.map((s) => s.id)

  return (
    <div className="flex flex-col min-w-0 rounded-lg border border-border overflow-hidden">
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface/50">
        <div
          className="h-0.5 w-4 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <span
          className="text-[10px] font-bold tracking-wider"
          style={{ color: column.color }}
        >
          {column.label}
        </span>
        <span className="text-[10px] text-muted font-mono ml-auto">{subtasks.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px] transition-colors ${
          isOver ? 'bg-accent/5' : ''
        }`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {subtasks.map((s) => (
            <TaskCard
              key={s.id}
              subtask={s}
              domain={domain}
              onClick={() => onCardClick(s)}
            />
          ))}
        </SortableContext>

        {subtasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-[10px] text-muted/50 tracking-wider">
            DROP HERE
          </div>
        )}
      </div>
    </div>
  )
}
