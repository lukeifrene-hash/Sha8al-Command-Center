import { useState, useMemo, useCallback, useEffect } from 'react'
import { useStore, selectTotalSubtasks, selectCurrentWeek, selectCurrentPhase, selectOverallProgress, selectScheduleStatus } from '../store'
import type { TrackerState } from '../store'

type Agent = TrackerState['agents'][number]
type LogEntry = TrackerState['agent_log'][number]

// ─── Helpers ────────────────────────────────────────────────────────────────

const THIRTY_MINUTES = 30 * 60 * 1000
const PAGE_SIZE = 30

function isAgentActive(agent: Agent): boolean {
  if (!agent.last_action_at) return false
  return Date.now() - new Date(agent.last_action_at).getTime() < THIRTY_MINUTES
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = today.getTime() - target.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'TODAY'
  if (days === 1) return 'YESTERDAY'
  return target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isThisWeek(dateStr: string, startDate: string): boolean {
  const d = new Date(dateStr)
  const projectStart = new Date(startDate + 'T00:00:00Z')
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  // Use the later of project start and calendar week start
  const effectiveStart = projectStart > weekStart ? projectStart : weekStart
  return d >= effectiveStart
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

const TAG_STYLES: Record<string, { bg: string; text: string }> = {
  WRITE: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
  CHECKLIST: { bg: 'rgba(130,134,255,0.12)', text: '#8286FF' },
  COMMIT: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  SCHEDULE: { bg: 'rgba(155,155,170,0.12)', text: '#9B9BAA' },
  ALERT: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  NOTE: { bg: 'rgba(155,155,170,0.10)', text: '#9B9BAA' },
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AgentHubPlaceholder() {
  const tracker = useStore((s) => s.tracker)
  const synced = useStore((s) => s.synced)
  if (!tracker) return null

  return (
    <div className="p-6 h-full flex gap-6">
      <LeftColumn tracker={tracker} synced={synced} />
      <RightColumn tracker={tracker} />
    </div>
  )
}

// ─── Left Column ────────────────────────────────────────────────────────────

function LeftColumn({ tracker, synced }: { tracker: TrackerState; synced: boolean }) {
  const total = selectTotalSubtasks(tracker)
  const done = tracker.milestones.reduce((s, m) => s + m.subtasks.filter(t => t.done).length, 0)
  const totalItems = tracker.submission_checklist.categories.reduce((s, c) => s + c.items.length, 0)
  const week = selectCurrentWeek(tracker)
  const phase = selectCurrentPhase(tracker)
  const progress = selectOverallProgress(tracker)
  const status = selectScheduleStatus(tracker)
  const blocked = tracker.milestones.reduce((s, m) => s + m.subtasks.filter(t => t.blocked_by).length, 0)
  const nextMilestone = tracker.milestones.find(m => m.subtasks.some(s => !s.done))?.title ?? 'All complete'

  return (
    <div className="w-[340px] flex-shrink-0 space-y-4 overflow-y-auto">
      <ConnectedAgentsPanel agents={tracker.agents} />
      <SharedStateFileInfo tracker={tracker} synced={synced} total={total} totalItems={totalItems} />
      <ContextInjectionPreview
        week={week} phase={phase} progress={progress} done={done}
        total={total} status={status} blocked={blocked} nextMilestone={nextMilestone}
      />
      <TodaySummary tracker={tracker} />
    </div>
  )
}

// ─── 4.1 Connected Agents Panel ─────────────────────────────────────────────

function ConnectedAgentsPanel({ agents }: { agents: Agent[] }) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [showConnectInfo, setShowConnectInfo] = useState(false)

  useEffect(() => {
    if (!showConnectInfo) return
    const timer = setTimeout(() => setShowConnectInfo(false), 5000)
    return () => clearTimeout(timer)
  }, [showConnectInfo])

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }, [])

  // Group agents: explicit parent_id wins. Older sub-agents that only expose
  // prefix-style IDs still fall back to orchestrator ID prefix matching.
  const grouped = useMemo(() => {
    const orchestrators = agents.filter(a => a.type.toLowerCase().includes('orchestrator'))
    const agentById = new Map(agents.map((agent) => [agent.id, agent]))
    const orchIds = new Set(orchestrators.map(o => o.id))
    const childMap = new Map<string, Agent[]>()

    const resolveParent = (agent: Agent): string | null => {
      if (agent.parent_id && agentById.has(agent.parent_id)) {
        return agent.parent_id
      }

      if (agent.type === 'sub-agent') {
        for (const oId of orchIds) {
          if (agent.id.startsWith(oId + '_')) return oId
        }
      }
      return null
    }

    const claimed = new Set<string>()
    for (const agent of agents) {
      const parentId = resolveParent(agent)
      if (!parentId) continue
      const siblings = childMap.get(parentId) || []
      siblings.push(agent)
      childMap.set(parentId, siblings)
      claimed.add(agent.id)
    }

    const groups: { id: string; orchestrator: Agent | null; children: Agent[] }[] = orchestrators.map(o => {
      claimed.add(o.id)
      const children = (childMap.get(o.id) || []).sort((a, b) => a.name.localeCompare(b.name))
      return { id: o.id, orchestrator: o, children }
    })

    // Standalone agents (not orchestrators, not sub-agents)
    const standalone = agents.filter(a => !claimed.has(a.id))
    if (standalone.length > 0) {
      groups.unshift({ id: '_standalone', orchestrator: null, children: standalone })
    }

    return groups
  }, [agents])

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-xs font-bold tracking-wider text-muted mb-3">CONNECTED AGENTS</h3>
      <div className="space-y-1.5">
        {grouped.map(group => (
          <div key={group.id}>
            {group.orchestrator && (
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface/60 transition-colors mb-1"
              >
                <svg
                  className={`w-3 h-3 text-muted transition-transform ${collapsedGroups[group.id] ? '' : 'rotate-90'}`}
                  viewBox="0 0 12 12" fill="currentColor"
                >
                  <path d="M4 2l4 4-4 4z" />
                </svg>
                <AgentCardInline agent={group.orchestrator} />
              </button>
            )}
            {!collapsedGroups[group.id] && (
              <div className={`space-y-1.5 ${group.orchestrator ? 'ml-4 pl-2 border-l border-border/50' : ''}`}>
                {group.children.map(agent => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Connect New Agent button */}
      <button
        onClick={() => setShowConnectInfo(true)}
        className="w-full mt-3 py-2 rounded-lg border border-dashed border-border text-[10px] text-muted font-semibold tracking-wider hover:border-accent/40 hover:text-accent-light transition-colors"
      >
        + CONNECT NEW AGENT
      </button>

      {showConnectInfo && (
        <div className="mt-2 px-3 py-2 rounded-md bg-accent/10 border border-accent/20 text-[10px] text-accent-light leading-relaxed">
          Agents connect automatically via the MCP server. Register new agents using the <span className="font-mono font-semibold">register_agent</span> tool.
        </div>
      )}
    </div>
  )
}

function AgentCardInline({ agent }: { agent: Agent }) {
  const active = isAgentActive(agent)
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <div className="relative flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
        {active && (
          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-on-track" />
        )}
      </div>
      <span className="text-xs text-white font-medium truncate">{agent.name}</span>
      <span className="text-[9px] text-muted font-mono">{agent.type}</span>
    </div>
  )
}

const SUB_AGENT_ROLE_ICONS: Record<string, string> = {
  explorer: '\u{1F50D}',
  researcher: '\u{1F4DA}',
  auditor: '\u{2705}',
  'milestone-coherence-auditor': '\u{1F9E9}',
  'milestone-security-auditor': '\u{1F510}',
  'milestone-ux-auditor': '\u{1F5A5}',
  'milestone-compliance-auditor': '\u{1F4CB}',
}

function getSubAgentRole(agent: Agent): string | null {
  if (agent.type !== 'sub-agent') return null
  return agent.name
}

function AgentCard({ agent }: { agent: Agent }) {
  const active = isAgentActive(agent)
  const role = getSubAgentRole(agent)
  const isSubAgent = agent.type === 'sub-agent'
  const icon = SUB_AGENT_ROLE_ICONS[agent.id] || null

  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors ${
      isSubAgent
        ? 'bg-surface/60 border-border/60 hover:bg-surface hover:border-border'
        : 'bg-surface border-border'
    }`}>
      <div className="relative flex-shrink-0">
        <div
          className={`rounded-full ${isSubAgent ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
          style={{ backgroundColor: agent.color }}
        />
        {active && (
          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-on-track animate-pulse" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-[10px]">{icon}</span>
          )}
          <span className={`text-white font-medium ${isSubAgent ? 'text-[11px]' : 'text-xs'}`}>
            {role || agent.name}
          </span>
          <span className={`text-[9px] font-semibold tracking-wider ${active ? 'text-on-track' : 'text-muted'}`}>
            {active ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {!isSubAgent && <span className="text-[10px] text-muted font-mono">{agent.type}</span>}
          {agent.last_action_at && (
            <span className="text-[9px] text-muted">
              {formatTime(agent.last_action_at)}
            </span>
          )}
          {agent.session_action_count > 0 && (
            <span className="text-[9px] text-muted font-mono">
              {agent.session_action_count} actions
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-[9px] px-2 py-0.5 rounded font-semibold tracking-wider"
          style={{ color: agent.color, backgroundColor: agent.color + '1a' }}
          title={agent.permissions?.length ? `Permissions: ${agent.permissions.join(', ')}` : undefined}
        >
          {agent.type === 'human'
            ? 'OPERATOR'
            : agent.type === 'orchestrator'
              ? 'ORCHESTRATOR'
              : 'SUB-AGENT'}
        </span>
      </div>
    </div>
  )
}

// ─── 4.2 Shared State File Info ─────────────────────────────────────────────

function SharedStateFileInfo({ tracker, synced, total, totalItems }: {
  tracker: TrackerState; synced: boolean; total: number; totalItems: number
}) {
  const [trackerPath, setTrackerPath] = useState<string>('Resolving...')

  useEffect(() => {
    let cancelled = false
    window.api.tracker.getPath()
      .then((path) => {
        if (!cancelled) setTrackerPath(path || 'Unavailable')
      })
      .catch(() => {
        if (!cancelled) setTrackerPath('Unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Simple schema integrity check: verify required fields exist
  const schemaValid = !!(
    tracker.project?.name &&
    tracker.milestones &&
    tracker.submission_checklist?.categories &&
    tracker.agents &&
    tracker.agent_log &&
    tracker.schedule?.phases
  )

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-xs font-bold tracking-wider text-muted mb-3">SHARED STATE FILE</h3>
      <div className="space-y-1.5 text-xs">
        <Row label="Path" value={trackerPath} mono />
        <Row label="Watcher" value={synced ? 'Active' : 'Inactive'} green={synced} />
        <Row label="Milestones" value={String(tracker.milestones.length)} />
        <Row label="Subtasks" value={String(total)} />
        <Row label="Checklist items" value={String(totalItems)} />
        <Row label="Log entries" value={String(tracker.agent_log.length)} />
        <Row label="Schema" value={schemaValid ? 'Valid' : 'Invalid'} green={schemaValid} red={!schemaValid} />
      </div>
    </div>
  )
}

// ─── 4.3 Context Injection Preview ──────────────────────────────────────────

function ContextInjectionPreview({ week, phase, progress, done, total, status, blocked, nextMilestone }: {
  week: number; phase: string; progress: number; done: number; total: number
  status: string; blocked: number; nextMilestone: string
}) {
  const [copied, setCopied] = useState(false)

  const contextText = `TALKSTORE STATUS — WEEK ${week}
Phase: ${phase}
Progress: ${Math.round(progress * 100)}% (${done}/${total})
Schedule: ${status.replace(/_/g, ' ').toUpperCase()}
Blocked: ${blocked}
Next: ${nextMilestone}`

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(contextText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments where clipboard API isn't available
    }
  }, [contextText])

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-xs font-bold tracking-wider text-muted mb-3">CONTEXT INJECTION PREVIEW</h3>
      <pre className="text-[10px] text-muted font-mono bg-dark rounded-md p-3 whitespace-pre-wrap leading-relaxed select-all">
        {contextText}
      </pre>
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider px-2.5 py-1.5 rounded bg-accent/10 text-accent-light hover:bg-accent/20 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8.5l3.5 3.5 6.5-8" />
              </svg>
              COPIED
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="5" width="8" height="8" rx="1.5" />
                <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" />
              </svg>
              COPY TO CLIPBOARD
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── 4.4 Today's Summary ────────────────────────────────────────────────────

function TodaySummary({ tracker }: { tracker: TrackerState }) {
  const stats = useMemo(() => {
    const todayLogs = tracker.agent_log.filter(e => isToday(e.timestamp))

    // Tasks completed today: subtasks with completed_at today
    const completedToday = tracker.milestones.reduce((sum, m) =>
      sum + m.subtasks.filter(t => t.completed_at && isToday(t.completed_at)).length, 0
    )
    const inProgress = tracker.milestones.reduce((sum, m) =>
      sum + m.subtasks.filter(t => t.status === 'in_progress').length, 0
    )
    const blocked = tracker.milestones.reduce((sum, m) =>
      sum + m.subtasks.filter(t => t.blocked_by).length, 0
    )

    // Contribution by agent
    const byAgent: Record<string, number> = {}
    for (const entry of todayLogs) {
      byAgent[entry.agent_id] = (byAgent[entry.agent_id] || 0) + 1
    }
    const contributions = Object.entries(byAgent).map(([agentId, count]) => {
      const agent = tracker.agents.find(a => a.id === agentId)
      return { agentId, name: agent?.name ?? agentId, color: agent?.color ?? '#9B9BAA', count }
    }).sort((a, b) => b.count - a.count)

    return { completedToday, inProgress, blocked, contributions }
  }, [tracker])

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-xs font-bold tracking-wider text-muted mb-3">TODAY'S SUMMARY</h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBox label="Completed" value={stats.completedToday} color="#22c55e" />
        <StatBox label="In Progress" value={stats.inProgress} color="#8286FF" />
        <StatBox label="Blocked" value={stats.blocked} color="#ef4444" />
      </div>
      {stats.contributions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-muted font-semibold tracking-wider mb-1">CONTRIBUTIONS</div>
          {stats.contributions.map(c => (
            <div key={c.agentId} className="flex items-center gap-2 text-[10px]">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-white flex-1 truncate">{c.name}</span>
              <span className="text-muted font-mono">{c.count}</span>
            </div>
          ))}
        </div>
      )}
      {stats.contributions.length === 0 && (
        <div className="text-[10px] text-muted text-center py-1">No agent activity today</div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface rounded-lg p-2.5 border border-border text-center">
      <div className="text-lg font-semibold font-mono" style={{ color }}>{value}</div>
      <div className="text-[9px] text-muted font-semibold tracking-wider mt-0.5">{label.toUpperCase()}</div>
    </div>
  )
}

// ─── Right Column ───────────────────────────────────────────────────────────

function RightColumn({ tracker }: { tracker: TrackerState }) {
  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">
      <ActivityFeed tracker={tracker} />
      <AgentPerformanceStats tracker={tracker} />
    </div>
  )
}

// ─── 4.5 Activity Feed ──────────────────────────────────────────────────────

type FilterId = 'all' | 'manual' | 'system' | string

function ActivityFeed({ tracker }: { tracker: TrackerState }) {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Build filter tabs
  const filterTabs = useMemo(() => {
    const tabs: { id: FilterId; label: string; color?: string }[] = [
      { id: 'all', label: 'All' },
    ]
    for (const agent of tracker.agents) {
      tabs.push({ id: agent.id, label: agent.name, color: agent.color })
    }
    tabs.push({ id: 'manual', label: 'Manual' })
    tabs.push({ id: 'system', label: 'System' })
    return tabs
  }, [tracker.agents])

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let entries = [...tracker.agent_log]

    // Apply filter
    if (activeFilter === 'manual') {
      entries = entries.filter(e => e.agent_id === 'luqman' || e.agent_id === 'human')
    } else if (activeFilter === 'system') {
      entries = entries.filter(e => e.tags.some(t => t.toLowerCase() === 'alert' || t.toLowerCase() === 'system'))
    } else if (activeFilter !== 'all') {
      entries = entries.filter(e => e.agent_id === activeFilter)
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase()
      entries = entries.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.target_id.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    // Sort newest first
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return entries
  }, [tracker.agent_log, activeFilter, search])

  // Group by day
  const groupedEntries = useMemo(() => {
    const visible = filteredEntries.slice(0, visibleCount)
    const groups: { label: string; entries: LogEntry[] }[] = []
    let currentLabel = ''

    for (const entry of visible) {
      const label = getDayLabel(entry.timestamp)
      if (label !== currentLabel) {
        currentLabel = label
        groups.push({ label, entries: [] })
      }
      groups[groups.length - 1].entries.push(entry)
    }

    return groups
  }, [filteredEntries, visibleCount])

  const hasMore = visibleCount < filteredEntries.length

  // Agent color lookup
  const agentMap = useMemo(() => {
    const map: Record<string, Agent> = {}
    for (const a of tracker.agents) map[a.id] = a
    return map
  }, [tracker.agents])

  return (
    <div className="flex-1 rounded-lg border border-border p-4 flex flex-col min-h-0">
      <h3 className="text-xs font-bold tracking-wider text-muted mb-3">ACTIVITY FEED</h3>

      {/* Search bar */}
      <div className="relative mb-3">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search activity..."
          className="w-full bg-surface border border-border rounded-md text-xs text-white placeholder-muted pl-8 pr-3 py-1.5 outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto flex-shrink-0">
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveFilter(tab.id); setVisibleCount(PAGE_SIZE) }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wider whitespace-nowrap transition-colors ${
              activeFilter === tab.id
                ? 'bg-accent/15 text-accent-light'
                : 'text-muted hover:text-white hover:bg-surface'
            }`}
          >
            {tab.color && (
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tab.color }} />
            )}
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Feed entries */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
        {groupedEntries.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted py-12">
            <div className="text-3xl mb-3 opacity-20">⚡</div>
            <p className="text-sm">No activity{search ? ' matching search' : activeFilter !== 'all' ? ' for this filter' : ' yet'}</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Agent actions will appear here as they write to the tracker.
            </p>
          </div>
        )}

        {groupedEntries.map(group => (
          <div key={group.label}>
            {/* Day separator */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold tracking-wider text-muted">{group.label}</span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted font-mono">{group.entries.length}</span>
            </div>

            {/* Entries */}
            <div className="space-y-1">
              {group.entries.map(entry => {
                const agent = agentMap[entry.agent_id]
                const isAlert = entry.tags.some(t => t.toLowerCase() === 'alert')

                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors hover:bg-surface/60 ${
                      isAlert ? 'border border-behind/30 bg-behind/5' : ''
                    }`}
                  >
                    {/* Agent dot */}
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: agent?.color ?? '#9B9BAA' }}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: agent?.color ?? '#9B9BAA' }}
                        >
                          {agent?.name ?? entry.agent_id}
                        </span>
                        <span className="text-xs text-white/80">{entry.description || entry.action}</span>
                        {entry.target_id && (
                          <span className="text-[10px] text-muted font-mono">{entry.target_id}</span>
                        )}
                      </div>

                      {/* Tags */}
                      {entry.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {entry.tags.map((tag, i) => {
                            const style = TAG_STYLES[tag.toUpperCase()] ?? TAG_STYLES.NOTE
                            return (
                              <span
                                key={i}
                                className="text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: style.bg, color: style.text }}
                              >
                                {tag.toUpperCase()}{tag.toUpperCase() === 'WRITE' ? ' \u2713' : ''}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-muted font-mono flex-shrink-0 mt-0.5">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Load more */}
        {hasMore && (
          <button
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="w-full py-2 text-[10px] font-semibold tracking-wider text-muted hover:text-accent-light transition-colors"
          >
            LOAD MORE ({filteredEntries.length - visibleCount} remaining)
          </button>
        )}
      </div>
    </div>
  )
}

// ─── 4.6 Agent Performance Stats ────────────────────────────────────────────

function AgentPerformanceStats({ tracker }: { tracker: TrackerState }) {
  const stats = useMemo(() => {
    const startDate = tracker.project.start_date

    return tracker.agents.map(agent => {
      const agentLogs = tracker.agent_log.filter(e => e.agent_id === agent.id)
      const weekLogs = agentLogs.filter(e => isThisWeek(e.timestamp, startDate))
      const totalActions = weekLogs.length
      const checklistDone = weekLogs.filter(e =>
        e.tags.some(t => t.toLowerCase() === 'checklist')
      ).length
      const alerts = weekLogs.filter(e =>
        e.tags.some(t => t.toLowerCase() === 'alert')
      ).length

      return { agent, totalActions, checklistDone, alerts }
    })
  }, [tracker])

  if (stats.length === 0) return null

  return (
    <div className="rounded-lg border border-border p-4 flex-shrink-0">
      <h3 className="text-xs font-bold tracking-wider text-muted mb-3">AGENT PERFORMANCE — THIS WEEK</h3>
      <div className="flex gap-2 overflow-x-auto">
        {stats.map(({ agent, totalActions, checklistDone, alerts }) => (
          <div key={agent.id} className="bg-surface rounded-lg p-3 border border-border min-w-[120px] flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
              <span className="text-[10px] font-semibold text-white truncate">{agent.name}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted tracking-wider">ACTIONS</span>
                <span className="text-xs font-mono text-white">{totalActions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted tracking-wider">CHECKLIST</span>
                <span className="text-xs font-mono text-on-track">{checklistDone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted tracking-wider">ALERTS</span>
                <span className={`text-xs font-mono ${alerts > 0 ? 'text-behind' : 'text-muted'}`}>{alerts}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Shared Primitives ──────────────────────────────────────────────────────

function Row({ label, value, mono, green, red }: {
  label: string; value: string; mono?: boolean; green?: boolean; red?: boolean
}) {
  let colorClass = 'text-white'
  if (green) colorClass = 'text-on-track'
  if (red) colorClass = 'text-behind'
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${colorClass}`}>{value}</span>
    </div>
  )
}
