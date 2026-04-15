import { useStore, selectCurrentWeek, selectCurrentPhase, selectTotalSubtasks, selectDoneSubtasks, selectOverallProgress, selectScheduleStatus } from '../store'
import { CommitButton } from './CommitButton'

function ThemeToggle() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted/20 transition-colors text-muted hover:text-primary-text"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {theme === 'dark' ? (
        /* Sun icon */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

export function StatusBar() {
  const tracker = useStore((s) => s.tracker)
  const synced = useStore((s) => s.synced)
  if (!tracker) return null

  const week = selectCurrentWeek(tracker)
  const phaseName = selectCurrentPhase(tracker)
  const total = selectTotalSubtasks(tracker)
  const done = selectDoneSubtasks(tracker)
  const pct = Math.round(selectOverallProgress(tracker) * 100)
  const status = selectScheduleStatus(tracker)

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div
      className="flex items-center gap-4 text-xs"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Week + Phase */}
      <span className="relative group text-muted font-mono whitespace-nowrap cursor-default">
        <span className="text-white font-semibold">WEEK {week}</span>
        {phaseName && <span className="text-muted"> · {phaseName}</span>}
        <span className="pointer-events-none absolute left-0 top-full mt-2 hidden group-hover:block z-50 rounded bg-panel border border-white/10 px-3 py-2 text-[11px] leading-relaxed text-muted shadow-lg whitespace-nowrap">
          <span className="block">Start: {fmtDate(tracker.project.start_date)}</span>
          <span className="block">Submit: {fmtDate(tracker.project.target_submit_date)}</span>
        </span>
      </span>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-progress-track)' }}>
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-muted font-mono whitespace-nowrap">
          {done}/{total} ({pct}%)
        </span>
      </div>

      {/* Schedule status chip */}
      <span
        className={`
          px-2 py-0.5 rounded text-[10px] font-bold tracking-wider whitespace-nowrap
          ${status === 'on_track' ? 'bg-on-track/15 text-on-track' : ''}
          ${status === 'behind' ? 'bg-behind/15 text-behind' : ''}
          ${status === 'ahead' ? 'bg-on-track/15 text-on-track' : ''}
        `}
      >
        {status === 'on_track' ? 'ON TRACK' : status === 'behind' ? 'BEHIND' : 'AHEAD'}
      </span>

      {/* Sync indicator */}
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-on-track' : 'bg-behind'}`} />
        <span className="text-muted text-[10px]">{synced ? 'synced' : 'offline'}</span>
      </div>

      {/* Commit + push */}
      <CommitButton />

      {/* Theme toggle */}
      <ThemeToggle />
    </div>
  )
}
