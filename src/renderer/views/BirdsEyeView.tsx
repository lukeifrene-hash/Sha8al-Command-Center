import { useMemo, useState } from 'react'
import data from '../data/birds-eye-data.json'

// ── Types ──────────────────────────────────────────────────────────────

type SubTab = 'system' | 'roadmap'
type Status = 'working' | 'partial' | 'not_started'

interface UseCase {
  id: string
  name: string
  description: string
  status: Status
  version: string
  task_cost: string
  blockers: string[]
}

interface Category {
  id: string
  name: string
  color: string
  use_cases: UseCase[]
}

// ── CTA Data ──────────────────────────────────────────────────────────

const SYSTEM_CTAS = [
  { id: 'enrich-products', name: 'Enrich Products', domain: 'Product Ops', cost: '1 task', oneLiner: 'Set metafields across up to 25 products with optional description rewrites.' },
  { id: 'rewrite-description', name: 'Rewrite Desc', domain: 'Product Ops', cost: '1 task', oneLiner: 'Rewrite one product\'s description to structured, factual HTML.' },
  { id: 'create-collection', name: 'Create Collection', domain: 'Product Ops', cost: '1 task', oneLiner: 'Create a new manual or smart collection.' },
  { id: 'add-to-collection', name: 'Add To Collection', domain: 'Product Ops', cost: '1 task', oneLiner: 'Add up to 250 products to an existing collection.' },
  { id: 'blog-post', name: 'Blog Post', domain: 'Content Ops', cost: '1 task', oneLiner: 'Write a blog post draft with title, body, and tags.' },
  { id: 'collection-desc', name: 'Collection Desc', domain: 'Content Ops', cost: '1 task', oneLiner: 'Write SEO descriptions for up to 10 collections.' },
  { id: 'meta-tags', name: 'Meta Tags', domain: 'Content Ops', cost: '1 task', oneLiner: 'Set SEO meta title and description on up to 25 products.' },
] as const

// ── Constants ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Status, string> = {
  working: '#1D9E75',
  partial: '#BA7517',
  not_started: '#888780',
}

const STATUS_LABELS: Record<Status, string> = {
  working: 'Working',
  partial: 'Partial',
  not_started: 'Not started',
}

const COST_STYLE: Record<string, { bg: string; text: string }> = {
  Free: { bg: 'rgba(29, 158, 117, 0.15)', text: '#1D9E75' },
}
const COST_PAID = { bg: 'rgba(88, 92, 240, 0.15)', text: '#8286FF' }

function costStyle(cost: string) {
  return COST_STYLE[cost] || COST_PAID
}

// ── Components ────────────────────────────────────────────────────────

function CostBadge({ cost }: { cost: string }) {
  const s = costStyle(cost)
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider inline-block"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {cost}
    </span>
  )
}

