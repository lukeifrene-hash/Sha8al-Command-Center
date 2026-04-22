# Bird's Eye Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-tab, text-heavy Bird's Eye view with a single unified funnel diagram + minimal CTA strip in one file.

**Architecture:** Delete all domain-specific tabs and drag-and-drop diagram infrastructure. Replace with a `SystemTab` component containing a static SVG funnel diagram (3 tiers: Conversation → Domains → Execute CTAs) with hover-highlight interaction, a 7-card minimal strip, and a missing-bridge callout. Keep `RoadmapTab` as-is.

**Tech Stack:** React, inline SVG in JSX, CSS-only tooltips, Tailwind utility classes (matching existing codebase style).

---

### Task 1: Delete Dead Code

**Files:**
- Modify: `src/renderer/views/BirdsEyeView.tsx`

This task removes all the code the spec marks for deletion. After this task, the file will only contain: imports, `SubTab` type, `Status`/`Category`/`UseCase` types (for Roadmap), `STATUS_COLORS`/`STATUS_LABELS` (for Roadmap), `costStyle`, `CostBadge`, `SpecRow`, `RoadmapTab`, and the `BirdsEyeView` export.

- [ ] **Step 1: Read the current file to confirm structure**

Run: `wc -l src/renderer/views/BirdsEyeView.tsx`
Expected: ~1500+ lines

- [ ] **Step 2: Delete all domain-specific tab components and their data**

Remove these blocks entirely:
- `CONTENT_OPS_BASE_DIAGRAM` constant
- `PRODUCT_OPS_BASE_DIAGRAM` constant
- `COMMERCE_INTEL_BASE_DIAGRAM` constant
- `CONVERSATION_BASE_DIAGRAM` constant
- `CONTENT_OPS_EXECUTE_CTAS` array
- `PRODUCT_OPS_EXECUTE_CTAS` array
- `COMMERCE_INTEL_BRIDGES` array and `BridgeCta` interface
- `ContentOpsTab` function component
- `ProductOpsTab` function component
- `CommerceIntelTab` function component
- `ConversationTab` function component
- `ContentOpsDiagram` function component
- `ProductOpsDiagram` function component
- `CommerceIntelDiagram` function component
- `ConversationDiagram` function component

- [ ] **Step 3: Delete the DomainDiagramSection component and all its helpers**

Remove these blocks entirely:
- `DomainDiagramSectionProps` interface
- `DomainDiagramSection` function component (the entire drag-and-drop canvas)
- `BirdsEyeDiagramStore` interface
- `DomainDiagramState` interface
- `DiagramNode` interface
- `DiagramEdge` interface
- `DiagramNodeKind` type
- `DomainDiagramKey` type
- `DIAGRAM_STORAGE_KEY` constant
- `DIAGRAM_NODE_WIDTH`, `DIAGRAM_NODE_HEIGHT`, `DIAGRAM_CANVAS_HEIGHT` constants
- `CONTENT_OPS_DIAGRAM_KEY`, `PRODUCT_OPS_DIAGRAM_KEY`, `COMMERCE_INTEL_DIAGRAM_KEY`, `CONVERSATION_DIAGRAM_KEY` constants
- `cloneDiagram` function
- `normalizeDiagramState` function
- `isDomainDiagramState` function
- `loadDiagramState` function
- `persistDiagramState` function
- `clamp` function
- `nodeCenter` function
- `collectSubtreeNodeIds` function

- [ ] **Step 4: Simplify the SubTab type and BirdsEyeView component**

Update the `SubTab` type:
```tsx
type SubTab = 'system' | 'roadmap'
```

Update the `BirdsEyeView` component to only have two tabs and render a placeholder for System:
```tsx
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
        {activeSubTab === 'system' && <div className="text-muted text-sm">System tab — placeholder</div>}
        {activeSubTab === 'roadmap' && <RoadmapTab categories={categories} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Remove unused imports**

Remove any imports that were only used by deleted components (e.g. `useEffect`, `useRef`, `useMemo` if only Roadmap uses `useMemo`). Keep `useState` (used by `BirdsEyeView` and will be used by `SystemTab`).

- [ ] **Step 6: Build and verify**

Run: `cd /Users/luqman/Desktop/Projects/talkstore-command-center && npm run build`
Expected: Clean build, no errors. The app shows two tabs — System (placeholder text) and Roadmap (unchanged).

- [ ] **Step 7: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add src/renderer/views/BirdsEyeView.tsx
git commit -m "refactor(birds-eye): delete domain tabs and diagram infrastructure, reduce to system+roadmap"
```

