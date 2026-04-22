import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useStore, selectCurrentWeek } from '../store'
import type { Subtask } from '../../main/parser'
import { ContextBar } from '../components/taskboard/ContextBar'
import { FilterBar, type FilterType } from '../components/taskboard/FilterBar'
import { KanbanColumn, COLUMNS, type ColumnId } from '../components/taskboard/KanbanColumn'
import { TaskDetailModal } from '../components/taskboard/TaskDetailModal'
import { ChecklistSection } from '../components/taskboard/ChecklistSection'

// AI Commerce Index Platform — 4-lane palette. Mirrors DOMAIN_COLOR_MAP in
// ../domainModel.ts.
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

export function TaskBoard() {
  const tracker = useStore((s) => s.tracker)
  const updateTracker = useStore((s) => s.updateTracker)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const selectedMilestoneId = useStore((s) => s.selectedMilestoneId)
  const setSelectedMilestoneId = useStore((s) => s.setSelectedMilestoneId)

  // Sort milestones for consistent ordering across the component
  const stableSortedMilestones = useMemo(() => {
    if (!tracker) return []
    return [...tracker.milestones].sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week
      return a.title.localeCompare(b.title)
    })
  }, [tracker])

  // Resolve the active index from the persisted milestone ID (or fall back to current week)
  const activeMilestoneIndex = useMemo(() => {
    if (selectedMilestoneId && stableSortedMilestones.length) {
      const idx = stableSortedMilestones.findIndex((m) => m.id === selectedMilestoneId)
      if (idx >= 0) return idx
    }
    // Default: find the current-week milestone
    if (!stableSortedMilestones.length) return 0
    const week = selectCurrentWeek(tracker!)
    const exactIdx = stableSortedMilestones.findIndex((m) => m.week === week)
    if (exactIdx >= 0) return exactIdx
    const afterIdx = stableSortedMilestones.findIndex((m) => m.week >= week)
    return afterIdx >= 0 ? afterIdx : 0
  }, [selectedMilestoneId, stableSortedMilestones, tracker])

  const handleMilestoneChange = useCallback(
    (index: number) => {
      const ms = stableSortedMilestones[index]
      if (ms) setSelectedMilestoneId(ms.id)
    },
    [stableSortedMilestones, setSelectedMilestoneId]
  )
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedTask, setSelectedTask] = useState<Subtask | null>(null)
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (!tracker) return null

  const milestone = stableSortedMilestones[activeMilestoneIndex]
  if (!milestone) return null

  // Apply filters
  const filteredSubtasks = milestone.subtasks.filter((s) => {
    switch (filter) {
      case 'my_tasks':
        return s.assignee === 'Luqman'
      case 'agent_tasks':
        return s.assignee !== null && s.assignee !== 'Luqman'
      case 'blocked':
        return s.status === 'blocked'
      default:
        return true
    }
  })

  // Filter counts (computed from all subtasks, not filtered ones)
  const filterCounts: Record<FilterType, number> = {
    all: milestone.subtasks.length,
    my_tasks: milestone.subtasks.filter((s) => s.assignee === 'Luqman').length,
    agent_tasks: milestone.subtasks.filter((s) => s.assignee !== null && s.assignee !== 'Luqman').length,
    blocked: milestone.subtasks.filter((s) => s.status === 'blocked').length,
  }

  // Group into columns
  const columnTasks: Record<ColumnId, Subtask[]> = {
    todo: filteredSubtasks.filter((s) => s.status === 'todo'),
    in_progress: filteredSubtasks.filter((s) => s.status === 'in_progress'),
    review: filteredSubtasks.filter((s) => s.status === 'review'),
    done: filteredSubtasks.filter((s) => s.status === 'done'),
    blocked: filteredSubtasks.filter((s) => s.status === 'blocked'),
  }

  // Find which column a task belongs to
  function findColumnOfTask(taskId: string): ColumnId | null {
    for (const [colId, tasks] of Object.entries(columnTasks)) {
      if (tasks.some((t) => t.id === taskId)) return colId as ColumnId
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragActiveId(null)

    if (!over) return

    const taskId = active.id as string
    const sourceColumn = findColumnOfTask(taskId)

    // Determine target column: either directly a column droppable, or the column of the task we're over
    let targetColumn: ColumnId | null = null
    if (COLUMNS.some((c) => c.id === over.id)) {
      targetColumn = over.id as ColumnId
    } else {
      targetColumn = findColumnOfTask(over.id as string)
    }

    if (!sourceColumn || !targetColumn || sourceColumn === targetColumn) return

    // Re-read the milestone ID from current store state to avoid stale closure
    const freshTracker = useStore.getState().tracker
    const freshSorted = freshTracker
      ? [...freshTracker.milestones].sort((a, b) => {
          if (a.week !== b.week) return a.week - b.week
          return a.title.localeCompare(b.title)
        })
      : []
    const freshMilestone = freshSorted[activeMilestoneIndex]
    if (!freshMilestone) return

    // Update the task status
    updateTracker((draft) => {
      const ms = draft.milestones.find((m) => m.id === freshMilestone.id)
      if (!ms) return
      const task = ms.subtasks.find((s) => s.id === taskId)
      if (!task) return

      task.status = targetColumn!
      task.done = targetColumn === 'done'

      if (targetColumn === 'done') {
        task.completed_at = new Date().toISOString()
        task.completed_by = task.assignee || 'Luqman'
        task.blocked_by = null
        task.blocked_reason = null
      } else if (targetColumn === 'blocked') {
        task.blocked_by = task.blocked_by || 'unknown'
        task.completed_at = null
        task.completed_by = null
      } else {
        task.blocked_by = null
        task.blocked_reason = null
        task.completed_at = null
        task.completed_by = null
      }
    })
  }

  // Find the dragged task for overlay
  const draggedTask = dragActiveId
    ? milestone.subtasks.find((s) => s.id === dragActiveId) ?? null
    : null

  return (
    <div className="h-full flex flex-col">
      {/* 3.1 — Context bar */}
      <ContextBar
        milestones={stableSortedMilestones}
        activeMilestoneIndex={activeMilestoneIndex}
        onMilestoneChange={handleMilestoneChange}
      />

      {/* 3.2 — Filter bar */}
      <FilterBar active={filter} onChange={setFilter} counts={filterCounts} />

      {/* 3.3 + 3.4 — Kanban columns with cards */}
      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-3 h-full">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                subtasks={columnTasks[col.id]}
                domain={milestone.domain}
                onCardClick={(s) => setSelectedTask(s)}
              />
            ))}
          </div>

          {/* Drag overlay for visual feedback */}
          <DragOverlay>
            {draggedTask ? (
              <div className="rounded-lg border border-accent/40 bg-surface p-3 shadow-xl shadow-accent/10 opacity-90 max-w-[280px]">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                    style={{
                      color: DOMAIN_COLORS[milestone.domain] || '#9B9BAA',
                      backgroundColor: (DOMAIN_COLORS[milestone.domain] || '#9B9BAA') + '18',
                    }}
                  >
                    {milestone.domain.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="text-[9px] font-bold text-muted">{draggedTask.priority}</span>
                </div>
                <p className="text-xs text-white font-medium leading-snug">{draggedTask.label}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 3.6 — Submission checklist integration */}
      <ChecklistSection milestoneId={milestone.id} />

      {/* 3.5 — Card detail modal */}
      {selectedTask && (
        <TaskDetailModal
          subtask={selectedTask}
          milestoneId={milestone.id}
          milestoneTitle={milestone.title}
          domain={milestone.domain}
          onClose={() => setSelectedTask(null)}
          onSwitchToSwimLane={() => setActiveTab('swim-lane')}
        />
      )}
    </div>
  )
}
