/// <reference types="vite/client" />

interface TrackerAPI {
  read(): Promise<string | null>
  write(json: string): Promise<{ success: boolean; error?: string }>
  getPath(): Promise<string>
  getFileInfo(): Promise<{
    exists: boolean
    size: number
    lastModified: string | null
    watcherActive: boolean
  }>
  onUpdated(callback: (json: string) => void): () => void
}

interface AssembledPrompt {
  fullText: string
  layerSummary: {
    layer1Sources: string[]
    layer1Chars: number
    layer2MilestoneId: string
    layer2Chars: number
    layer3Status: 'placeholder' | 'scanned'
    layer3Chars: number
    taskSectionChars: number
    totalChars: number
    budgetChars: number
    trimmed: boolean
  }
  agentProfile: 'explorer' | 'planner' | 'builder' | 'generic'
  assembledAt: string
}

interface PromptAPI {
  assemble(subtaskId: string): Promise<AssembledPrompt | { error: string }>
  assembleForStep(subtaskId: string, step: string): Promise<AssembledPrompt | { error: string }>
  copyToClipboard(text: string): Promise<{ success: boolean }>
}

interface DispatchAPI {
  launchInWarp(subtaskId: string, step: string | null): Promise<{
    success: boolean
    promptFilePath?: string
    error?: string
  }>
}

interface PipelineProgressData {
  subtaskId: string
  step: 'explorer' | 'planner' | 'builder' | null
  runId?: string
  chunk?: string
  output?: string
  durationMs?: number
  error?: string
}

interface PipelineAPI {
  run(subtaskId: string): Promise<{ success: boolean; error?: string }>
  cancel(subtaskId: string): Promise<{ success: boolean }>
  onStepStarted(cb: (data: PipelineProgressData) => void): () => void
  onStepOutput(cb: (data: PipelineProgressData) => void): () => void
  onStepCompleted(cb: (data: PipelineProgressData) => void): () => void
  onCompleted(cb: (data: PipelineProgressData) => void): () => void
  onError(cb: (data: PipelineProgressData) => void): () => void
}

interface Window {
  api: {
    platform: string
    tracker: TrackerAPI
    prompt: PromptAPI
    dispatch: DispatchAPI
    pipeline: PipelineAPI
  }
}