---

### Task 2: Build the SystemTab with Static Funnel SVG

**Files:**
- Modify: `src/renderer/views/BirdsEyeView.tsx`

- [ ] **Step 1: Add the CTA data constant**

Add above the `SystemTab` component:
```tsx
const SYSTEM_CTAS = [
  { id: 'enrich-products', name: 'Enrich Products', domain: 'Product Ops', cost: '1 task', oneLiner: 'Set metafields across up to 25 products with optional description rewrites.' },
  { id: 'rewrite-description', name: 'Rewrite Desc', domain: 'Product Ops', cost: '1 task', oneLiner: 'Rewrite one product\'s description to structured, factual HTML.' },
  { id: 'create-collection', name: 'Create Collection', domain: 'Product Ops', cost: '1 task', oneLiner: 'Create a new manual or smart collection.' },
  { id: 'add-to-collection', name: 'Add To Collection', domain: 'Product Ops', cost: '1 task', oneLiner: 'Add up to 250 products to an existing collection.' },
  { id: 'blog-post', name: 'Blog Post', domain: 'Content Ops', cost: '1 task', oneLiner: 'Write a blog post draft with title, body, and tags.' },
  { id: 'collection-desc', name: 'Collection Desc', domain: 'Content Ops', cost: '1 task', oneLiner: 'Write SEO descriptions for up to 10 collections.' },
  { id: 'meta-tags', name: 'Meta Tags', domain: 'Content Ops', cost: '1 task', oneLiner: 'Set SEO meta title and description on up to 25 products.' },
] as const
```

- [ ] **Step 2: Create the SystemTab component shell with header**

Replace the placeholder in the `BirdsEyeView` render:
```tsx
{activeSubTab === 'system' && <SystemTab />}
```

Add the `SystemTab` component:
```tsx
function SystemTab() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [expandedCta, setExpandedCta] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[0.22em] text-accent-light uppercase">Bird's Eye</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Talkstore Execute Surface</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-accent/30 bg-dark px-4 py-3 text-right">
            <div className="text-2xl font-bold font-mono text-accent-light">7</div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">Execute CTAs</div>
          </div>
          <div className="rounded-lg border border-border bg-dark px-4 py-3 text-right">
            <div className="text-2xl font-bold font-mono text-muted">4</div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">Domains</div>
          </div>
        </div>
      </div>

      {/* Funnel Diagram — added in Step 3 */}

      {/* CTA Strip — added in Task 3 */}

      {/* Missing Bridge Callout — added in Task 3 */}
    </div>
  )
}
```

- [ ] **Step 3: Add the funnel SVG diagram**

Inside `SystemTab`, after the header section, add the diagram container with the full inline SVG. The SVG has three tiers of nodes and edges between them. Every node and edge gets dynamic opacity based on `hoveredNode`.

Helper function inside `SystemTab` (before the return):
```tsx
function edgeOpacity(fromNode: string, toNode: string): number {
  if (!hoveredNode) return 0.45
  if (hoveredNode === fromNode || hoveredNode === toNode) return 0.9
  return 0.08
}

function nodeOpacity(nodeId: string): number {
  if (!hoveredNode) return 1
  if (hoveredNode === nodeId) return 1
  // Check if this node is connected to the hovered node
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

function nodeBorderColor(nodeId: string, baseColor: string): string {
  if (!hoveredNode) return baseColor
  if (hoveredNode === nodeId) return nodeId === 'commerce-intel' ? '#8286FF' : '#2DD4BF'
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
  return connected.includes(nodeId) ? baseColor : baseColor
}
```

