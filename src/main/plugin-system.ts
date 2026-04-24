/**
 * Sha8al Command Center — Plugin System
 *
 * Extensible hook-based plugin API for integrating external services
 * and adding custom behavior to the tracker lifecycle.
 *
 * Built-in integrations: GitHub Issues/Projects, Linear, Notion, Slack webhooks.
 * Custom plugins can register hooks for any lifecycle event.
 */

import { EventEmitter } from 'events'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { eventBus, emitNotification } from './event-bus'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HookEvent =
  | 'onTaskComplete'
  | 'onTaskStart'
  | 'onTaskBlocked'
  | 'onAuditFail'
  | 'onAuditPass'
  | 'onAgentSpawn'
  | 'onAgentFinish'
  | 'onMilestoneComplete'
  | 'onMilestoneStart'
  | 'onTrackerMutated'
  | 'onSyncComplete'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  hooks: HookEvent[]
  configSchema?: Record<string, PluginConfigField>
  enabled: boolean
  builtIn: boolean
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  default?: unknown
  required?: boolean
  options?: string[] // for select type
  secret?: boolean // for API keys etc.
}

export interface PluginConfig {
  [pluginId: string]: Record<string, unknown>
}

export interface HookContext {
  eventId: string
  timestamp: string
  trackerPath: string | null
  payload: Record<string, unknown>
}

export type HookHandler = (ctx: HookContext) => void | Promise<void>

interface RegisteredPlugin {
  manifest: PluginManifest
  handlers: Map<HookEvent, HookHandler[]>
  config: Record<string, unknown>
}

// ─── Plugin Registry ──────────────────────────────────────────────────────────

class PluginRegistry extends EventEmitter {
  private plugins = new Map<string, RegisteredPlugin>()
  private configPath: string | null = null

  setConfigPath(path: string): void {
    this.configPath = path
    this.loadConfig()
  }

  register(manifest: PluginManifest, handlers?: Partial<Record<HookEvent, HookHandler>>): void {
    if (this.plugins.has(manifest.id)) {
      console.warn(`Plugin ${manifest.id} already registered, replacing`)
      this.plugins.delete(manifest.id)
    }

    const handlerMap = new Map<HookEvent, HookHandler[]>()
    for (const hook of manifest.hooks) {
      handlerMap.set(hook, handlers?.[hook] ? [handlers[hook]] : [])
    }

    const config = this.getPluginConfig(manifest.id)

    this.plugins.set(manifest.id, {
      manifest,
      handlers: handlerMap,
      config,
    })

    this.emit('plugin:registered', manifest.id)
  }

  unregister(pluginId: string): boolean {
    const deleted = this.plugins.delete(pluginId)
    if (deleted) this.emit('plugin:unregistered', pluginId)
    return deleted
  }

