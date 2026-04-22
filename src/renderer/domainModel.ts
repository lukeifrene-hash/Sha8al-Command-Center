import type { Milestone, QAGroup, ReviewSession } from '../main/parser'

// AI Commerce Index Platform — 4-lane structure (pivot from TalkStore chat-era 5 lanes).
// See /Users/luqman/Desktop/Projects/talkstore/Brainstorming & Pivot/ROADMAP.md
// for the milestone → lane mapping.
export type DisplayDomain =
  | 'foundation'
  | 'product_engines'
  | 'merchant_facing'
  | 'ship_and_operate'

export interface DomainLane {
  id: DisplayDomain
  label: string
  color: string
  description: string
}

export const DOMAIN_LANES: DomainLane[] = [
  {
    id: 'foundation',
    label: 'Foundation',
    color: '#585CF0',
    description: 'Schema, scope migration, multi-LLM infra, async job queue',
  },
  {
    id: 'product_engines',
    label: 'Product Engines',
    color: '#14B8A6',
    description: 'Scoring, catalog intelligence, autopilot, attribution',
  },
  {
    id: 'merchant_facing',
    label: 'Merchant-facing',
    color: '#5B6EE8',
    description: 'Admin UI, onboarding, dashboards, marketing landing',
  },
  {
    id: 'ship_and_operate',
    label: 'Ship & Operate',
    color: '#F59E0B',
    description: 'Quality, security, compliance, launch, post-launch iteration',
  },
]

const DOMAIN_COLOR_MAP: Record<string, string> = {
  foundation: '#585CF0',
  product_engines: '#14B8A6',
  merchant_facing: '#5B6EE8',
  ship_and_operate: '#F59E0B',

  // Legacy raw-domain strings emitted by the parser / existing data.
  // Each maps to one of the 4 new lanes for backward compatibility.
  backend: '#585CF0',
  data: '#585CF0',
  schema: '#585CF0',
  compliance: '#F59E0B',
  ops: '#585CF0',
  observability: '#585CF0',
  llm_scoring: '#14B8A6',
  scoring: '#14B8A6',
  product_ops: '#14B8A6',
  autopilot: '#14B8A6',
  attribution: '#14B8A6',
  frontend: '#5B6EE8',
  launch: '#F59E0B',
  launch_gtm: '#F59E0B',
  quality: '#F59E0B',
  testing: '#F59E0B',
  performance: '#F59E0B',
  shopify_review: '#F59E0B',
}

// Phase-ID → lane-ID mapping. Mirrors the 8 phases in `schedule.phases` on the
// tracker and the lane each phase primarily belongs to. Used as the second-pass
// resolver when `milestone.domain` doesn't directly match a lane ID.
const PHASE_TO_LANE: Record<string, DisplayDomain> = {
  phase_0_prep: 'foundation',
  phase_1_foundation: 'foundation',
  phase_2_backend_core: 'product_engines',
  phase_3_frontend: 'merchant_facing',
  phase_4_ux_polish: 'merchant_facing',
  phase_5_quality: 'ship_and_operate',
  phase_6_launch: 'ship_and_operate',
  phase_7_post_launch: 'ship_and_operate',
}

// Milestone-ID → lane-ID overrides. M1-M10 hand-placed per ROADMAP.md.
const MILESTONE_TO_LANE: Record<string, DisplayDomain> = {
  m1_purge_and_foundation_reset: 'foundation',
  m2_multi_llm_and_async_infra: 'foundation',
  m3_scoring_engine: 'product_engines',
  m4_catalog_intelligence_engine: 'product_engines',
  m5_autopilot_and_guard: 'product_engines',
  m6_attribution_pipeline: 'product_engines',
  m7_merchant_surfaces: 'merchant_facing',
  m8_ux_polish_and_marketing: 'merchant_facing',
  m9_quality_security_compliance: 'ship_and_operate',
  m10_launch_and_post_launch: 'ship_and_operate',
}

