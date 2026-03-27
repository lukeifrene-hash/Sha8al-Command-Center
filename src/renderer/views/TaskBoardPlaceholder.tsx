import { useStore, selectTotalSubtasks, selectDoneSubtasks } from '../store'

export function TaskBoardPlaceholder() {
  const tracker = useStore((s) => s.tracker)
  if (!tracker) return null

  const total = selectTotalSubtasks(tracker)
  const done = selectDoneSubtasks(tracker)
  const blocked = tracker.milestones.reduce(
    (s, m) => s + m.subtasks.filter((t) => t.blocked_by !== null).length, 0
  )
  const inProgress = tracker.milestones.reduce(
    (s, m) => s + m.subtasks.filter((t) => t.status === 'in_progress').length, 0
  )
  const todo = total - done - blocked - inProgress

  const columns = [
    { label: 'TO DO', count: todo, color: '#9B9BAA' },
    { label: 'IN PROGRESS', count: inProgress, color: '#585CF0' },
    { label: 'DONE', count: done, color: '#22c55e' },
    { label: 'BLOCKED', count: blocked, color: '#ef4444' },
  ]

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Task Board</h2>
          <p className="text-xs text-muted mt-0.5">Phase 3 will render the Kanban board with drag-and-drop here.</p>
        </div>
        <span className="text-xs text-muted font-mono">{total} subtasks total</span>
      </div>

      {/* Column preview */}
      <div className="flex-1 grid grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.label} className="flex flex-col rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="h-0.5 w-4 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="text-xs font-bold tracking-wider" style={{ color: col.color }}>
                {col.label}
              </span>
              <span className="text-[10px] text-muted font-mono ml-auto">{col.count}</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <div className="text-3xl font-bold font-mono" style={{ color: col.color }}>
                  {col.count}
                </div>
                <div className="text-[10px] text-muted mt-1">tasks</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
