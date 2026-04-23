# Codex Entrypoint

This file is the Codex-side entrypoint. Shared repo + product conventions live in `CLAUDE.md`. Codex and Claude Code both follow the **same operator command set** — everything below mirrors `CLAUDE.md`'s "Operator commands" section so that whether the operator types `next` into a Claude or Codex session, the behavior is identical.

## Read first (in order)

1. `CLAUDE.md` — product summary, locked stack, scopes, critical rules, operator commands (this file is a Codex-flavored summary of it).
2. `.claude/rules/three-phase-workflow.md` — the full spec of the 5-command lifecycle (`next` / `sweep` / `prepare` / `build` / `audit`). This doc is provider-agnostic; it applies to Codex identically.
3. `docs/shared-context.md` — brand palette + lightweight project snapshot.

The product spec source of truth is `docs/manifesto.md`. The roadmap is `docs/roadmap.md`. Brand identity is `docs/brand/LUQDEX-BRAND.md`.

---

## Operator commands (5 primary + 2 overrides) — BARE-WORD FIRST TOKEN

When the operator's message starts with one of these words, treat it as a command invocation, NOT natural-language prose. This is how Claude Code discovers `/next`, `/sweep`, etc. via its slash-command registry; Codex doesn't have a slash registry — it discovers them by reading this table and routing accordingly.

| First-token of operator message | What to do | Full spec |
|---|---|---|
| `next` (with optional tier or milestone args) | Call `mcp__talkstore__get_next_actionable_tasks`. Format the result as a table grouped by tier. READ-ONLY — do not execute any task. | `.claude/commands/next.md` |
| `sweep M<N> <tier>` (tier defaults to `small` if omitted) | Run the sweep loop: `compute_waves` → `check_file_collisions` → `claim_next_task` → execute → `complete_task`. For non-small tasks, spawn the `auditor` sub-agent after each build. Loop until no tasks of the requested tier are unblocked. | `.claude/commands/sweep.md` |
| `prepare M<N> <tier>` **or** `prepare M<N> all` **or** `prepare T<id>` | Call `bulk_prepare` (batch) or `get_task_context` (single). For `all`, prepare every non-small task in the milestone while preserving medium-vs-large prep depth; write `docs/prompts/M<N>/<task_id>.md` and store that path as `builder_prompt`. Does NOT execute code. | `.claude/commands/prepare.md` |
| `build T<id>` **or** `build M<N> <tier>` | Read the enriched prompt, flip to `in_progress`, write the code, run `npm run build && npm run typecheck && npm run lint`, mark `review`, spawn the `auditor` sub-agent. MCP auto-approves on backend-lane 12/12 pass. | `.claude/commands/build.md` |
| `audit M<N>` | Spawn the `milestone-auditor` sub-agent. It fans out to Coherence / Security / UX / Compliance specialists in parallel, synthesizes a verdict, writes report + state doc, calls `submit_milestone_audit`. | `.claude/commands/audit.md` |

**Override commands (rare):**
- `approve T<id>` — manual `review → done` override for a single task
- `audit T<id> --cross` — cross-model audit on a single task (Codex auditing Claude's work, or vice versa)

**Slash-prefix variants:** the operator may type `/next`, `/sweep`, etc. with a leading slash (that's Claude Code's convention). Treat the slash as a no-op prefix — `/next` and `next` mean the same thing.

If the first token isn't one of these, treat the message as ordinary natural-language input and respond normally. Do NOT try to force ambiguous inputs into these commands.

---

## MCP tools available (via Talkstore MCP server)

All tools are configured in `.codex/config.toml` with `approval_mode = "approve"`. The full set (27 tools) covers read, write, and the 3-phase lifecycle. Key ones by command:

- `next` → `get_next_actionable_tasks`
- `sweep` → `compute_waves`, `claim_next_task`, `check_file_collisions`, `complete_task`, `log_action`
- `prepare` → `bulk_prepare`, `get_task_context`, `enrich_task`, `log_action`
- `build` → `get_task_context`, `start_task`, `complete_task`, `request_audit`, `submit_audit`, `log_action`
- `audit M<N>` → `start_milestone_audit`, `submit_milestone_audit`, `get_milestone_audit_context`, `toggle_checklist_item`, `log_action`

Use `./talkstore` only as a shell fallback when MCP is unavailable. Never edit `talkstore-tracker.json` directly.

---

## Agent identity + logging

Codex sessions should log actions with `agent_id: "codex"` (the orchestrator). Sub-agents spawned by Codex register themselves on first MCP call with their canonical IDs:
- `explorer`, `researcher`, `auditor` — per-task sub-agents
- `milestone-auditor`, `milestone-coherence-auditor`, `milestone-security-auditor`, `milestone-ux-auditor`, `milestone-compliance-auditor` — milestone-audit subsystem

These IDs are shared with Claude Code's agent hierarchy — the Agent Hub in the Electron command center shows both providers' activity under the same roster. Use the exact action names for dashboard compatibility: `exploration_complete`, `research_complete`, `audit_complete`, `task_started`, `task_submitted_for_review`.

---

## Critical Rules (identical to CLAUDE.md)

These are hard stops for both providers:

- All Shopify APIs are GraphQL; use wrappers in `app/lib/shopify/*`; never call `admin.graphql` directly.
- Session tokens validated in middleware via `authenticate.admin(request)` — never per-route.
- Every merchant-data Prisma query filters by `shopId`.
- Every write action writes a before-snapshot via `withProductAudit` (see `app/lib/db/audit.ts`).
- Merchant-controlled strings going into LLM prompts must pass through `sanitizeForPrompt()` from `app/lib/shopify/product-cache.ts`.
- All LLM calls use zero-retention / commercial / no-training tiers.
- Scopes locked at 5: `read_products, write_products, read_content, write_content, read_product_listings`. Never request `write_themes`, `read_themes`, `read_orders`, or `read_analytics`.
- No SerpAPI / DataForSEO / AI Overviews in V1.
- Listing / marketing copy in factual register only — no "rank #1" / "guaranteed" / "100% accurate".

---

## Working rules

- Feature branches only. Never land work on `main`. Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Treat the working tree as potentially dirty; isolate only the files changed for the current task before handing work to the auditor.
- Pass compressed briefs and explicit file lists to spawned sub-agents, not raw transcripts.
- Tag milestone completions: `m1-complete`, `m2-complete`, etc.

---

## Tool budget per sub-agent

- **Explorer + Builder**: `get_task_context(task_id)` — full briefing
- **Researcher + Auditor**: `get_task_summary(task_id)` — slim (saves tokens)
- **Researcher + Auditor**: may call `get_checklist_status()`
- **Only the Auditor** (per-task + milestone-compliance) toggles checklist items
- **Milestone-auditor**: calls `start_milestone_audit` + `submit_milestone_audit`; spawns the 4 specialists in parallel
