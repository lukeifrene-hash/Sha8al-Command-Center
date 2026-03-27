import { useState, useEffect, useRef } from 'react'
import type { PipelineStep, PipelineStepName } from '../../../main/parser'

const STEP_META: Record<PipelineStepName, { label: string; color: string; desc: string }> = {
  explorer: { label: 'Explorer', color: '#f59e0b', desc: 'Investigate codebase, gather findings' },
  planner: { label: 'Planner', color: '#585CF0', desc: 'Design implementation approach' },
  builder: { label: 'Builder', color: '#22c55e', desc: 'Write production code' },
}

const STATUS_LABELS: Record<PipelineStep['status'], { label: string; color: string }> = {
  idle: { label: 'Waiting', color: '#9B9BAA' },
  dispatched: { label: 'Dispatched', color: '#f59e0b' },
  running: { label: 'Running...', color: '#3b82f6' },
  complete: { label: 'Complete', color: '#22c55e' },
  error: { label: 'Error', color: '#ef4444' },
}

interface PipelineStepCardProps {
  stepName: PipelineStepName
  step: PipelineStep
  subtaskId: string
  isCurrent: boolean
  hasPriorOutput: boolean
  onToggleEnabled: (enabled: boolean) => void
  onSaveOutput: (output: string) => void
  onDispatch: () => void
  doSave: () => void
  streamingOutput?: string
  isAutomatedRun?: boolean
}

