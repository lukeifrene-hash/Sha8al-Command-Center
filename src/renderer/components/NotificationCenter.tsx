import { useState, useEffect } from 'react'
import { useStore } from '../store'

export function NotificationCenter() {
  const notifications = useStore((s) => s.notifications)
  const dismissNotification = useStore((s) => s.dismissNotification)
  const markNotificationRead = useStore((s) => s.markNotificationRead)
  const [expanded, setExpanded] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Auto-collapse after 5 seconds if not hovered
  useEffect(() => {
    if (!expanded) return
    const timer = setTimeout(() => setExpanded(false), 5000)
    return () => clearTimeout(timer)
  }, [expanded, notifications.length])

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-14 right-4 z-40 flex flex-col items-end gap-2">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{
          backgroundColor: unreadCount > 0 ? 'rgba(0, 113, 227, 0.15)' : 'var(--theme-surface-container)',
          color: unreadCount > 0 ? '#2997ff' : 'var(--theme-muted)',
          border: '1px solid var(--theme-border)',
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
          <path d="M10 18a2 2 0 002-2H8a2 2 0 002 2z" />
        </svg>
        {unreadCount > 0 && (
          <span className="text-xs font-semibold">{unreadCount}</span>
        )}
      </button>

      {/* Expanded list */}
      {expanded && (
        <div
          className="w-80 max-h-96 overflow-y-auto rounded-xl overflow-hidden animate-fade-in"
          style={{
            backgroundColor: 'var(--theme-surface-container)',
            border: '1px solid var(--theme-border)',
            boxShadow: 'rgba(0, 0, 0, 0.22) 3px 5px 30px 0px',
          }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--theme-primary-text)' }}>
              Notifications
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
              style={{ color: 'var(--theme-muted)' }}
            >
              Close
            </button>
          </div>

          {notifications.slice(0, 10).map((n) => (
            <div
              key={n.id}
              className="px-4 py-3 border-b flex items-start gap-3 group transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--theme-border)' }}
              onClick={() => markNotificationRead(n.id)}
            >
              <div className="mt-0.5">
                {n.level === 'error' && <span className="text-red-500">●</span>}
                {n.level === 'warning' && <span className="text-amber-500">●</span>}
                {n.level === 'info' && <span className="text-blue-500">●</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-primary-text)' }}>
                  {n.message}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px]" style={{ color: 'var(--theme-muted)' }}>
                    {n.source} · {new Date(n.timestamp).toLocaleTimeString()}
                  </span>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissNotification(n.id) }}
                className="opacity-0 group-hover:opacity-100 text-xs transition-opacity"
                style={{ color: 'var(--theme-muted)' }}
              >
                ✕
              </button>
            </div>
          ))}

          {notifications.length > 10 && (
            <div className="px-4 py-2 text-center text-[10px]" style={{ color: 'var(--theme-muted)' }}>
              +{notifications.length - 10} more
            </div>
          )}
        </div>
      )}

      {/* Toast stack (latest 3 unread, not expanded) */}
      {!expanded && (
        <div className="flex flex-col gap-2">
          {notifications.filter((n) => !n.read).slice(0, 3).map((n) => (
            <div
              key={n.id}
              className="px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 animate-fade-in cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-surface-container-high)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-primary-text)',
              }}
              onClick={() => markNotificationRead(n.id)}
            >
              {n.level === 'error' && <span className="text-red-500 flex-shrink-0">●</span>}
              {n.level === 'warning' && <span className="text-amber-500 flex-shrink-0">●</span>}
              {n.level === 'info' && <span className="text-blue-500 flex-shrink-0">●</span>}
              <span className="flex-1 truncate">{n.message}</span>
              <button
                onClick={(e) => { e.stopPropagation(); dismissNotification(n.id) }}
                className="flex-shrink-0 text-[10px] hover:text-white transition-colors"
                style={{ color: 'var(--theme-muted)' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