function RoadmapTab({ categories }: { categories: Category[] }) {
  const { v1, v1_5, v2_uc } = useMemo(() => {
    const v1: UseCase[] = []
    const v1_5: UseCase[] = []
    const v2_uc: UseCase[] = []
    for (const cat of categories) {
      for (const uc of cat.use_cases) {
        if (uc.version === 'v1') v1.push(uc)
        else if (uc.version === 'v1_5') v1_5.push(uc)
        else v2_uc.push(uc)
      }
    }
    return { v1, v1_5, v2_uc }
  }, [categories])

  const v1_5_blockers = useMemo(() => {
    const all = new Set<string>()
    for (const uc of v1_5) {
      for (const b of uc.blockers) all.add(b)
    }
    return Array.from(all)
  }, [v1_5])

  const rm = data.roadmap
  const v2caps = data.v2_capabilities

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* V1 */}
      <div className="rounded-lg border-2 border-border bg-surface p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-white">V1 — {rm.v1.label}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider text-white"
            style={{ backgroundColor: rm.v1.badge_color }}>
            {rm.v1.badge.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">{rm.v1.unlocks}</p>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          Use cases ({v1.length})
        </div>
        <div className="space-y-1 flex-1">
          {v1.map(uc => (
            <div key={uc.id} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.working }} />
              <span className="text-[11px] text-white/80">{uc.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-border">
          <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.working }}>
            {v1.filter(u => u.status === 'working').length}/{v1.length} working
          </span>
        </div>
      </div>

      {/* V1.5 */}
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-white">V1.5 — {rm.v1_5.label}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider text-white"
            style={{ backgroundColor: rm.v1_5.badge_color }}>
            {rm.v1_5.badge.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">{rm.v1_5.unlocks}</p>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          New use cases ({v1_5.length})
        </div>
        <div className="space-y-1 mb-3">
          {v1_5.map(uc => (
            <div key={uc.id} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[uc.status as Status] }} />
              <span className="text-[11px] text-white/80">{uc.name}</span>
            </div>
          ))}
        </div>
        {v1_5_blockers.length > 0 && (
          <>
            <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
              Blockers ({v1_5_blockers.length})
            </div>
            <div className="space-y-1 flex-1">
              {v1_5_blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[10px] text-behind mt-0.5">!</span>
                  <span className="text-[10px] text-muted">{b}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* V2 */}
      <div className="rounded-lg border border-border bg-surface p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-white">V2 — {rm.v2.label}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider text-white"
            style={{ backgroundColor: rm.v2.badge_color }}>
            {rm.v2.badge.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">{rm.v2.unlocks}</p>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          Capabilities ({v2caps.length})
        </div>
        <div className="space-y-1.5 mb-3">
          {v2caps.map((cap, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#888780' }} />
              <span className="text-[11px] text-white/80">{cap.name}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] font-bold tracking-wider text-white/50 mb-2 uppercase">
          Depends on
        </div>
        <div className="space-y-1 flex-1">
          {Array.from(new Set(v2caps.map(c => c.depends_on))).map((dep, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[10px] text-muted mt-0.5">~</span>
              <span className="text-[10px] text-muted">{dep}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── System Tab ────────────────────────────────────────────────────────

function SystemTab() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [expandedCta, setExpandedCta] = useState<string | null>(null)

  function edgeOpacity(fromNode: string, toNode: string): number {
    if (!hoveredNode) return 0.45
    if (hoveredNode === fromNode || hoveredNode === toNode) return 0.9
    return 0.08
  }

  function nodeOpacity(nodeId: string): number {
    if (!hoveredNode) return 1
    if (hoveredNode === nodeId) return 1
    const connections: Record<string, string[]> = {
      'conversation': ['product-ops', 'commerce-intel', 'content-ops'],
      'product-ops': ['cta-enrich', 'cta-rewrite', 'cta-create-coll', 'cta-add-coll'],
      'content-ops': ['cta-blog', 'cta-coll-desc', 'cta-meta-tags'],
      'commerce-intel': ['cta-enrich', 'cta-rewrite', 'cta-create-coll', 'cta-add-coll', 'cta-blog', 'cta-coll-desc'],
      'cta-enrich': ['product-ops', 'commerce-intel'],
      'cta-rewrite': ['product-ops', 'commerce-intel'],
      'cta-create-coll': ['product-ops', 'commerce-intel'],
      'cta-add-coll': ['product-ops', 'commerce-intel'],
      'cta-blog': ['content-ops', 'commerce-intel'],
      'cta-coll-desc': ['content-ops', 'commerce-intel'],
      'cta-meta-tags': ['content-ops'],
    }
    const connected = connections[hoveredNode] ?? []
    return connected.includes(nodeId) ? 1 : 0.2
  }

  const expandedCtaData = expandedCta ? SYSTEM_CTAS.find(c => c.id === expandedCta) : null

  return (
    <div className="space-y-4">
      {/* A) Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Talkstore Execute Surface</h2>
          <p className="text-[10px] text-muted mt-0.5">Bird's Eye</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-1 rounded border border-accent/40 text-accent-light tracking-wider">
            7 Execute CTAs
          </span>
          <span className="text-[10px] font-bold px-2 py-1 rounded border border-border text-muted tracking-wider">
            4 Domains
          </span>
        </div>
      </div>

      {/* B) Funnel SVG Diagram */}
      <div className="rounded-xl border border-border bg-dark p-5">
        <svg viewBox="0 0 760 340" className="w-full" xmlns="http://www.w3.org/2000/svg">
          {/* Edges: Conversation → Domains */}
          <path d="M380,54 C380,70 130,80 130,100" stroke="#14B8A6" strokeWidth={1.2} fill="none" opacity={edgeOpacity('conversation', 'product-ops')} />
          <path d="M380,54 C380,70 380,80 380,100" stroke="#14B8A6" strokeWidth={1.2} fill="none" opacity={edgeOpacity('conversation', 'commerce-intel')} />
          <path d="M380,54 C380,70 630,80 630,100" stroke="#14B8A6" strokeWidth={1.2} fill="none" opacity={edgeOpacity('conversation', 'content-ops')} />

          {/* Edges: Product Ops → CTAs */}
          <path d="M130,146 C130,170 80,190 80,210" stroke="#14B8A6" strokeWidth={1.5} fill="none" opacity={edgeOpacity('product-ops', 'cta-enrich')} />
          <path d="M130,146 C130,170 230,190 230,210" stroke="#14B8A6" strokeWidth={1.5} fill="none" opacity={edgeOpacity('product-ops', 'cta-rewrite')} />
          <path d="M130,146 C130,175 80,195 80,260" stroke="#14B8A6" strokeWidth={1.2} fill="none" opacity={edgeOpacity('product-ops', 'cta-create-coll')} />
          <path d="M130,146 C130,175 230,195 230,260" stroke="#14B8A6" strokeWidth={1.2} fill="none" opacity={edgeOpacity('product-ops', 'cta-add-coll')} />

          {/* Edges: Content Ops → CTAs */}
          <path d="M630,146 C630,170 555,190 555,210" stroke="#14B8A6" strokeWidth={1.5} fill="none" opacity={edgeOpacity('content-ops', 'cta-blog')} />
          <path d="M630,146 C630,170 695,190 695,210" stroke="#14B8A6" strokeWidth={1.5} fill="none" opacity={edgeOpacity('content-ops', 'cta-coll-desc')} />
          <path d="M630,146 C630,175 625,195 625,260" stroke="#14B8A6" strokeWidth={1.2} fill="none" opacity={edgeOpacity('content-ops', 'cta-meta-tags')} />

          {/* Edges: Commerce Intel → Bridged CTAs (dashed purple) */}
          <path d="M380,146 C380,175 80,195 80,210" stroke="#585CF0" strokeWidth={1} fill="none" strokeDasharray="5,3" opacity={edgeOpacity('commerce-intel', 'cta-enrich')} />
          <path d="M380,146 C380,175 230,195 230,210" stroke="#585CF0" strokeWidth={1} fill="none" strokeDasharray="5,3" opacity={edgeOpacity('commerce-intel', 'cta-rewrite')} />
          <path d="M380,146 C380,175 80,195 80,260" stroke="#585CF0" strokeWidth={1} fill="none" strokeDasharray="5,3" opacity={edgeOpacity('commerce-intel', 'cta-create-coll')} />
          <path d="M380,146 C380,175 230,195 230,260" stroke="#585CF0" strokeWidth={1} fill="none" strokeDasharray="5,3" opacity={edgeOpacity('commerce-intel', 'cta-add-coll')} />
          <path d="M380,146 C380,175 555,195 555,210" stroke="#585CF0" strokeWidth={1} fill="none" strokeDasharray="5,3" opacity={edgeOpacity('commerce-intel', 'cta-blog')} />
          <path d="M380,146 C380,175 695,195 695,210" stroke="#585CF0" strokeWidth={1} fill="none" strokeDasharray="5,3" opacity={edgeOpacity('commerce-intel', 'cta-coll-desc')} />

          {/* Tier 1: Conversation */}
          <g style={{ opacity: nodeOpacity('conversation') }} onMouseEnter={() => setHoveredNode('conversation')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={300} y={8} width={160} height={46} rx={10} fill="#1a1f2e" stroke="#14B8A6" strokeWidth={1.5} />
            <text x={380} y={24} textAnchor="middle" fill="#9BAAA6" fontSize={8} fontWeight={600}>ENTRY POINT</text>
            <text x={380} y={39} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>Conversation</text>
          </g>

          {/* Tier 2: Domains */}
          <g style={{ opacity: nodeOpacity('product-ops') }} onMouseEnter={() => setHoveredNode('product-ops')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={40} y={100} width={180} height={46} rx={10} fill="#1a1f2e" stroke="#14B8A6" strokeWidth={1.5} />
            <text x={130} y={118} textAnchor="middle" fill="#9BAAA6" fontSize={8}>4 EXECUTE CTAS</text>
            <text x={130} y={134} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>Product Ops</text>
          </g>

          <g style={{ opacity: nodeOpacity('commerce-intel') }} onMouseEnter={() => setHoveredNode('commerce-intel')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={290} y={100} width={180} height={46} rx={10} fill="#1a1f2e" stroke="#585CF0" strokeWidth={1.5} />
            <text x={380} y={118} textAnchor="middle" fill="#9BAAA6" fontSize={8}>READ-ONLY / 6 BRIDGES</text>
            <text x={380} y={134} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>Commerce Intel</text>
          </g>

          <g style={{ opacity: nodeOpacity('content-ops') }} onMouseEnter={() => setHoveredNode('content-ops')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={540} y={100} width={180} height={46} rx={10} fill="#1a1f2e" stroke="#14B8A6" strokeWidth={1.5} />
            <text x={630} y={118} textAnchor="middle" fill="#9BAAA6" fontSize={8}>3 EXECUTE CTAS</text>
            <text x={630} y={134} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>Content Ops</text>
          </g>

          {/* Tier 3: Product Ops CTAs (2x2 grid) */}
          <g style={{ opacity: nodeOpacity('cta-enrich') }} onMouseEnter={() => setHoveredNode('cta-enrich')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={10} y={210} width={140} height={38} rx={8} fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth={1.2} />
            <text x={80} y={233} textAnchor="middle" fill="#2DD4BF" fontSize={10}>Enrich Products</text>
          </g>

          <g style={{ opacity: nodeOpacity('cta-rewrite') }} onMouseEnter={() => setHoveredNode('cta-rewrite')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={160} y={210} width={140} height={38} rx={8} fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth={1.2} />
            <text x={230} y={233} textAnchor="middle" fill="#2DD4BF" fontSize={10}>Rewrite Description</text>
          </g>

          <g style={{ opacity: nodeOpacity('cta-create-coll') }} onMouseEnter={() => setHoveredNode('cta-create-coll')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={10} y={260} width={140} height={38} rx={8} fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth={1.2} />
            <text x={80} y={283} textAnchor="middle" fill="#2DD4BF" fontSize={10}>Create Collection</text>
          </g>

          <g style={{ opacity: nodeOpacity('cta-add-coll') }} onMouseEnter={() => setHoveredNode('cta-add-coll')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={160} y={260} width={140} height={38} rx={8} fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth={1.2} />
            <text x={230} y={283} textAnchor="middle" fill="#2DD4BF" fontSize={10}>Add To Collection</text>
          </g>

          {/* Tier 3: Content Ops CTAs (2+1 layout) */}
          <g style={{ opacity: nodeOpacity('cta-blog') }} onMouseEnter={() => setHoveredNode('cta-blog')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={490} y={210} width={130} height={38} rx={8} fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth={1.2} />
            <text x={555} y={233} textAnchor="middle" fill="#2DD4BF" fontSize={10}>Blog Post</text>
          </g>

          <g style={{ opacity: nodeOpacity('cta-coll-desc') }} onMouseEnter={() => setHoveredNode('cta-coll-desc')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={630} y={210} width={130} height={38} rx={8} fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth={1.2} />
            <text x={695} y={233} textAnchor="middle" fill="#2DD4BF" fontSize={10}>Collection Desc</text>
          </g>

          <g style={{ opacity: nodeOpacity('cta-meta-tags') }} onMouseEnter={() => setHoveredNode('cta-meta-tags')} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
            <rect x={560} y={260} width={130} height={38} rx={8} fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth={1.2} />
            <text x={625} y={283} textAnchor="middle" fill="#2DD4BF" fontSize={10}>Meta Tags</text>
          </g>

          {/* Legend */}
          <g transform="translate(280, 315)">
            <line x1={0} y1={0} x2={24} y2={0} stroke="#14B8A6" strokeWidth={1.5} />
            <text x={30} y={4} fill="#9BAAA6" fontSize={9}>Owns</text>
            <line x1={80} y1={0} x2={104} y2={0} stroke="#585CF0" strokeWidth={1} strokeDasharray="5,3" />
            <text x={110} y={4} fill="#9BAAA6" fontSize={9}>Bridges</text>
          </g>
        </svg>
      </div>

      {/* C) CTA Strip */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-bold tracking-wider text-white/50 uppercase">Execute Surface</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {SYSTEM_CTAS.map(cta => (
            <button
              key={cta.id}
              onClick={() => setExpandedCta(expandedCta === cta.id ? null : cta.id)}
              className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                expandedCta === cta.id
                  ? 'border-accent/40 bg-accent/8'
                  : 'border-border bg-dark hover:border-white/10'
              }`}
            >
              <div className="text-[11px] font-semibold text-white truncate">{cta.name}</div>
              <div className="text-[9px] text-muted mt-0.5">{cta.domain}</div>
              <div className="mt-1"><CostBadge cost={cta.cost} /></div>
            </button>
          ))}
        </div>
        {expandedCtaData && (
          <div className="mt-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5">
            <span className="text-[11px] text-white/80">{expandedCtaData.oneLiner}</span>
          </div>
        )}
      </div>

      {/* D) Missing Bridge Callout */}
      <div className="rounded-lg border border-behind/25 bg-behind/5 px-4 py-2.5 flex items-center gap-3">
        <span className="text-[9px] font-bold tracking-[0.15em] text-behind uppercase whitespace-nowrap">Missing Bridge</span>
        <span className="text-[11px] text-muted">
          Commerce Intel has no bridge to <span className="font-mono text-white/70">generateMetaTags</span> — 6 of 7 CTAs reachable
        </span>
      </div>
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────────────────

export function BirdsEyeView() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('system')
  const categories = data.categories as Category[]

  const subTabs: { id: SubTab; icon: string; label: string }[] = [
    { id: 'system', icon: '◆', label: 'System' },
    { id: 'roadmap', icon: '▸', label: 'Roadmap' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border bg-dark z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-semibold text-white">Product View</h1>
            <p className="text-[10px] text-muted mt-0.5">
              Built from codebase scan — {new Date(data.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.working }}>
              {data.totals.working} working
            </span>
            <span className="text-[10px] text-muted">/</span>
            <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.partial }}>
              {data.totals.partial} partial
            </span>
            <span className="text-[10px] text-muted">/</span>
            <span className="text-[10px] font-mono" style={{ color: STATUS_COLORS.not_started }}>
              {data.totals.not_started} not started
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeSubTab === tab.id
                  ? 'bg-accent/15 text-accent-light'
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeSubTab === 'system' && <SystemTab />}
        {activeSubTab === 'roadmap' && <RoadmapTab categories={categories} />}
      </div>
    </div>
  )
}
