# AI Commerce Index Platform (codename: "the Platform" — brand TBD)

Shopify-embedded app that measures how merchants appear in major AI assistants (ChatGPT, Perplexity, Gemini, Claude), identifies why, executes the fixes back to their Shopify catalog with merchant approval, and tracks the revenue lift on both SEO and AI channels.

Pivoted from the prior TalkStore chat product (April 2026). Source of truth for the pivoted product:
- **Brand name:** **LuqDex** (see `docs/brand/LUQDEX-BRAND.md` for identity + palette)
- **Product spec (locked):** `docs/manifesto.md`
- **Roadmap (locked):** `docs/roadmap.md` — 10 milestones, 280 tasks
- **Dead code purge ledger:** `docs/dead-code-purge.md`
- **Codebase audit (pre-purge):** `docs/investigation/*.md`
- **Pivot-era exploratory archive:** `Brainstorming & Pivot/` (concepts, research, decisions log — do not edit)

## Stack (locked)
Shopify React Router 7 template (`@shopify/shopify-app-react-router`), Polaris + App Bridge, TypeScript strict, Anthropic Claude + OpenAI + Gemini + Perplexity, Supabase PostgreSQL, Prisma, Railway, Vitest.

## Scopes (locked, 5 total)
`read_products, write_products, read_content, write_content, read_product_listings`

NEVER request `write_themes`, `read_themes`, `read_orders`, or `read_analytics` — see memory note `feedback_write_themes_hard_stop.md`.

## Architecture
Four functional lanes, ten milestones:

| Lane | Milestones | Scope |
|---|---|---|
| **Foundation** | M1, M2 | Purge + schema migration, multi-LLM + async infrastructure |
| **Product Engines** | M3, M4, M5, M6 | Scoring engine, catalog intelligence, autopilot + guard, attribution |
| **Merchant-facing** | M7, M8 | Admin UI, onboarding, dashboard, UX polish, marketing landing |
| **Ship & Operate** | M9, M10 | Quality/security/compliance, launch, post-launch iteration |

## Critical Rules
- All Shopify APIs are GraphQL. Use wrappers in `app/lib/shopify/*`; never call `admin.graphql` directly.
- Session tokens validated in middleware via `authenticate.admin(request)` — never per-route.
- Every merchant-data Prisma query filters by `shopId`.
- Every write action writes a before-snapshot via `withProductAudit` (see `app/lib/db/audit.ts`).
- Merchant-controlled strings going into LLM prompts must pass through `sanitizeForPrompt()` from `app/lib/shopify/product-cache.ts`.
- All LLM calls use zero-retention / commercial / no-training tiers.
- No SerpAPI / DataForSEO / AI Overviews in V1.
- Listing / marketing copy in factual register only — no "rank #1" / "guaranteed" / "100% accurate".

## Operator commands (6 slash commands + bare-word equivalents)

Full spec at `.claude/rules/three-phase-workflow.md`.

| Slash command | Bare-word shortcut | What it does |
|---|---|---|
| `/next` | `next` | Shows unblocked tasks, grouped by complexity |
| `/sweep M<N> <tier>` | `sweep M<N> <tier>` | Auto-executes all unblocked tasks of that tier in M<N>, walks waves, auditor handles approvals |
| `/prepare M<N> <tier>` *or* `/prepare M<N> all` *or* `/prepare T<id>` | `prepare ...` | Spawns Explorer + Researcher sub-agents, writes `docs/prompts/M<N>/<task_id>.md`, stores that path as `builder_prompt`; `all` prepares every non-small task in the milestone while preserving medium-vs-large prep depth; no code |
| `/build T<id>` *or* `/build M<N> <tier>` | `build ...` | Executes prepared task(s); auditor runs post-build |
| `/auto M<N>` | `auto M<N>` | Autonomous multi-wave execution — composes `sweep` + `build` across waves until a natural stop (audit fail / pair task / merchant-facing review / no unblocked work). Best for backend-lane milestones (M1–M6). |
| `/audit M<N>` | `audit M<N>` | Milestone-level audit (4 specialist sub-agents: Coherence / Security / UX / Compliance) |

**When the operator types a bare word** (e.g., just `next` without the slash), treat it as an implicit invocation of the corresponding slash command. The words `next`, `sweep`, `prepare`, `build`, `auto`, and `audit` as the first token of a user message are operator commands, NOT natural-language prose. Load the corresponding command spec from `.claude/commands/<cmd>.md` and execute.

**Manual overrides (rare):**
- `approve T<id>` — manual `review → done` override
- `audit T<id> --cross` — cross-model second-opinion audit

## Agent roster (in `.claude/agents/`)

- `explorer` — codebase investigation during prepare phase
- `researcher` — external docs lookup during prepare phase
- `auditor` — per-task 12-point checklist (runs after every non-small build)
- `milestone-auditor` — milestone-level orchestrator (runs on `/audit M<N>`)
- `milestone-coherence-auditor`, `milestone-security-auditor`, `milestone-ux-auditor`, `milestone-compliance-auditor` — the 4 specialists the milestone-auditor fans out to

## Dev commands
```
npm run dev              # Dev server (via Shopify CLI)
npm run build            # Prisma generate + react-router build
npm run typecheck        # Type check
npm run lint             # ESLint
npm run test             # Vitest
npx prisma migrate dev   # Migrations
```

## Style
- TypeScript strict mode
- ES modules (`import`/`export`), not CommonJS
- Functional React components with hooks
- Polaris components for all admin UI
- Destructure imports when possible

## Git
- Feature branches only. Never push directly to main.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Tag milestone completions: `m1-complete`, `m2-complete`, etc.

## References
- **Product spec (primary):** `docs/manifesto.md`
- **Roadmap (primary):** `docs/roadmap.md`
- **Brand identity (primary):** `docs/brand/LUQDEX-BRAND.md`
- **Workflow rules:** `.claude/rules/three-phase-workflow.md`
- **Shared repo context:** `docs/shared-context.md` (brand palette, lightweight project snapshot)
- **Codebase investigation (pre-purge):** `docs/investigation/`
- **Milestone briefs (per milestone):** `docs/briefs/m<N>-brief.md` (written during prepare phase)
- **Audit reports (per milestone):** `docs/audit-reports/m<N>-audit.md`
- **App state snapshots (after each milestone):** `docs/state/after-m<N>-state.md`
