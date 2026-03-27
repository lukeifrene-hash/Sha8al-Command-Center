/**
 * Task Classifier — Lightweight triage step before exploration.
 *
 * Determines complexity, relevant skills, agents, commands, and whether
 * web research is needed. Runs on Haiku for speed (~5 seconds).
 *
 * This avoids overthinking simple tasks and underthinkin complex ones.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { TALKSTORE_ROOT, type TrackerState, type Subtask, type Milestone } from './tracker.js'
import { runAgentStep } from './agentRunner.js'

// ─── Domain → Skill Mapping ────────────────────────────────────────────────

const DOMAIN_SKILLS: Record<string, string[]> = {
  foundation: ['shopify-api-patterns'],
  storefront: ['storefront-domain', 'liquid-generation', 'shopify-api-patterns'],
  product_ops: ['product-ops-domain', 'shopify-api-patterns'],
  commerce_intel: ['commerce-intel-domain', 'shopify-api-patterns'],
  launch_prep: ['billing-flow', 'shopify-api-patterns'],
  review_buffer: ['shopify-api-patterns'],
  distribution: [],
  v1_2: ['storefront-domain', 'product-ops-domain', 'shopify-api-patterns'],
  v1_5: ['storefront-domain', 'product-ops-domain', 'shopify-api-patterns'],
}

// ─── Keyword-Based Skill Detection ──────────────────────────────────────────

const SKILL_KEYWORDS: Record<string, string[]> = {
  'storefront-domain': ['theme', 'section', 'liquid', 'storefront', 'template', 'preview', 'duplicate', 'install'],
  'liquid-generation': ['liquid', 'section', '.liquid', 'schema', 'stylesheet', 'carousel', 'hero', 'banner', 'accordion', 'grid'],
  'product-ops-domain': ['product', 'metafield', 'description', 'collection', 'catalog', 'enrichment', 'DCI', 'score', 'feed'],
  'commerce-intel-domain': ['analytics', 'revenue', 'order', 'cohort', 'inventory', 'performance', 'report', 'dead stock'],
  'billing-flow': ['billing', 'subscription', 'plan', 'task count', 'usage', 'charge', 'upgrade', 'payg', 'pricing'],
  'shopify-api-patterns': ['shopify', 'api', 'graphql', 'rest', 'webhook', 'session', 'oauth', 'admin'],
}

// ─── Agent/Command Recommendations ──────────────────────────────────────────

const SKILL_TO_AGENTS: Record<string, string[]> = {
  'storefront-domain': ['liquid-validator'],
  'liquid-generation': ['liquid-validator'],
}

const SKILL_TO_COMMANDS: Record<string, string[]> = {
  'storefront-domain': ['scan-theme', 'pre-commit'],
  'liquid-generation': ['pre-commit'],
  'product-ops-domain': ['score-products', 'pre-commit'],
  'billing-flow': ['pre-commit'],
  'shopify-api-patterns': ['pre-commit'],
}

// ─── Rule Associations ──────────────────────────────────────────────────────

const SKILL_TO_RULES: Record<string, string[]> = {
  'storefront-domain': ['theme-safety'],
  'liquid-generation': ['theme-safety'],
}

// ─── Complexity Heuristics ──────────────────────────────────────────────────

const SIMPLE_SIGNALS = [
  'landing page', 'static page', 'deploy', 'configure', 'set up', 'install',
  'DNS', 'domain', 'meta tags', 'analytics', 'environment variable', 'copy',
  'Open Graph', 'social', 'privacy policy', 'waitlist', 'email capture',
]

const COMPLEX_SIGNALS = [
  'classification', 'routing', 'pipeline', 'real-time', 'streaming',
  'duplication', 'installation flow', 'rollback', 'migration',
  'billing', 'subscription', 'webhook', 'bulk', 'batch',
  'health score', 'proactive', 'detection', 'intelligence',
  'multi-theme', 'edge case', 'safety', 'hardening',
]

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaskClassification {
  complexity: 'simple' | 'moderate' | 'complex'
  relevantSkills: string[]
  relevantAgents: string[]
  relevantCommands: string[]
  relevantRules: string[]
  needsWebResearch: boolean
  explorerModel: string
  explorerTimeoutMs: number
  plannerModel: string
  plannerTimeoutMs: number
  reasoning: string
}

// ─── Classifier ─────────────────────────────────────────────────────────────

export function classifyTask(
  state: TrackerState,
  subtask: Subtask,
  milestone: Milestone,
): TaskClassification {
  const label = subtask.label.toLowerCase()
  const domain = milestone.domain

  // 1. Determine relevant skills (domain + keyword matching)
  const domainSkills = new Set(DOMAIN_SKILLS[domain] || [])
  const keywordSkills = new Set<string>()

  for (const [skill, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (keywords.some((kw) => label.includes(kw.toLowerCase()))) {
      keywordSkills.add(skill)
    }
  }

  const relevantSkills = [...new Set([...domainSkills, ...keywordSkills])]

  // 2. Determine recommended agents and commands
  const relevantAgents = [...new Set(
    relevantSkills.flatMap((s) => SKILL_TO_AGENTS[s] || [])
  )]
  // Always recommend code-reviewer
  if (!relevantAgents.includes('code-reviewer')) {
    relevantAgents.push('code-reviewer')
  }

  const relevantCommands = [...new Set(
    relevantSkills.flatMap((s) => SKILL_TO_COMMANDS[s] || [])
  )]
  // Always recommend pre-commit
  if (!relevantCommands.includes('pre-commit')) {
    relevantCommands.push('pre-commit')
  }

  const relevantRules = [...new Set(
    relevantSkills.flatMap((s) => SKILL_TO_RULES[s] || [])
  )]

  // 3. Determine complexity
  const simpleScore = SIMPLE_SIGNALS.filter((s) => label.includes(s.toLowerCase())).length
  const complexScore = COMPLEX_SIGNALS.filter((s) => label.includes(s.toLowerCase())).length

  // Also factor in: number of skills involved, domain complexity
  const domainComplexity = ['storefront', 'product_ops', 'commerce_intel'].includes(domain) ? 1 : 0

  let complexity: 'simple' | 'moderate' | 'complex'
  const totalComplexScore = complexScore + domainComplexity + (relevantSkills.length > 2 ? 1 : 0)

  if (simpleScore >= 2 && complexScore === 0) {
    complexity = 'simple'
  } else if (totalComplexScore >= 2) {
    complexity = 'complex'
  } else {
    complexity = 'moderate'
  }

  // 4. Web research needed?
  const needsWebResearch = label.includes('api') || label.includes('shopify') ||
    label.includes('graphql') || label.includes('prisma') ||
    label.includes('vercel') || label.includes('supabase') ||
    label.includes('remix') || label.includes('polaris') ||
    complexity === 'complex'

  // 5. Adjust model and timeout based on complexity
  const config = {
    simple: { explorerModel: 'opus', explorerTimeout: 3 * 60_000, plannerModel: 'opus', plannerTimeout: 3 * 60_000 },
    moderate: { explorerModel: 'opus', explorerTimeout: 5 * 60_000, plannerModel: 'opus', plannerTimeout: 5 * 60_000 },
    complex: { explorerModel: 'opus', explorerTimeout: 8 * 60_000, plannerModel: 'opus', plannerTimeout: 10 * 60_000 },
  }[complexity]

  // 6. Build reasoning
  const reasoning = [
    `Complexity: ${complexity}`,
    `Domain: ${domain} (${domainComplexity > 0 ? 'high-complexity domain' : 'standard domain'})`,
    `Simple signals: ${simpleScore} (${SIMPLE_SIGNALS.filter((s) => label.includes(s.toLowerCase())).join(', ') || 'none'})`,
    `Complex signals: ${complexScore} (${COMPLEX_SIGNALS.filter((s) => label.includes(s.toLowerCase())).join(', ') || 'none'})`,
    `Skills: ${relevantSkills.join(', ') || 'none'}`,
    `Web research: ${needsWebResearch ? 'yes' : 'no'}`,
    `Explorer: ${config.explorerModel} (${config.explorerTimeout / 60_000}m)`,
    `Planner: ${config.plannerModel} (${config.plannerTimeout / 60_000}m)`,
  ].join(' | ')

  return {
    complexity,
    relevantSkills,
    relevantAgents,
    relevantCommands,
    relevantRules,
    needsWebResearch,
    explorerModel: config.explorerModel,
    explorerTimeoutMs: config.explorerTimeout,
    plannerModel: config.plannerModel,
    plannerTimeoutMs: config.plannerTimeout,
    reasoning,
  }
}

// ─── Skill Content Loader ───────────────────────────────────────────────────

export function loadSkillContent(skillNames: string[]): string {
  const sections: string[] = []

  for (const name of skillNames) {
    const path = join(TALKSTORE_ROOT, `.claude/skills/${name}/SKILL.md`)
    try {
      const content = readFileSync(path, 'utf-8')
      sections.push(`## Skill: ${name}\n\n${content}`)
    } catch {
      // Skill file not found — skip
    }
  }

  return sections.length > 0
    ? `# DOMAIN KNOWLEDGE (from project skills)\n\n${sections.join('\n\n---\n\n')}`
    : ''
}

// ─── Rule Content Loader ────────────────────────────────────────────────────

export function loadRuleContent(ruleNames: string[]): string {
  const sections: string[] = []

  for (const name of ruleNames) {
    const path = join(TALKSTORE_ROOT, `.claude/rules/${name}.md`)
    try {
      const content = readFileSync(path, 'utf-8')
      sections.push(`## Rule: ${name}\n\n${content}`)
    } catch {
      // Rule file not found — skip
    }
  }

  return sections.length > 0
    ? `# MANDATORY RULES\n\n${sections.join('\n\n---\n\n')}`
    : ''
}
