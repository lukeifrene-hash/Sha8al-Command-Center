import { useState, useMemo } from 'react'
import { useStore } from '../store'
import type { Milestone, ReviewSession } from '../../main/parser'

// ─── Constants ──────────────────────────────────────────────────────────────

const PROJECT_START = new Date(2026, 2, 29) // Sunday, March 29, 2026
const TOTAL_WEEKS = 12

// AI Commerce Index Platform — 4-lane palette. Mirrors DOMAIN_COLOR_MAP in
// ../domainModel.ts.
const DOMAIN_COLORS: Record<string, string> = {
  foundation: '#585CF0',
  product_engines: '#14B8A6',
  merchant_facing: '#5B6EE8',
  ship_and_operate: '#F59E0B',
  backend: '#585CF0',
  compliance: '#F59E0B',
  product_ops: '#14B8A6',
  autopilot: '#14B8A6',
  attribution: '#14B8A6',
  scoring: '#14B8A6',
  frontend: '#5B6EE8',
  quality: '#F59E0B',
  launch: '#F59E0B',
  review_ui: '#60A5FA',
  review_ux: '#C084FC',
  review_backend: '#FB923C',
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CalendarTask {
  id: string
  label: string
  done: boolean
  domain: string
  milestoneTitle: string
  date: string // YYYY-MM-DD
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWeekDays(weekIndex: number): Date[] {
  const start = new Date(PROJECT_START)
  start.setDate(start.getDate() + weekIndex * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isPast(date: Date): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return date < now
}

function formatDayHeader(date: Date): { day: string; date: number; month: string } {
  return {
    day: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    date: date.getDate(),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  }
}

function formatWeekRange(days: Date[]): string {
  const first = days[0]
  const last = days[6]
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${first.toLocaleDateString('en-US', opts)} – ${last.toLocaleDateString('en-US', opts)}, ${last.getFullYear()}`
}

/** Build a map of YYYY-MM-DD → CalendarTask[] from tracker milestones + review sessions */
function buildTaskMap(milestones: Milestone[], reviewSessions: ReviewSession[]): Map<string, CalendarTask[]> {
  const map = new Map<string, CalendarTask[]>()

  for (const m of milestones) {
    if (m.id === 'pre_submission_extras') continue

    for (const s of m.subtasks) {
      // Calendar only shows tasks that have actually been COMPLETED.
      // Undone / in-progress tasks are intentionally absent — the calendar
      // is a history of finished work, not a forecast.
      if (!s.completed_at) continue

      const d = new Date(s.completed_at)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const task: CalendarTask = {
        id: s.id,
        label: s.label,
        done: s.done,
        domain: m.domain,
        milestoneTitle: m.title,
        date: dateStr,
      }

      const existing = map.get(dateStr) || []
      existing.push(task)
      map.set(dateStr, existing)
    }
  }

  // Add review session checklist items (only checked ones, placed on their checked_at date)
  for (const session of reviewSessions) {
    for (const item of session.checklist) {
      if (!item.done || !item.checked_at) continue

      const d = new Date(item.checked_at)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const task: CalendarTask = {
        id: `${session.id}-${item.label.slice(0, 20)}`,
        label: item.label,
        done: true,
        domain: `review_${session.lane}`,
        milestoneTitle: session.title,
        date: dateStr,
      }

      const existing = map.get(dateStr) || []
      existing.push(task)
      map.set(dateStr, existing)
    }
  }

  return map
}

/** Find which week index a given date falls in (0-based from PROJECT_START) */
function getCurrentWeekIndex(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = now.getTime() - PROJECT_START.getTime()
  return Math.max(0, Math.min(TOTAL_WEEKS - 1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000))))
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CalendarView() {
  const tracker = useStore((s) => s.tracker)
  const [weekIndex, setWeekIndex] = useState(getCurrentWeekIndex)
  const days = getWeekDays(weekIndex)

  const taskMap = useMemo(() => {
    if (!tracker) return new Map<string, CalendarTask[]>()
    return buildTaskMap(tracker.milestones, tracker.review_sessions ?? [])
  }, [tracker])

  // Stats for header
  const weekTasks = useMemo(() => {
    let total = 0
    let done = 0
    for (const day of days) {
      const tasks = taskMap.get(toDateStr(day)) || []
      total += tasks.length
      done += tasks.filter((t) => t.done).length
    }
    return { total, done }
  }, [days, taskMap])

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">Calendar</h1>
          <p className="text-sm text-muted mt-1">
            Week {weekIndex + 1} of {TOTAL_WEEKS} &middot; {formatWeekRange(days)}
            {weekTasks.total > 0 && (
              <span className="ml-2 text-accent-light">
                &middot; {weekTasks.done}/{weekTasks.total} tasks
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekIndex((w) => Math.max(0, w - 1))}
            disabled={weekIndex === 0}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-border text-muted hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <button
            onClick={() => setWeekIndex(getCurrentWeekIndex)}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-border text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setWeekIndex((w) => Math.min(TOTAL_WEEKS - 1, w + 1))}
            disabled={weekIndex === TOTAL_WEEKS - 1}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-border text-muted hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Day columns */}
      <div className="flex-1 min-h-0 grid grid-cols-7 gap-3 overflow-hidden">
        {days.map((date, i) => {
          const today = isToday(date)
          const past = isPast(date)
          const header = formatDayHeader(date)
          const dayTasks = taskMap.get(toDateStr(date)) || []
          const doneTasks = dayTasks.filter((t) => t.done)
          const undoneTasks = dayTasks.filter((t) => !t.done)

          return (
            <div
              key={i}
              className={`
                flex flex-col rounded-lg border overflow-hidden
                ${today
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-border bg-surface/30'
                }
                ${past && !today && dayTasks.length === 0 ? 'opacity-40' : ''}
              `}
            >
              {/* Day header */}
              <div
                className={`
                  flex-shrink-0 px-3 py-2.5 border-b text-center
                  ${today ? 'border-accent/20' : 'border-border'}
                `}
              >
                <div className="text-[10px] font-bold tracking-wider text-muted">
                  {header.day}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span
                    className={`
                      text-lg font-semibold font-mono leading-none
                      ${today ? 'text-accent-light' : 'text-white'}
                    `}
                  >
                    {header.date}
                  </span>
                  {(header.date === 1 || i === 0) && (
                    <span className="text-[9px] font-semibold tracking-wider text-muted">
                      {header.month}
                    </span>
                  )}
                </div>
                {dayTasks.length > 0 && (
                  <div className="text-[9px] font-mono text-muted mt-1">
                    {doneTasks.length}/{dayTasks.length}
                  </div>
                )}
              </div>

              {/* Today indicator */}
              {today && (
                <div className="h-0.5 bg-accent flex-shrink-0" />
              )}

              {/* Task list */}
              <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
                {doneTasks.map((task) => (
                  <TaskChip key={task.id} task={task} />
                ))}
                {undoneTasks.map((task) => (
                  <TaskChip key={task.id} task={task} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── TaskChip ───────────────────────────────────────────────────────────────

function TaskChip({ task }: { task: CalendarTask }) {
  const color = DOMAIN_COLORS[task.domain] || '#9B9BAA'

  return (
    <div
      className={`
        group relative rounded px-2 py-1.5 border transition-colors cursor-default
        ${task.done
          ? 'border-border/60 bg-dark/50'
          : 'border-border bg-dark hover:border-border/80'
        }
      `}
    >
      {/* Domain color indicator */}
      <div
        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="pl-1.5">
        <div
          className={`
            text-[10px] leading-tight line-clamp-2
            ${task.done ? 'text-muted line-through' : 'text-white/80'}
          `}
        >
          {task.label}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="text-[8px] font-bold tracking-wider px-1 py-px rounded"
            style={{
              backgroundColor: color + '18',
              color: color,
            }}
          >
            {task.domain.replace(/_/g, ' ').toUpperCase()}
          </span>
          {task.done && (
            <span className="text-[8px] text-muted">✓</span>
          )}
        </div>
      </div>
    </div>
  )
}