export function normalizeMilestoneDomain(milestone: Milestone): DisplayDomain {
  // 1. Direct milestone-ID lookup (fast path for the 10 seeded milestones).
  const byId = MILESTONE_TO_LANE[milestone.id]
  if (byId) return byId

  // 2. Direct lane-ID match on `milestone.domain`.
  if (
    milestone.domain === 'foundation' ||
    milestone.domain === 'product_engines' ||
    milestone.domain === 'merchant_facing' ||
    milestone.domain === 'ship_and_operate'
  ) {
    return milestone.domain
  }

  // 3. Phase-ID fallback (lets the parser emit raw phase IDs without explicit lane).
  const byPhase = PHASE_TO_LANE[milestone.phase]
  if (byPhase) return byPhase

  // 4. Hard default — put orphans in ship_and_operate so they're visible,
  //    not silently hidden.
  return 'ship_and_operate'
}

export function getDisplayDomainMeta(milestone: Milestone): DomainLane {
  const normalized = normalizeMilestoneDomain(milestone)
  return DOMAIN_LANES.find((lane) => lane.id === normalized) || DOMAIN_LANES[0]
}

export function getMilestoneAccentColor(milestone: Milestone): string {
  return DOMAIN_COLOR_MAP[milestone.domain] || getDisplayDomainMeta(milestone).color
}

export function normalizeReviewSessionDomain(session: ReviewSession): DisplayDomain {
  const title = session.title.toLowerCase()

  if (
    title.includes('schema') ||
    title.includes('migration') ||
    title.includes('scope') ||
    title.includes('billing') ||
    title.includes('llm client') ||
    title.includes('queue')
  ) return 'foundation'

  if (
    title.includes('scoring') ||
    title.includes('index') ||
    title.includes('readiness') ||
    title.includes('visibility') ||
    title.includes('autopilot') ||
    title.includes('guard') ||
    title.includes('attribution') ||
    title.includes('catalog') ||
    title.includes('fix executor') ||
    title.includes('mention')
  ) return 'product_engines'

  if (
    title.includes('dashboard') ||
    title.includes('onboarding') ||
    title.includes('gap list') ||
    title.includes('fix preview') ||
    title.includes('settings') ||
    title.includes('landing') ||
    title.includes('marketing') ||
    title.includes('ui polish') ||
    title.includes('ux polish') ||
    title.includes('polaris')
  ) return 'merchant_facing'

  if (
    title.includes('shopify review') ||
    title.includes('submission') ||
    title.includes('compliance') ||
    title.includes('privacy') ||
    title.includes('dpa') ||
    title.includes('security') ||
    title.includes('e2e') ||
    title.includes('quality') ||
    title.includes('diagnostic') ||
    title.includes('launch') ||
    title.includes('observability')
  ) return 'ship_and_operate'

  if (session.lane === 'ui' || session.lane === 'ux') return 'merchant_facing'
  return 'ship_and_operate'
}

export function normalizeQAGroupDomain(group: QAGroup): DisplayDomain {
  const name = group.name.toLowerCase()

  if (
    name.includes('schema') ||
    name.includes('migration') ||
    name.includes('billing') ||
    name.includes('llm')
  ) return 'foundation'

  if (
    name.includes('scoring') ||
    name.includes('autopilot') ||
    name.includes('attribution') ||
    name.includes('catalog') ||
    name.includes('mention')
  ) return 'product_engines'

  if (
    name.includes('dashboard') ||
    name.includes('onboarding') ||
    name.includes('gap') ||
    name.includes('fix preview') ||
    name.includes('landing')
  ) return 'merchant_facing'

  return 'ship_and_operate'
}

export function getDomainLane(domain: DisplayDomain): DomainLane {
  return DOMAIN_LANES.find((lane) => lane.id === domain) || DOMAIN_LANES[0]
}
