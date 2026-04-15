import { useState, useCallback, useRef } from 'react'

type ButtonState = 'idle' | 'running' | 'success' | 'error' | 'nothing'

export function CommitButton() {
  const [state, setState] = useState<ButtonState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [commitMsg, setCommitMsg] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const resetAfter = useCallback((ms: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setState('idle')
      setErrorMsg('')
      setCommitMsg('')
    }, ms)
  }, [])

  const handleClick = useCallback(async () => {
    if (state === 'running') return

    setState('running')
    setErrorMsg('')
    setCommitMsg('')

    try {
      const result = await window.api.git.commitAndPush()

      switch (result.status) {
        case 'success':
          setState('success')
          setCommitMsg(result.message)
          resetAfter(3000)
          break
        case 'nothing':
          setState('nothing')
          resetAfter(3000)
          break
        case 'error':
          setState('error')
          setErrorMsg(result.error.split('\n')[0].slice(0, 60))
          resetAfter(5000)
          break
      }
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message.slice(0, 60) : 'Unknown error')
      resetAfter(5000)
    }
  }, [state, resetAfter])

  return (
    <button
      onClick={handleClick}
      disabled={state === 'running'}
      title={commitMsg || undefined}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono
        transition-all duration-200 cursor-pointer
        disabled:cursor-wait disabled:opacity-70
        ${state === 'idle' ? 'border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent/60' : ''}
        ${state === 'running' ? 'border border-accent/20 text-muted' : ''}
        ${state === 'success' ? 'border border-on-track/40 text-on-track' : ''}
        ${state === 'error' ? 'border border-behind/40 text-behind' : ''}
        ${state === 'nothing' ? 'border border-yellow-500/40 text-yellow-500' : ''}
      `}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {state === 'idle' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="3" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="21" />
        </svg>
      )}
      {state === 'running' && (
        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      {state === 'success' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {state === 'error' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      {state === 'nothing' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}

      <span>
        {state === 'idle' && 'Commit'}
        {state === 'running' && 'Pushing...'}
        {state === 'success' && 'Deployed'}
        {state === 'error' && (errorMsg || 'Failed')}
        {state === 'nothing' && 'No changes'}
      </span>
    </button>
  )
}