export function PipelineStepCard({
  stepName,
  step,
  subtaskId,
  isCurrent,
  hasPriorOutput,
  onToggleEnabled,
  onSaveOutput,
  onDispatch,
  doSave,
  streamingOutput,
  isAutomatedRun,
}: PipelineStepCardProps) {
  const meta = STEP_META[stepName]
  const statusMeta = STATUS_LABELS[step.status]

  const [outputDraft, setOutputDraft] = useState(step.output || '')
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [launchFeedback, setLaunchFeedback] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  // Elapsed time counter for running state
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step.status === 'running') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [step.status])

  // Sync outputDraft when step output changes externally (e.g., from automated pipeline)
  useEffect(() => {
    if (step.output && step.output !== outputDraft) {
      setOutputDraft(step.output)
    }
  }, [step.output])

  const outputChanged = outputDraft !== (step.output || '')

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  async function handlePreview() {
    setPreviewLoading(true)
    try {
      doSave()
      await new Promise((r) => setTimeout(r, 600))
      const result = await window.api.prompt.assembleForStep(subtaskId, stepName)
      if ('error' in result) {
        setPreviewText(`Error: ${result.error}`)
      } else {
        setPreviewText(result.fullText)
      }
      setShowPreview(true)
    } catch (err) {
      setPreviewText(`Error: ${String(err)}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleRunInWarp() {
    setLaunching(true)
    setLaunchFeedback(null)
    try {
      doSave()
      await new Promise((r) => setTimeout(r, 600))
      const result = await window.api.dispatch.launchInWarp(subtaskId, stepName)
      if (result.success) {
        setLaunchFeedback('Tab opened — paste ⌘V to run')
        onDispatch()
      } else {
        setLaunchFeedback(`Error: ${result.error}`)
      }
      setTimeout(() => setLaunchFeedback(null), 5000)
    } catch (err) {
      setLaunchFeedback(`Error: ${String(err)}`)
      setTimeout(() => setLaunchFeedback(null), 5000)
    } finally {
      setLaunching(false)
    }
  }

  async function handleCopyPrompt() {
    doSave()
    await new Promise((r) => setTimeout(r, 600))
    const result = await window.api.prompt.assembleForStep(subtaskId, stepName)
    if ('error' in result) return
    await window.api.prompt.copyToClipboard(result.fullText)
    setCopyFeedback(true)
    onDispatch()
    setTimeout(() => setCopyFeedback(false), 3000)
  }

  const isRunning = step.status === 'running'
  const isError = step.status === 'error'

  return (
    <div
      className={`rounded-lg border transition-all ${
        !step.enabled
          ? 'border-border/50 opacity-40'
          : isRunning
            ? 'border-blue-500/50 bg-blue-500/5'
            : isError
              ? 'border-red-500/30 bg-red-500/5'
              : isCurrent
                ? 'border-accent/50 bg-accent/5'
                : step.status === 'complete'
                  ? 'border-on-track/30 bg-on-track/5'
                  : 'border-border bg-surface'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={step.enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              disabled={isAutomatedRun}
              className="w-3 h-3 rounded border-border accent-accent"
            />
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: step.enabled ? meta.color : '#9B9BAA' }}
            >
              {meta.label.toUpperCase()}
            </span>
          </label>
          <span className="text-[9px] text-muted">{meta.desc}</span>
        </div>

        <div className="flex items-center gap-2">
          {hasPriorOutput && step.enabled && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
              + prior output
            </span>
          )}
          {isRunning && (
            <span className="text-[9px] text-blue-400 font-mono">
              {formatElapsed(elapsed)}
            </span>
          )}
          {step.duration_ms != null && step.status === 'complete' && (
            <span className="text-[9px] text-muted font-mono">
              {formatElapsed(Math.round(step.duration_ms / 1000))}
            </span>
          )}
          <span
            className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${isRunning ? 'animate-pulse' : ''}`}
            style={{ color: statusMeta.color, backgroundColor: statusMeta.color + '18' }}
          >
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* Body — only shown if enabled */}
      {step.enabled && (
        <div className="px-4 py-3 space-y-3">
          {/* Running state: streaming output preview */}
          {isRunning && streamingOutput && (
            <div className="bg-dark border border-blue-500/20 rounded overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1 border-b border-border">
                <span className="text-[9px] text-blue-400 font-mono">
                  Live output — {streamingOutput.length.toLocaleString()} chars
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              </div>
              <pre className="p-3 text-[9px] text-white/60 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {streamingOutput.length > 2000
                  ? '...\n' + streamingOutput.slice(-2000)
                  : streamingOutput}
              </pre>
            </div>
          )}

          {/* Error state */}
          {isError && step.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
              <p className="text-[10px] text-red-400 font-mono">{step.error}</p>
            </div>
          )}

          {/* Manual action buttons — hidden during automated run */}
          {!isAutomatedRun && !isRunning && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunInWarp}
                  disabled={launching}
                  className={`text-[10px] font-medium transition-colors ${
                    launchFeedback === 'Launched!'
                      ? 'text-on-track'
                      : launchFeedback
                        ? 'text-behind'
                        : 'text-accent hover:text-accent-light'
                  }`}
                >
                  {launching ? 'Launching...' : launchFeedback || 'Run in Warp'}
                </button>
                <span className="text-border">|</span>
                <button
                  onClick={handlePreview}
                  disabled={previewLoading}
                  className="text-[10px] text-muted hover:text-white transition-colors"
                >
                  {previewLoading ? 'Loading...' : showPreview ? 'Refresh Preview' : 'Preview Prompt'}
                </button>
                <span className="text-border">|</span>
                <button
                  onClick={handleCopyPrompt}
                  className={`text-[10px] transition-colors ${
                    copyFeedback
                      ? 'text-on-track'
                      : 'text-muted hover:text-white'
                  }`}
                >
                  {copyFeedback ? '✓ Copied!' : 'Copy to Clipboard'}
                </button>
              </div>

              {/* Prompt preview (collapsible) */}
              {showPreview && previewText && (
                <div className="bg-dark border border-border rounded overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1 border-b border-border">
                    <span className="text-[9px] text-muted font-mono">
                      {previewText.length.toLocaleString()} chars
                    </span>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="text-[9px] text-muted hover:text-white"
                    >
                      Hide
                    </button>
                  </div>
                  <pre className="p-3 text-[9px] text-white/60 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                    {previewText}
                  </pre>
                </div>
              )}

              {/* Output paste area — manual mode only */}
              <div>
                <label className="block text-[10px] text-muted font-bold tracking-wider mb-1">
                  {step.status === 'complete' ? 'OUTPUT' : 'PASTE OUTPUT HERE'}
                  {step.output && (
                    <span className="font-normal tracking-normal ml-1.5 text-muted/60">
                      {step.output.length.toLocaleString()} chars
                    </span>
                  )}
                </label>
                <textarea
                  value={outputDraft}
                  onChange={(e) => setOutputDraft(e.target.value)}
                  rows={step.status === 'complete' ? 4 : 6}
                  placeholder={`Paste the ${meta.label.toLowerCase()}'s response here after running externally...`}
                  className="w-full bg-dark border border-border rounded px-3 py-2 text-[10px] text-white font-mono placeholder:text-muted/30 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                />
                {outputChanged && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={() => onSaveOutput(outputDraft)}
                      className="px-3 py-1 rounded text-[10px] font-medium text-white bg-accent hover:bg-accent-light transition-colors"
                    >
                      Save Output
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Automated run: show output when complete */}
          {isAutomatedRun && step.status === 'complete' && step.output && (
            <div>
              <label className="block text-[10px] text-muted font-bold tracking-wider mb-1">
                OUTPUT
                <span className="font-normal tracking-normal ml-1.5 text-muted/60">
                  {step.output.length.toLocaleString()} chars
                </span>
              </label>
              <pre className="w-full bg-dark border border-border rounded px-3 py-2 text-[10px] text-white/70 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {step.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
