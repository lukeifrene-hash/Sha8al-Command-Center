import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CANONICAL_AGENT_ROSTER_PATH = resolve(
  __dirname,
  '..',
  '..',
  'config',
  'canonical-agent-roster.json'
)

const LEGACY_AGENT_ID_ALIASES = new Map([
  ['claude_chat', 'claude_code'],
])

export function resolveCanonicalAgentId(agentId) {
  if (!agentId) return agentId
  return LEGACY_AGENT_ID_ALIASES.get(agentId) || agentId
}

export function loadCanonicalAgentRoster() {
  if (!existsSync(CANONICAL_AGENT_ROSTER_PATH)) {
    throw new Error(`Canonical agent roster not found at ${CANONICAL_AGENT_ROSTER_PATH}.`)
  }

  const roster = JSON.parse(readFileSync(CANONICAL_AGENT_ROSTER_PATH, 'utf8'))
  if (!Array.isArray(roster)) {
    throw new Error(`Canonical agent roster at ${CANONICAL_AGENT_ROSTER_PATH} is not an array.`)
  }

  return roster
}

export function getCanonicalAgent(agentId) {
  const canonicalId = resolveCanonicalAgentId(agentId)
  return loadCanonicalAgentRoster().find((agent) => agent.id === canonicalId) || null
}

export function mergeCanonicalAgentRoster(existingAgents = []) {
  const roster = loadCanonicalAgentRoster()
  const existingById = new Map(existingAgents.map((agent) => [agent.id, agent]))
  const consumedIds = new Set()

  const merged = roster.map((canonicalAgent) => {
    const aliasMatch = existingAgents.find(
      (agent) => resolveCanonicalAgentId(agent.id) === canonicalAgent.id
    )
    const existing = existingById.get(canonicalAgent.id) || aliasMatch || null

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
        last_action_at: existing.last_action_at ?? canonicalAgent.last_action_at ?? null,
        session_action_count:
          typeof existing.session_action_count === 'number'
            ? existing.session_action_count
            : canonicalAgent.session_action_count ?? 0,
      }
    }

    return { ...canonicalAgent }
  })

  const extras = existingAgents.filter((agent) => !consumedIds.has(agent.id))
  return [...merged, ...extras]
}