Then the SVG inside a container div:
```tsx
<div className="rounded-xl border border-border bg-dark p-5">
  <svg viewBox="0 0 760 340" className="w-full h-auto">
    {/* Tier 1: Conversation */}
    <g
      onMouseEnter={() => setHoveredNode('conversation')}
      onMouseLeave={() => setHoveredNode(null)}
      style={{ cursor: 'default', opacity: nodeOpacity('conversation') }}
    >
      <rect x="300" y="8" width="160" height="46" rx="10" fill="#1a1f2e" stroke="#14B8A6" strokeWidth="1.5" />
      <text x="380" y="28" textAnchor="middle" fill="#9BAAA6" fontSize="8" fontWeight="700" letterSpacing="0.15em">ENTRY POINT</text>
      <text x="380" y="43" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600">Conversation</text>
    </g>

    {/* Tier 2: Product Ops */}
    <g
      onMouseEnter={() => setHoveredNode('product-ops')}
      onMouseLeave={() => setHoveredNode(null)}
      style={{ cursor: 'default', opacity: nodeOpacity('product-ops') }}
    >
      <rect x="40" y="100" width="180" height="46" rx="10" fill="#1a1f2e" stroke="#14B8A6" strokeWidth="1.5" />
      <text x="130" y="120" textAnchor="middle" fill="#9BAAA6" fontSize="8" fontWeight="700" letterSpacing="0.12em">4 EXECUTE CTAS</text>
      <text x="130" y="135" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600">Product Ops</text>
    </g>

    {/* Tier 2: Commerce Intel */}
    <g
      onMouseEnter={() => setHoveredNode('commerce-intel')}
      onMouseLeave={() => setHoveredNode(null)}
      style={{ cursor: 'default', opacity: nodeOpacity('commerce-intel') }}
    >
      <rect x="290" y="100" width="180" height="46" rx="10" fill="#1a1f2e" stroke="#585CF0" strokeWidth="1.5" />
      <text x="380" y="120" textAnchor="middle" fill="#9BAAA6" fontSize="8" fontWeight="700" letterSpacing="0.12em">READ-ONLY / 6 BRIDGES</text>
      <text x="380" y="135" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600">Commerce Intel</text>
    </g>

    {/* Tier 2: Content Ops */}
    <g
      onMouseEnter={() => setHoveredNode('content-ops')}
      onMouseLeave={() => setHoveredNode(null)}
      style={{ cursor: 'default', opacity: nodeOpacity('content-ops') }}
    >
      <rect x="540" y="100" width="180" height="46" rx="10" fill="#1a1f2e" stroke="#14B8A6" strokeWidth="1.5" />
      <text x="630" y="120" textAnchor="middle" fill="#9BAAA6" fontSize="8" fontWeight="700" letterSpacing="0.12em">3 EXECUTE CTAS</text>
      <text x="630" y="135" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600">Content Ops</text>
    </g>

    {/* Tier 3: Product Ops CTAs */}
    <g onMouseEnter={() => setHoveredNode('cta-enrich')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'default', opacity: nodeOpacity('cta-enrich') }}>
      <rect x="10" y="210" width="140" height="38" rx="8" fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth="1.2" />
      <text x="80" y="233" textAnchor="middle" fill="#2DD4BF" fontSize="10" fontWeight="500">Enrich Products</text>
    </g>
    <g onMouseEnter={() => setHoveredNode('cta-rewrite')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'default', opacity: nodeOpacity('cta-rewrite') }}>
      <rect x="160" y="210" width="140" height="38" rx="8" fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth="1.2" />
      <text x="230" y="233" textAnchor="middle" fill="#2DD4BF" fontSize="10" fontWeight="500">Rewrite Description</text>
    </g>
    <g onMouseEnter={() => setHoveredNode('cta-create-coll')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'default', opacity: nodeOpacity('cta-create-coll') }}>
      <rect x="10" y="260" width="140" height="38" rx="8" fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth="1.2" />
      <text x="80" y="283" textAnchor="middle" fill="#2DD4BF" fontSize="10" fontWeight="500">Create Collection</text>
    </g>
    <g onMouseEnter={() => setHoveredNode('cta-add-coll')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'default', opacity: nodeOpacity('cta-add-coll') }}>
      <rect x="160" y="260" width="140" height="38" rx="8" fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth="1.2" />
      <text x="230" y="283" textAnchor="middle" fill="#2DD4BF" fontSize="10" fontWeight="500">Add To Collection</text>
    </g>

    {/* Tier 3: Content Ops CTAs */}
    <g onMouseEnter={() => setHoveredNode('cta-blog')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'default', opacity: nodeOpacity('cta-blog') }}>
      <rect x="490" y="210" width="130" height="38" rx="8" fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth="1.2" />
      <text x="555" y="233" textAnchor="middle" fill="#2DD4BF" fontSize="10" fontWeight="500">Blog Post</text>
    </g>
    <g onMouseEnter={() => setHoveredNode('cta-coll-desc')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'default', opacity: nodeOpacity('cta-coll-desc') }}>
      <rect x="630" y="210" width="130" height="38" rx="8" fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth="1.2" />
      <text x="695" y="233" textAnchor="middle" fill="#2DD4BF" fontSize="10" fontWeight="500">Collection Desc</text>
    </g>
    <g onMouseEnter={() => setHoveredNode('cta-meta-tags')} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'default', opacity: nodeOpacity('cta-meta-tags') }}>
      <rect x="560" y="260" width="130" height="38" rx="8" fill="rgba(20,184,166,0.08)" stroke="#14B8A6" strokeWidth="1.2" />
      <text x="625" y="283" textAnchor="middle" fill="#2DD4BF" fontSize="10" fontWeight="500">Meta Tags</text>
    </g>

    {/* Edges: Conversation → Domains (teal, low opacity) */}
    <path d="M 340,54 C 340,75 130,80 130,100" stroke="#14B8A6" strokeWidth="1.2" fill="none" opacity={edgeOpacity('conversation', 'product-ops')} />
    <path d="M 380,54 C 380,75 380,80 380,100" stroke="#14B8A6" strokeWidth="1.2" fill="none" opacity={edgeOpacity('conversation', 'commerce-intel')} />
    <path d="M 420,54 C 420,75 630,80 630,100" stroke="#14B8A6" strokeWidth="1.2" fill="none" opacity={edgeOpacity('conversation', 'content-ops')} />

    {/* Edges: Product Ops → CTAs (teal, solid) */}
    <path d="M 80,146 C 80,175 80,180 80,210" stroke="#14B8A6" strokeWidth="1.5" fill="none" opacity={edgeOpacity('product-ops', 'cta-enrich')} />
    <path d="M 130,146 C 130,175 230,180 230,210" stroke="#14B8A6" strokeWidth="1.5" fill="none" opacity={edgeOpacity('product-ops', 'cta-rewrite')} />
    <path d="M 80,146 C 80,185 80,230 80,260" stroke="#14B8A6" strokeWidth="1.2" fill="none" opacity={edgeOpacity('product-ops', 'cta-create-coll')} />
    <path d="M 180,146 C 180,185 230,230 230,260" stroke="#14B8A6" strokeWidth="1.2" fill="none" opacity={edgeOpacity('product-ops', 'cta-add-coll')} />

    {/* Edges: Content Ops → CTAs (teal, solid) */}
    <path d="M 590,146 C 590,175 555,180 555,210" stroke="#14B8A6" strokeWidth="1.5" fill="none" opacity={edgeOpacity('content-ops', 'cta-blog')} />
    <path d="M 670,146 C 670,175 695,180 695,210" stroke="#14B8A6" strokeWidth="1.5" fill="none" opacity={edgeOpacity('content-ops', 'cta-coll-desc')} />
    <path d="M 630,146 C 630,185 625,230 625,260" stroke="#14B8A6" strokeWidth="1.2" fill="none" opacity={edgeOpacity('content-ops', 'cta-meta-tags')} />

    {/* Edges: Commerce Intel → bridges (purple, dashed) */}
    <path d="M 310,146 C 310,178 80,178 80,210" stroke="#585CF0" strokeWidth="1" fill="none" opacity={edgeOpacity('commerce-intel', 'cta-enrich')} strokeDasharray="5,3" />
    <path d="M 320,146 C 320,178 230,178 230,210" stroke="#585CF0" strokeWidth="1" fill="none" opacity={edgeOpacity('commerce-intel', 'cta-rewrite')} strokeDasharray="5,3" />
    <path d="M 340,146 C 340,185 80,235 80,260" stroke="#585CF0" strokeWidth="1" fill="none" opacity={edgeOpacity('commerce-intel', 'cta-create-coll')} strokeDasharray="5,3" />
    <path d="M 350,146 C 350,185 230,235 230,260" stroke="#585CF0" strokeWidth="1" fill="none" opacity={edgeOpacity('commerce-intel', 'cta-add-coll')} strokeDasharray="5,3" />
    <path d="M 440,146 C 440,178 555,178 555,210" stroke="#585CF0" strokeWidth="1" fill="none" opacity={edgeOpacity('commerce-intel', 'cta-blog')} strokeDasharray="5,3" />
    <path d="M 450,146 C 450,178 695,178 695,210" stroke="#585CF0" strokeWidth="1" fill="none" opacity={edgeOpacity('commerce-intel', 'cta-coll-desc')} strokeDasharray="5,3" />

    {/* Legend */}
    <line x1="310" y1="326" x2="340" y2="326" stroke="#14B8A6" strokeWidth="1.5" opacity="0.6" />
    <text x="345" y="330" fill="#9BAAA6" fontSize="8.5">Owns</text>
    <line x1="395" y1="326" x2="425" y2="326" stroke="#585CF0" strokeWidth="1" opacity="0.5" strokeDasharray="5,3" />
    <text x="430" y="330" fill="#9BAAA6" fontSize="8.5">Bridges</text>
  </svg>
</div>
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/luqman/Desktop/Projects/talkstore-command-center && npm run build`
Expected: Clean build. The System tab shows the header and the funnel diagram SVG with hover interactions.

