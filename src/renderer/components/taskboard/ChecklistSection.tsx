import { useStore } from '../../store'
import type { ChecklistCategory, ChecklistItem } from '../../../main/parser'
import { useState } from 'react'

interface ChecklistSectionProps {
  milestoneId: string
}

export function ChecklistSection({ milestoneId }: ChecklistSectionProps) {
  const tracker = useStore((s) => s.tracker)
  const updateTracker = useStore((s) => s.updateTracker)
  const [collapsed, setCollapsed] = useState(true)

  if (!tracker) return null

  // Find checklist categories linked to this milestone
  const linkedCategories = tracker.submission_checklist.categories.filter(
    (cat) => cat.items.some((item) => item.linked_milestone === milestoneId)
  )

  if (linkedCategories.length === 0) return null

  // Filter to only items linked to this milestone
  const linkedItems: { category: ChecklistCategory; item: ChecklistItem }[] = []
  for (const cat of linkedCategories) {
    for (const item of cat.items) {
      if (item.linked_milestone === milestoneId) {
        linkedItems.push({ category: cat, item })
      }
    }
  }

  const doneCount = linkedItems.filter((li) => li.item.done).length

  function toggleItem(categoryId: string, itemId: string) {
    updateTracker((draft) => {
      const cat = draft.submission_checklist.categories.find((c) => c.id === categoryId)
      if (!cat) return
      const item = cat.items.find((i) => i.id === itemId)
      if (!item) return
      item.done = !item.done
      if (item.done) {
        item.completed_at = new Date().toISOString()
        item.completed_by = 'Luqman'
      } else {
        item.completed_at = null
        item.completed_by = null
      }
    })
  }

  return (
    <div className="mx-5 mb-4 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface/50 hover:bg-surface transition-colors text-left"
      >
        <span className={`text-[10px] text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
        <span className="text-xs font-bold tracking-wider text-muted">
          SUBMISSION CHECKLIST FOR THIS MILESTONE
        </span>
        <span className="text-[10px] font-mono text-muted ml-auto">
          {doneCount}/{linkedItems.length}
        </span>
        {/* Mini progress */}
        <div className="w-16 h-1 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${linkedItems.length > 0 ? (doneCount / linkedItems.length) * 100 : 0}%` }}
          />
        </div>
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="px-4 py-2 space-y-1">
          {linkedItems.map(({ category, item }) => (
            <label
              key={item.id}
              className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-white/3 cursor-pointer group transition-colors"
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleItem(category.id, item.id)}
                className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-accent flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-xs leading-snug ${item.done ? 'text-muted line-through' : 'text-white'}`}>
                  {item.label}
                </span>
                <span className="text-[9px] text-muted/60 ml-2">{category.title}</span>
              </div>
              {category.risk_level === 'critical' && (
                <span className="text-[9px] text-behind flex-shrink-0">⚠ CRITICAL</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
