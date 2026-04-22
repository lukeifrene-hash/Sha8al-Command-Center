# Bird's Eye Redesign — Unified System View

**Date:** 2026-04-15
**Scope:** Replace the current multi-tab, text-heavy Bird's Eye view with a single unified diagram + minimal CTA strip.

## Problem

The current Bird's Eye view has 5 tabs (Product Ops, Content Ops, Commerce Intel, Conversation, Roadmap), each with dense text cards and per-domain drag-and-drop diagrams. The operator cannot see the whole execute surface at a glance. Switching between tabs to understand domain relationships is friction. The interactive diagrams with custom nodes are unused.

## Design

### Tabs

Two tabs only:

- **System** — the new unified view (default, active on open)
- **Roadmap** — kept as-is, no changes

The 4 domain-specific tabs (Product Ops, Content Ops, Commerce Intel, Conversation) are deleted entirely. All their content is replaced by the unified System view.

### System View Layout

Top to bottom, no scrolling required for the core content:

1. **Header** — title ("Talkstore Execute Surface") + two counter badges: "7 Execute CTAs" and "4 Domains"
2. **Funnel Diagram** — static SVG, 3 tiers, hover interaction
3. **CTA Strip** — 7 minimal cards in a single row
4. **Missing Bridge Callout** — single-line warning bar (conditional, only shown when gaps exist)

### Funnel Diagram

Static SVG rendered in a bordered container. Three tiers flowing top to bottom:

**Tier 1 — Entry Point:**
- Conversation node, centered. Label subtitle: "ENTRY POINT"

**Tier 2 — Domains:**
- Product Ops (left) — subtitle: "4 EXECUTE CTAS"
- Commerce Intel (center) — subtitle: "READ-ONLY / 6 BRIDGES", purple border instead of teal
- Content Ops (right) — subtitle: "3 EXECUTE CTAS"

**Tier 3 — Execute CTAs:**
- Product Ops CTAs (left, 2x2 grid): Enrich Products, Rewrite Description, Create Collection, Add To Collection
- Content Ops CTAs (right, 2+1 layout): Blog Post, Collection Desc, Meta Tags

**Edges:**
- Conversation → all 3 domains: teal curves, low opacity
- Product Ops → its 4 CTAs: teal solid lines
- Content Ops → its 3 CTAs: teal solid lines
- Commerce Intel → 6 bridged CTAs: purple dashed lines (crosses to both Product Ops and Content Ops CTA nodes)

**Legend:** inline at bottom of SVG — solid teal line labeled "Owns", dashed purple line labeled "Bridges"

### Hover Interaction

When the operator hovers a domain node:
- That domain's border brightens
- All edges from that domain increase opacity (become prominent)
- All other edges dim further
- The target CTA nodes that domain connects to get a subtle highlight (brighter border or glow)

When the operator hovers a CTA node:
- That CTA's border brightens
- All edges pointing to that CTA highlight (showing which domains reach it)

No click-to-select, no drag, no custom nodes, no zoom, no localStorage persistence. Pure read-only visualization with hover states.

### CTA Strip

A single row of 7 cards below the diagram. Each card contains:
- **Name** — e.g. "Enrich Products" (11px, white, semibold)
- **Domain** — e.g. "Product Ops" (9px, muted)
- **Cost badge** — "1 task" (8px, purple pill)

Cards are laid out in a `grid-template-columns: repeat(7, 1fr)` grid.

Clicking a CTA card shows a tooltip or inline expansion with one sentence describing what the tool does. This is the only detail available — no tool names, no Shopify write paths, no constraints lists.

One-liners for each CTA:
- **Enrich Products**: "Set metafields across up to 25 products with optional description rewrites."
- **Rewrite Description**: "Rewrite one product's description to structured, factual HTML."
- **Create Collection**: "Create a new manual or smart collection."
- **Add To Collection**: "Add up to 250 products to an existing collection."
- **Blog Post**: "Write a blog post draft with title, body, and tags."
- **Collection Desc**: "Write SEO descriptions for up to 10 collections."
- **Meta Tags**: "Set SEO meta title and description on up to 25 products."

### Missing Bridge Callout

A single-line warning bar below the CTA strip. Tinted amber/orange border. Shows when Commerce Intel cannot bridge to all 7 CTAs.

Current state: "Commerce Intel has no bridge to `generateMetaTags` — 6 of 7 CTAs reachable"

This is hardcoded for now. If all 7 bridges exist, the callout is hidden.

## What Gets Deleted

- `ContentOpsTab` component and `CONTENT_OPS_EXECUTE_CTAS` data
- `ProductOpsTab` component and `PRODUCT_OPS_EXECUTE_CTAS` data
- `CommerceIntelTab` component and `COMMERCE_INTEL_BRIDGES` data
- `ConversationTab` component
- `ContentOpsDiagram`, `ProductOpsDiagram`, `CommerceIntelDiagram`, `ConversationDiagram` components
- `DomainDiagramSection` component (the entire drag-and-drop canvas infrastructure)
- All diagram-related state: `BirdsEyeDiagramStore`, `DomainDiagramState`, `DiagramNode`, `DiagramEdge`
- `DIAGRAM_STORAGE_KEY` localStorage usage
- Helper functions: `cloneDiagram`, `normalizeDiagramState`, `loadDiagramState`, `persistDiagramState`, `collectSubtreeNodeIds`, `nodeCenter`, `clamp` (if only used by diagrams)
- `BridgeCta` interface

## What Gets Kept

- `RoadmapTab` component and its data (`birds-eye-data.json` categories, roadmap, v2_capabilities)
- `SpecRow` and `CostBadge` utility components (CostBadge used in CTA strip)
- `ExecuteCta` interface (repurposed for the one-liner data)
- The `data` import from `birds-eye-data.json`

## What Gets Added

- `SystemTab` component — renders the header, funnel SVG, CTA strip, and callout
- Hover state management via React `useState` for `hoveredNode: string | null`
- SVG rendered inline in JSX with dynamic opacity/color based on `hoveredNode`
- `CTA_ONE_LINERS` constant mapping CTA id to one-sentence description
- Click-to-expand or tooltip for CTA cards (CSS-only tooltip preferred to avoid state complexity)

## File Changes

All changes are in one file: `src/renderer/views/BirdsEyeView.tsx`

This is a net reduction in code. The current file is ~1400 lines. The redesign should land around 400-500 lines — the SVG diagram, hover logic, minimal strip, and RoadmapTab.