- [ ] **Step 5: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add src/renderer/views/BirdsEyeView.tsx
git commit -m "feat(birds-eye): add SystemTab with funnel SVG diagram and hover interaction"
```

---

### Task 3: Add CTA Strip and Missing Bridge Callout

**Files:**
- Modify: `src/renderer/views/BirdsEyeView.tsx`

- [ ] **Step 1: Add the CTA strip below the diagram**

Inside `SystemTab`, after the diagram container div, add:
```tsx
{/* CTA Strip */}
<div>
  <div className="flex items-center gap-2 mb-3">
    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
    <div className="text-[10px] font-bold tracking-[0.18em] text-white/45 uppercase">Execute Surface</div>
  </div>
  <div className="grid grid-cols-7 gap-1.5">
    {SYSTEM_CTAS.map(cta => (
      <button
        key={cta.id}
        type="button"
        onClick={() => setExpandedCta(expandedCta === cta.id ? null : cta.id)}
        className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
          expandedCta === cta.id
            ? 'border-accent/40 bg-accent/8'
            : 'border-border bg-dark hover:border-border hover:bg-white/[0.02]'
        }`}
      >
        <div className="text-[11px] font-semibold text-white leading-tight">{cta.name}</div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] text-muted">{cta.domain}</span>
          <CostBadge cost={cta.cost} />
        </div>
      </button>
    ))}
  </div>
  {expandedCta && (
    <div className="mt-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5">
      <p className="text-[12px] text-white/80">
        {SYSTEM_CTAS.find(c => c.id === expandedCta)?.oneLiner}
      </p>
    </div>
  )}
</div>
```

- [ ] **Step 2: Add the missing bridge callout**

After the CTA strip div:
```tsx
{/* Missing Bridge Callout */}
<div className="rounded-lg border border-behind/25 bg-behind/5 px-4 py-2.5 flex items-center gap-3">
  <span className="text-[9px] font-bold tracking-[0.15em] text-behind uppercase whitespace-nowrap">Missing Bridge</span>
  <span className="text-[11px] text-muted">
    Commerce Intel has no bridge to <span className="font-mono text-white/70">generateMetaTags</span> — 6 of 7 CTAs reachable
  </span>
</div>
```

- [ ] **Step 3: Clean up unused types and components**

Remove the `ExecuteCta` interface if it is no longer used (replaced by `SYSTEM_CTAS` inline type). Remove `SpecRow` if it is no longer used by any component. Keep `CostBadge` (used in the CTA strip).

Check: grep for `ExecuteCta`, `SpecRow`, `BridgeCta` in the file. Delete any that have zero references.

- [ ] **Step 4: Build and verify**

Run: `cd /Users/luqman/Desktop/Projects/talkstore-command-center && npm run build`
Expected: Clean build. Full System tab renders: header, funnel diagram, 7-card CTA strip with click-to-expand, missing bridge callout.

- [ ] **Step 5: Verify line count reduction**

Run: `wc -l src/renderer/views/BirdsEyeView.tsx`
Expected: ~400-550 lines (down from ~1500+)

- [ ] **Step 6: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add src/renderer/views/BirdsEyeView.tsx
git commit -m "feat(birds-eye): add CTA strip and missing bridge callout, complete redesign"
```