  addHookHandler(pluginId: string, event: HookEvent, handler: HookHandler): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) throw new Error(`Plugin ${pluginId} not registered`)

    if (!plugin.handlers.has(event)) {
      plugin.handlers.set(event, [])
      if (!plugin.manifest.hooks.includes(event)) {
        plugin.manifest.hooks.push(event)
      }
    }
    plugin.handlers.get(event)!.push(handler)
  }

  async dispatchHook(event: HookEvent, payload: Record<string, unknown>): Promise<void> {
    const ctx: HookContext = {
      eventId: `${event}:${Date.now()}`,
      timestamp: new Date().toISOString(),
      trackerPath: this.configPath,
      payload,
    }

    for (const [pluginId, plugin] of this.plugins) {
      if (!plugin.manifest.enabled) continue

      const handlers = plugin.handlers.get(event)
      if (!handlers || handlers.length === 0) continue

      for (const handler of handlers) {
        try {
          await handler(ctx)
        } catch (err) {
          emitNotification('error', `Plugin ${pluginId} error on ${event}: ${(err as Error).message}`, 'Plugin System')
        }
      }
    }
  }

  listPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((p) => ({ ...p.manifest }))
  }

  getPlugin(id: string): PluginManifest | null {
    return this.plugins.get(id)?.manifest ?? null
  }

  setPluginEnabled(id: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(id)
    if (!plugin) return false
    plugin.manifest.enabled = enabled
    this.saveConfig()
    this.emit('plugin:toggle', { id, enabled })
    return true
  }

  updatePluginConfig(id: string, config: Record<string, unknown>): boolean {
    const plugin = this.plugins.get(id)
    if (!plugin) return false
    plugin.config = { ...plugin.config, ...config }
    this.saveConfig()
    this.emit('plugin:configUpdated', { id, config })
    return true
  }

  getPluginConfig(id: string): Record<string, unknown> {
    const plugin = this.plugins.get(id)
    if (!plugin) return {}
    return { ...plugin.config }
  }

  private loadConfig(): void {
    if (!this.configPath) return
    const configFilePath = join(dirname(this.configPath), 'plugin-config.json')
    if (!existsSync(configFilePath)) return

    try {
      const raw = JSON.parse(readFileSync(configFilePath, 'utf-8')) as PluginConfig
      for (const [pluginId, config] of Object.entries(raw)) {
        const plugin = this.plugins.get(pluginId)
        if (plugin) {
          plugin.config = config
        }
      }
    } catch {
      // Ignore corrupt config
    }
  }

  private saveConfig(): void {
    if (!this.configPath) return
    const configFilePath = join(dirname(this.configPath), 'plugin-config.json')

    const config: PluginConfig = {}
    for (const [id, plugin] of this.plugins) {
      config[id] = plugin.config
    }

    mkdirSync(dirname(configFilePath), { recursive: true })
    writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8')
  }
}

export const pluginRegistry = new PluginRegistry()

// ─── Built-in Integrations ────────────────────────────────────────────────────

// GitHub Issues / Projects
const GITHUB_MANIFEST: PluginManifest = {
  id: 'github',
  name: 'GitHub Integration',
  version: '1.0.0',
  description: 'Sync tasks with GitHub Issues and Projects',
  author: 'Sha8al',
  hooks: ['onTaskComplete', 'onTaskStart', 'onMilestoneComplete'],
  enabled: false,
  builtIn: true,
  configSchema: {
    repository: { type: 'string', label: 'Repository (owner/repo)', required: true },
    token: { type: 'string', label: 'Personal Access Token', required: true, secret: true },
    autoCreateIssues: { type: 'boolean', label: 'Auto-create issues for new tasks', default: false },
    syncLabels: { type: 'boolean', label: 'Sync milestone labels', default: true },
  },
}

const githubHandlers: Partial<Record<HookEvent, HookHandler>> = {
  onTaskComplete: async (ctx) => {
    const repo = pluginRegistry.getPluginConfig('github').repository as string | undefined
    if (!repo) return
    // In production, this would call GitHub API to close the issue
    console.log(`[GitHub Plugin] Task completed: ${ctx.payload.taskId} in ${repo}`)
  },
  onTaskStart: async (ctx) => {
    const repo = pluginRegistry.getPluginConfig('github').repository as string | undefined
    if (!repo) return
    console.log(`[GitHub Plugin] Task started: ${ctx.payload.taskId} in ${repo}`)
  },
}

// Linear
const LINEAR_MANIFEST: PluginManifest = {
  id: 'linear',
  name: 'Linear Integration',
  version: '1.0.0',
  description: 'Sync tasks with Linear projects',
  author: 'Sha8al',
  hooks: ['onTaskComplete', 'onTaskStart', 'onMilestoneComplete'],
  enabled: false,
  builtIn: true,
  configSchema: {
    apiKey: { type: 'string', label: 'Linear API Key', required: true, secret: true },
    teamId: { type: 'string', label: 'Team ID', required: true },
    projectId: { type: 'string', label: 'Project ID' },
  },
}

