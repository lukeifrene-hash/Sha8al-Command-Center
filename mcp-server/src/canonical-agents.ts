import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

export interface CanonicalAgent {
  id: string
  name: string
  type: string
  parent_id?: string
  color: string
  status: string
  permissions: string[]
  last_action_at: string | null
  session_action_count: number
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const CANONICAL_AGENT_ROSTER_PATH = resolve(
  __dirname,
  '..',
  '..',
  'config',
  'canonical-agent-roster.json'
)

const LEGACY_AGENT_ID_ALIASES = new Map<string, string>([
  ['claude_chat', 'claude_code'],
])

export function resolveCanonicalAgentId(agentId: string): string {
  return LEGACY_AGENT_ID_ALIASES.get(agentId) ?? agentId
}

export function loadCanonicalAgentRoster(): CanonicalAgent[] {
  const roster = JSON.parse(readFileSync(CANONICAL_AGENT_ROSTER_PATH, 'utf-8')) as CanonicalAgent[]
  return Array.isArray(roster) ? roster : []
}

export function getCanonicalAgent(agentId: string): CanonicalAgent | null {
  const canonicalId = resolveCanonicalAgentId(agentId)
  return loadCanonicalAgentRoster().find((agent) => agent.id === canonicalId) ?? null
}

export function mergeCanonicalAgentRoster<T extends CanonicalAgent>(existingAgents: T[] = []): T[] {
  const roster = loadCanonicalAgentRoster()
  const existingById = new Map(existingAgents.map((agent) => [agent.id, agent]))
  const consumedIds = new Set<string>()

  const merged = roster.map((canonicalAgent) => {
    const aliasMatch = existingAgents.find(
      (agent) => resolveCanonicalAgentId(agent.id) === canonicalAgent.id
    )
    const existing = existingById.get(canonicalAgent.id) ?? aliasMatch ?? null

    if (existing) {
      consumedIds.add(existing.id)
      return {
        ...canonicalAgent,
        ...existing,
        id: canonicalAgent.id,
        name: existing.name || canonicalAgent.name,
        type: existing.type || canonicalAgent.type,
        parent_id: existing.parent_id ?? canonicalAgent.parent_id,
        color: existing.color || canonicalAgent.color,
        status: existing.status || canonicalAgent.status,
        permissions:
          Array.isArray(existing.permissions) && existing.permissions.length > 0
            ? existing.permissions
            : canonicalAgent.permissions,
        last_action_at: existing.last_action_at ?? canonicalAgent.last_action_at,
        session_action_count:
          typeof existing.session_action_count === 'number'
            ? existing.session_action_count
            : canonicalAgent.session_action_count,
      } as T
    }

    return { ...canonicalAgent } as T
  })

  const extras = existingAgents.filter((agent) => !consumedIds.has(agent.id))
  return [...merged, ...extras]
}
