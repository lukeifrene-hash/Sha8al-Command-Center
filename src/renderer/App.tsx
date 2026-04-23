import { useEffect } from 'react'
import { useStore, initStore } from './store'
import { TabBar } from './components/TabBar'
import { StatusBar } from './components/StatusBar'
import { SwimLaneView } from './views/SwimLaneView'
import { TaskBoard } from './views/TaskBoard'
import { AgentHubPlaceholder } from './views/AgentHubPlaceholder'
import { CalendarView } from './views/CalendarView'
import { QAView } from './views/QAView'
import { OnboardingView } from './views/OnboardingView'

export default function App() {
  const { loading, activeTab, tracker, theme } = useStore()

  useEffect(() => {
    initStore().catch(err => console.error('Failed to initialize store:', err))
  }, [])

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

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
      {/* Draggable title bar region for macOS */}
      <div
        className="h-12 flex-shrink-0 flex items-center"
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
      </div>
    </div>
  )
}
