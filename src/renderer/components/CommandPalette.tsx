import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useStore } from '../store'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface CommandItem {
  id: string
  label: string
  shortcut?: string
  category: string
  icon: string
  action: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const tracker = useStore((s) => s.tracker)

  // Build command list dynamically from tracker state
  const commands = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      { id: 'tab:swim-lane', label: 'Swim Lane View', shortcut: '⌘1', category: 'Views', icon: '⬡', action: () => setActiveTab('swim-lane') },
      { id: 'tab:task-board', label: 'Task Board', shortcut: '⌘2', category: 'Views', icon: '⊞', action: () => setActiveTab('task-board') },
      { id: 'tab:agent-hub', label: 'Agent Hub', shortcut: '⌘3', category: 'Views', icon: '⚡', action: () => setActiveTab('agent-hub') },
      { id: 'tab:calendar', label: 'Calendar', shortcut: '⌘4', category: 'Views', icon: '▦', action: () => setActiveTab('calendar') },
      { id: 'tab:qa', label: 'QA Verification', shortcut: '⌘5', category: 'Views', icon: '◎', action: () => setActiveTab('qa') },
      { id: 'tab:analytics', label: 'Analytics', shortcut: '⌘6', category: 'Views', icon: '◈', action: () => setActiveTab('analytics') },
      { id: 'theme:toggle', label: 'Toggle Theme', shortcut: '⌘⇧L', category: 'Preferences', icon: '🌓', action: () => useStore.getState().toggleTheme() },
    ]

    if (tracker) {
      // Add milestone navigation commands
      for (const ms of tracker.milestones) {
        const progress = ms.subtasks.length > 0
          ? Math.round((ms.subtasks.filter(s => s.done).length / ms.subtasks.length) * 100)
          : 0
        base.push({
          id: `milestone:${ms.id}`,
          label: `${ms.title} (${progress}%)`,
          category: 'Milestones',
          icon: '🎯',
          action: () => {
            setActiveTab('task-board')
            useStore.getState().setSelectedMilestoneId(ms.id)
          },
        })
      }

      // Add quick task actions
      const blockedTasks = tracker.milestones.flatMap(m =>
        m.subtasks.filter(s => s.status === 'blocked').map(s => ({
          id: `task:unblock:${s.id}`,
          label: `Unblock: ${s.label.slice(0, 40)}${s.label.length > 40 ? '...' : ''}`,
          category: 'Actions',
          icon: '🔓',
          action: () => {
            useStore.getState().updateTracker((draft) => {
              for (const m of draft.milestones) {
                const t = m.subtasks.find(t => t.id === s.id)
                if (t) {
                  t.status = 'todo'
                  t.blocked_by = null
                  t.blocked_reason = null
                }
              }
            })
          },
        }))
      )
      base.push(...blockedTasks.slice(0, 10))
    }

    return base
  }, [tracker, activeTab, setActiveTab])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    )
  }, [commands, query])

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const c of filtered) {
      groups[c.category] = groups[c.category] || []
      groups[c.category].push(c)
    }
    return groups
  }, [filtered])

  const flatItems = useMemo(() => Object.values(grouped).flat(), [grouped])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[selectedIndex]
      if (item) {
        item.action()
        onClose()
      }
    }
  }, [flatItems, selectedIndex, onClose])

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  let globalIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 command-palette-overlay flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--theme-surface-container)',
          border: '1px solid var(--theme-border)',
          boxShadow: 'rgba(0, 0, 0, 0.22) 3px 5px 30px 0px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--theme-muted)' }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="6" />
            <path d="M15 15l4 4" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, tasks, milestones..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--theme-muted)]"
            style={{ color: 'var(--theme-primary-text)' }}
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {flatItems.length === 0 && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--theme-muted)' }}>
              No commands found
            </div>
          )}

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'var(--theme-muted)' }}>
                {category}
              </div>
              {items.map(item => {
                const idx = globalIdx++
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    onClick={() => { item.action(); onClose() }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'rgba(0, 113, 227, 0.15)' : 'transparent',
                    }}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className="flex-1 text-sm truncate" style={{ color: 'var(--theme-primary-text)' }}>
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px]" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-muted)' }}>
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  )
}