const linearHandlers: Partial<Record<HookEvent, HookHandler>> = {
  onTaskComplete: async (ctx) => {
    const apiKey = pluginRegistry.getPluginConfig('linear').apiKey as string | undefined
    if (!apiKey) return
    console.log(`[Linear Plugin] Task completed: ${ctx.payload.taskId}`)
  },
}

// Notion
const NOTION_MANIFEST: PluginManifest = {
  id: 'notion',
  name: 'Notion Integration',
  version: '1.0.0',
  description: 'Sync milestones and tasks with Notion databases',
  author: 'Sha8al',
  hooks: ['onTaskComplete', 'onMilestoneComplete', 'onTrackerMutated'],
  enabled: false,
  builtIn: true,
  configSchema: {
    token: { type: 'string', label: 'Notion Integration Token', required: true, secret: true },
    databaseId: { type: 'string', label: 'Database ID', required: true },
  },
}

// Slack
const SLACK_MANIFEST: PluginManifest = {
  id: 'slack',
  name: 'Slack Webhooks',
  version: '1.0.0',
  description: 'Post notifications to Slack channels via webhooks',
  author: 'Sha8al',
  hooks: ['onTaskComplete', 'onAuditFail', 'onMilestoneComplete', 'onAgentFinish'],
  enabled: false,
  builtIn: true,
  configSchema: {
    webhookUrl: { type: 'string', label: 'Slack Webhook URL', required: true, secret: true },
    channel: { type: 'string', label: 'Channel (optional)' },
    notifyOn: { type: 'select', label: 'Notify on', options: ['all', 'failures_only', 'milestones_only'], default: 'all' },
  },
}

const slackHandlers: Partial<Record<HookEvent, HookHandler>> = {
  onTaskComplete: async (ctx) => {
    const webhookUrl = pluginRegistry.getPluginConfig('slack').webhookUrl as string | undefined
    if (!webhookUrl) return
    // In production, this would POST to the Slack webhook
    console.log(`[Slack Plugin] Task completed: ${ctx.payload.taskId}`)
  },
  onAuditFail: async (ctx) => {
    const webhookUrl = pluginRegistry.getPluginConfig('slack').webhookUrl as string | undefined
    if (!webhookUrl) return
    console.log(`[Slack Plugin] Audit failed: ${ctx.payload.taskId}`)
  },
}

// ─── Initialize Built-in Plugins ──────────────────────────────────────────────

export function initializeBuiltInPlugins(): void {
  pluginRegistry.register(GITHUB_MANIFEST, githubHandlers)
  pluginRegistry.register(LINEAR_MANIFEST, linearHandlers)
  pluginRegistry.register(NOTION_MANIFEST)
  pluginRegistry.register(SLACK_MANIFEST, slackHandlers)
}

// ─── Wire Event Bus → Plugin Hooks ────────────────────────────────────────────

export function wireEventBusToPlugins(): void {
  eventBus.on('task:completed', (payload) => {
    pluginRegistry.dispatchHook('onTaskComplete', payload as Record<string, unknown>)
  })

  eventBus.on('task:started', (payload) => {
    pluginRegistry.dispatchHook('onTaskStart', payload as Record<string, unknown>)
  })

  eventBus.on('task:blocked', (payload) => {
    pluginRegistry.dispatchHook('onTaskBlocked', payload as Record<string, unknown>)
  })

  eventBus.on('milestone:audited', (payload) => {
    const p = payload as { verdict: string }
    if (p.verdict === 'fail') {
      pluginRegistry.dispatchHook('onAuditFail', payload as Record<string, unknown>)
    } else {
      pluginRegistry.dispatchHook('onAuditPass', payload as Record<string, unknown>)
    }
  })

  eventBus.on('agent:spawned', (payload) => {
    pluginRegistry.dispatchHook('onAgentSpawn', payload as Record<string, unknown>)
  })

  eventBus.on('agent:finished', (payload) => {
    pluginRegistry.dispatchHook('onAgentFinish', payload as Record<string, unknown>)
  })
}
