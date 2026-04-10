import { useMemo } from 'react'
import { useStore } from '../store'

type TabId = 'swim-lane' | 'task-board' | 'agent-hub' | 'review'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'swim-lane', icon: '⬡', label: 'Swim Lane' },
  { id: 'task-board', icon: '⊞', label: 'Task Board' },
  { id: 'agent-hub', icon: '⚡', label: 'Agent Hub' },
  { id: 'review', icon: '✓', label: 'Review' },
]

export function TabBar() {
  const { activeTab, setActiveTab } = useStore()
  const tracker = useStore((s) => s.tracker)

  const hasRecentActivity = useMemo(() => {
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000
    return (tracker?.agent_log ?? []).some(
      (entry) => new Date(entry.timestamp).getTime() > thirtyMinAgo
    )
  }, [tracker?.agent_log])

  return (
    <div
      className="flex items-center gap-1"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150
              flex items-center gap-1.5 cursor-pointer
              ${isActive
                ? 'bg-accent/15 text-accent-light'
                : 'text-muted hover:text-white hover:bg-white/5'
              }
            `}
          >
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
            {tab.id === 'agent-hub' && hasRecentActivity && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>
        )
      })}
    </div>
  )
}
