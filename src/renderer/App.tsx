import { useEffect, useCallback } from 'react'
import { useStore, initStore } from './store'
import { TabBar } from './components/TabBar'
import { StatusBar } from './components/StatusBar'
import { SwimLaneView } from './views/SwimLaneView'
import { TaskBoard } from './views/TaskBoard'
import { AgentHubPlaceholder } from './views/AgentHubPlaceholder'
import { CalendarView } from './views/CalendarView'
import { QAView } from './views/QAView'
import { AnalyticsView } from './views/AnalyticsView'
import { OnboardingView } from './views/OnboardingView'
import { CommandPalette } from './components/CommandPalette'
import { NotificationCenter } from './components/NotificationCenter'

export default function App() {
  const { loading, activeTab, tracker, theme, commandPaletteOpen, setCommandPaletteOpen } = useStore()

  useEffect(() => {
    initStore().catch(err => console.error('Failed to initialize store:', err))
  }, [])

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Global Cmd+K shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  const closePalette = useCallback(() => setCommandPaletteOpen(false), [setCommandPaletteOpen])

  if (loading) {
    return (
      <div className="h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted font-mono">Loading tracker...</p>
        </div>
      </div>
    )
  }

  if (!tracker) {
    return <OnboardingView />
  }

  return (
    <div className="h-screen bg-dark flex flex-col">
      {/* Command Palette overlay */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={closePalette} />

      {/* Notification Center */}
      <NotificationCenter />

      {/* Draggable title bar region for macOS */}
      <div
        className="h-12 flex-shrink-0 flex items-center nav-glass"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3 w-full px-4" style={{ paddingLeft: '80px' }}>
          <TabBar />
          <div className="flex-1" />
          <StatusBar />
        </div>
      </div>

      {/* View area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'swim-lane' && <SwimLaneView />}
        {activeTab === 'task-board' && <TaskBoard />}
        {activeTab === 'agent-hub' && <AgentHubPlaceholder />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'qa' && <QAView />}
        {activeTab === 'analytics' && <AnalyticsView />}
      </div>
    </div>
  )
}
