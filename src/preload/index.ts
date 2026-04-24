import { contextBridge, ipcRenderer } from 'electron'
import type { WorkspaceStatus } from '../main/workspace'
import type { AgentExecution, WaveState } from '../main/agent-runtime'

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,

  // Tracker file operations
  tracker: {
    read: (): Promise<string | null> => ipcRenderer.invoke('tracker:read'),
    write: (json: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('tracker:write', json),
    getPath: (): Promise<string | null> => ipcRenderer.invoke('tracker:path'),
    getFileInfo: (): Promise<{
      exists: boolean
      size: number
      lastModified: string | null
      watcherActive: boolean
    }> => ipcRenderer.invoke('tracker:fileInfo'),

    // Listen for external file changes
    onUpdated: (callback: (json: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, json: string) => callback(json)
      ipcRenderer.on('tracker:updated', handler)
      return () => ipcRenderer.removeListener('tracker:updated', handler)
    },
  },

  workspace: {
    getStatus: (): Promise<WorkspaceStatus> => ipcRenderer.invoke('workspace:getStatus'),
    chooseProjectFolder: (): Promise<{ canceled: boolean; status: WorkspaceStatus }> =>
      ipcRenderer.invoke('workspace:chooseProjectFolder'),
    createStarterRoadmap: (): Promise<{ created: string[]; status: WorkspaceStatus }> =>
      ipcRenderer.invoke('workspace:createStarterRoadmap'),
    importRoadmap: (): Promise<{ canceled: boolean; imported?: string; status: WorkspaceStatus }> =>
      ipcRenderer.invoke('workspace:importRoadmap'),
    generateTracker: (): Promise<{
      state: unknown
      counts: { milestones: number; subtasks: number; categories: number; checklistItems: number }
      status: WorkspaceStatus
    }> => ipcRenderer.invoke('workspace:generateTracker'),
  },

  // Git operations
  git: {
    commitAndPush: (): Promise<
      | { status: 'success'; message: string; branch: string; filesChanged: number }
      | { status: 'nothing' }
      | { status: 'error'; error: string }
    > => ipcRenderer.invoke('git:commit-and-push'),
  },

  // Agent runtime operations
  agent: {
    listExecutions: (): Promise<AgentExecution[]> => ipcRenderer.invoke('agent:listExecutions'),
    getExecution: (id: string): Promise<AgentExecution | null> => ipcRenderer.invoke('agent:getExecution', id),
    spawn: (params: {
      agentId: string
      agentName: string
      command: string
      args?: string[]
      taskId?: string
      milestoneId?: string
    }): Promise<{ executionId: string }> => ipcRenderer.invoke('agent:spawn', params),
    abort: (id: string): Promise<boolean> => ipcRenderer.invoke('agent:abort', id),
    retry: (id: string): Promise<string | null> => ipcRenderer.invoke('agent:retry', id),
  },

  // Autonomous wave operations
  wave: {
    start: (config: {
      waveId: string
      milestoneId: string
      agentSequence: string[]
      parallel: boolean
      autoApprove: boolean
    }): Promise<{ waveId: string }> => ipcRenderer.invoke('wave:start', config),
    pause: (waveId: string): Promise<boolean> => ipcRenderer.invoke('wave:pause', waveId),
    resume: (waveId: string): Promise<boolean> => ipcRenderer.invoke('wave:resume', waveId),
    abort: (waveId: string): Promise<boolean> => ipcRenderer.invoke('wave:abort', waveId),
    status: (waveId: string): Promise<WaveState | null> => ipcRenderer.invoke('wave:status', waveId),
  },

  // Event bus for real-time updates
  events: {
    onEvent: (callback: (event: { type: string; payload: unknown }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: string) => {
        try {
          callback(JSON.parse(payload))
        } catch { /* ignore malformed */ }
      }
      ipcRenderer.on('sha8al:event', handler)
      return () => ipcRenderer.removeListener('sha8al:event', handler)
    },
    dispatch: (event: { type: string; payload: unknown }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('bus:dispatch', event),
  },

  // Plugin system
  plugin: {
    list: (): Promise<import('../main/plugin-system').PluginManifest[]> =>
      ipcRenderer.invoke('plugin:list'),
    get: (id: string): Promise<import('../main/plugin-system').PluginManifest | null> =>
      ipcRenderer.invoke('plugin:get', id),
    setEnabled: (id: string, enabled: boolean): Promise<boolean> =>
      ipcRenderer.invoke('plugin:setEnabled', id, enabled),
    updateConfig: (id: string, config: Record<string, unknown>): Promise<boolean> =>
      ipcRenderer.invoke('plugin:updateConfig', id, config),
    getConfig: (id: string): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('plugin:getConfig', id),
  },

  // Context builder
  context: {
    build: (params: {
      taskId: string
      taskLabel: string
      milestoneTitle: string
      domain: string
      complexity: string
      prompt?: string
      contextFiles?: string[]
    }): Promise<import('../main/context-builder').TaskContext> =>
      ipcRenderer.invoke('context:build', params),
    storeMemory: (agentId: string, pattern: string, context: string, relevance: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('context:storeMemory', agentId, pattern, context, relevance),
    suggestPrompt: (prompt: string, failurePatterns: string[]): Promise<import('../main/context-builder').PromptSuggestion[]> =>
      ipcRenderer.invoke('context:suggestPrompt', prompt, failurePatterns),
  },
})
