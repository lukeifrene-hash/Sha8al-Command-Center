# Three-Phase Task Workflow — AI Commerce Index Platform

> **Scope:** This workflow overrides the per-task prepare → start → complete cycle for the pivot-era milestones M1–M10. Small tasks skip the prepare phase entirely; medium / large / architectural tasks use a batched prepare and a separate build phase; an automated Auditor gates the `review → done` transition on backend-lane tasks.

---

## The 5 commands

| Command | What it does | When |
|---|---|---|
| **`next`** | Shows tasks unblocked RIGHT NOW, grouped by complexity + execution mode | First thing each session |
| **`sweep M<N> small`** | Auto-executes all unblocked small tasks in milestone M<N>, walks waves, auditor handles approvals | Clear quick wins within a milestone |
| **`prepare M<N> medium`** *or* **`prepare T<id>`** | Spawns Explorer + Researcher sub-agents; enriches task prompts with codebase + external findings; no code written | Before building medium or large/architectural work |
| **`build T<id>`** *or* **`build M<N> medium`** | Executes prepared task(s); auditor runs after each build; auto-approves on pass (backend lanes only) | After prepare, when enrichment is ready |
| **`auto M<N>`** | Autonomous multi-wave execution — composes `sweep` + `build` across waves. Keeps going until a natural stop: audit fail / `pair` or `human` task / merchant-facing review / unprepared medium-or-large / no unblocked work / `--max-tasks=N` cap. | After `prepare` — when you want to drain the milestone without re-typing sweep/build between waves. Best for M1–M6 (backend lanes where audits auto-approve). |

Two operator-managed commands (rare):

| Command | Purpose |
|---|---|
| `approve T<id>` | Manual approval override — moves `review → done` regardless of auditor decision |
| `audit T<id> --cross` | Forces a second-opinion audit using the other model provider |

---

## The Auditor + auto-approval

Every non-small task ends with an automatic audit. The Auditor agent (`@auditor`) runs a 12-point checklist and writes results onto the task via `submit_audit`. The MCP server then decides:

### 12-point checklist

**Structural (4):** build/typecheck/lint pass · every acceptance command passes · diff scope matches `What` field · no `Failure modes` triggered

**Security (3):** no secrets in commits · new deps have no CVEs · no shell/SQL/GraphQL injection

**Compliance (3):** merchant queries scoped with `shopId` · new LLM calls gated by consent · no PII in logs

**Correctness (2):** tests added/updated for new behavior · migrations reversible

### Auto-approval rule

| Milestone lane | All 12 pass | Outcome |
|---|---|---|
| `foundation` (M1, M2) | ✓ | Auto-approved `review → done`; dependents auto-unblock |
| `product_engines` (M3–M6) | ✓ | Auto-approved |
| `merchant_facing` (M7, M8) | ✓ | Stays in `review` — operator eyeball (UI/UX judgment) |
| `ship_and_operate` (M9, M10) | ✓ | Stays in `review` — operator eyeball (launch/legal judgment) |
| ANY | ✗ (1+ fail) | Stays in `review` with audit report attached |

**Small tasks skip the auditor.** Their acceptance commands ARE the audit. Pass = move to `review`; operator approves or the sweep continues.

### Cross-model audits

`audit T<id> --cross` forces the Auditor to run via the other provider (if Claude built, Codex audits, and vice versa). Used for high-risk changes like the Prisma pivot migration (T1.13). Same checklist, different model's eyes.

---

## Per-tier flow

### Small tasks — `sweep` is the single verb

**Agents deployed:** 0 specialists. Orchestrator + parallel worker sub-agents.

**Context source:** the task's prompt block (already stored in the tracker from ROADMAP.md) IS the context. What / Why / Acceptance / Failure-modes spelled out at parse time.

**Flow:**
1. Orchestrator calls `compute_waves(milestone_id, tier=small)`
2. Picks unblocked small tasks in the current wave
3. For each, calls `claim_next_task(tier=small)` atomically — prevents double-pickup across providers
4. Executes the task inline OR spawns parallel sub-agents if 2+ tasks are unblocked in the same wave
5. Each worker reads the prompt block + runs the acceptance commands
6. Marks task `review` via `complete_task`
7. For small tasks, no Auditor runs — acceptance commands already verified the work
8. Operator approves (or auto-approves if backend lane — NB: small-task auto-approve on backend lanes happens directly, without auditor)
9. `autoUnblockDependents` fires — next wave opens
10. Orchestrator loops back to step 1
11. **Stops when next unblocked task in milestone is medium/large** (nothing small to sweep)

**Typical wall clock:** 1–2 minutes per wave of small tasks (parallel).

### Medium tasks — batched prepare, then build

**Agents deployed:** Explorer + Researcher (per task, in parallel during prepare); Auditor (after each build).

**Context source:** task prompt block + Explorer findings (codebase scan) + Researcher findings (external docs).

**Prepare flow** (`prepare M<N> medium`):
1. Orchestrator calls `bulk_prepare(milestone_id, tier=medium)` — returns the batch of unblocked medium tasks
2. For each task, spawns **Explorer + Researcher sub-agents in parallel**
3. Explorer reads 1–3 relevant files (matches existing pattern, identifies dependencies)
4. Researcher looks up external docs (library APIs, schema specs, best practices)
5. Both write findings back to the task's prompt via `enrich_task`
6. Orchestrator throttles to ~5 parallel pairs to stay rate-limit sane
7. When done, every medium task in M<N> has an enriched prompt; tracker flags each as `prepared: true`

**Build flow** (`build M<N> medium` or `build T<id>`):
1. Orchestrator walks prepared medium tasks in wave order (respects dependency graph)
2. For each, calls `claim_next_task(tier=medium)` + reads enriched prompt
3. Writes code, runs `npm run build && npm run typecheck && npm run lint`
4. Marks `complete_task` → status `review`
5. Spawns Auditor → checklist runs → `submit_audit` → auto-approve decision
6. Backend lane + 12/12 pass → task auto-moves to `done`; auto-unblock fires
7. Loop to next task

**Typical wall clock:** 5–15 min prepare per task (parallel); 8–15 min build per task (sequential).

### Large / architectural tasks — per-task prepare and build

**Agents deployed:** Explorer + Researcher (deeper scope than medium); Auditor.

**Context source:** task prompt + milestone brief (if one exists) + Explorer findings (broader codebase map) + Researcher findings (deeper external research).

**Prepare flow** (`prepare T<id>`):
1. Explorer reads the entire related module, not just one file (for T3.16 shared query pool: reads `mentions/detect.ts`, `llm_responses` schema, M2 queue setup)
2. Researcher dives into scheduler libraries, cost amortization algorithms, anything architecturally relevant
3. Both write back via `enrich_task`; findings sections are ~2–3× the size of medium prepare output
4. If the milestone doesn't yet have a `docs/briefs/m<N>-brief.md`, operator may write one manually or orchestrator may draft it

**Build flow** (`build T<id>`):
1. Orchestrator reads enriched prompt + milestone brief
2. Writes code (often significant — new module, schema extension, or cross-cutting infrastructure)
3. Runs build + typecheck + lint + any task-specific tests
4. Spawns Auditor → checklist runs
5. Large tasks often stop at `review` even on pass — operator inspects because the blast radius justifies eyeball review. (Auto-approve still fires on backend lanes per the rule, but operator can use `approve T<id>` to override explicit review gates.)

**Typical wall clock:** 30–60 min per task (prepare + build combined).

---

## Waves vs tiers — the subtlety

**Sweep pulls what's READY.** Small tasks blocked by medium or large deps can't be swept until the blockers clear.

### Example — M1 wave structure after synthesis

```
Wave 1 (1):  t1.1 [S]
Wave 2 (7):  t1.2 [S]  t1.3 [S]  t1.4 [S]  t1.6 [S]  t1.7 [S]  t1.12 [S]  t1.5 [M]
Wave 3 (3):  t1.8 [S]  t1.10 [S]  t1.11 [S]
Wave 4 (1):  t1.15 [M]
Wave 5 (1):  t1.13 [L]   ← the Prisma pivot migration
Wave 6 (1):  t1.9 [M]
Wave 7 (1):  t1.14 [M]
Wave 8 (1):  t1.16 [M]
Wave 9 (2):  t1.17 [S]  t1.18 [S]
```

`sweep M1 small` walks wave 1 (T1.1), then wave 2's small tasks (T1.2, T1.3, T1.4, T1.6, T1.7, T1.12 — parallel; skips T1.5 medium), then wave 3's smalls (T1.8, T1.10, T1.11 — parallel). **Stops at wave 4 because T1.15 is medium.**

At that point, operator runs `prepare M1 medium` + `build M1 medium` to clear the mediums (T1.5, T1.9, T1.14, T1.15, T1.16). Then `prepare T1.13` + `build T1.13` for the one large. When T1.16 (the final medium) completes, `sweep M1 small` resumes and grabs T1.17 + T1.18 (wave 9).

### The rule

**Sweep doesn't magic past blockers.** When sweep stops, switch verbs: `prepare` → `build` for the medium/large work → then `sweep` resumes when those unblock more smalls.

---

## Parallelism rules

### Within a wave

Tasks in the same `parallel_priority` CAN run simultaneously. Before launching, the orchestrator calls `check_file_collisions([task_ids])` to confirm no two tasks touch the same file. If a collision is detected, those colliding tasks serialize; the rest still parallelize.

### Across waves

Sequential, gated by approvals. Wave N+1 cannot start until all of wave N's tasks are `done`.

### Provider-agnostic

Claude and Codex are interchangeable — either can run any command. MCP tools (`claim_next_task`, `compute_waves`, etc.) are atomic across providers, so running Claude in one terminal and Codex in another doesn't risk double-pickup.

---

## Worked example — M1 end-to-end

### Session 1 (≈10 min)

```
You: next
Orchestrator: "1 task unblocked — T1.1 (small, agent)"

You: sweep M1 small
Orchestrator: claims T1.1 → executes branch + archive → marks review
              (small tasks skip auditor — acceptance commands pass)
You: approve T1.1
MCP: fires autoUnblockDependents → wave 2's 6 small tasks unblock

Orchestrator (continues sweep automatically):
  check_file_collisions([t1.2,t1.3,t1.4,t1.6,t1.7,t1.12]) → none
  spawns 6 parallel sub-agents → each claims one task → executes deletions
  all 6 mark review → operator batch-approves → wave 3 opens
  3 more parallel smalls (t1.8, t1.10, t1.11) → review → approved
  next unblocked is t1.15 (medium) → SWEEP STOPS
```

### Session 2 (≈30 min)

```
You: prepare M1 medium
Orchestrator: bulk_prepare(m1, medium) → [t1.5, t1.9, t1.14, t1.15, t1.16]
              spawns Explorer+Researcher pairs in parallel (rate-limited to 5)
              each pair writes findings via enrich_task
              all 5 prepared

You: build M1 medium
Orchestrator: walks mediums in dep order:
  build t1.5 → auditor runs → 12/12 pass → foundation lane → auto-approved → done
  build t1.15 → auditor → pass → auto-approved → done
  build t1.9 → ... (but t1.9 depends on t1.13 large, still blocked)
  build t1.14 → ... (depends on t1.13)
  build t1.16 → ... (depends on earlier tasks)
```

### Session 3 (≈30 min)

```
You: prepare T1.13
Orchestrator: deeper Explorer+Researcher → writes migration strategy into prompt

You: build T1.13
Orchestrator: writes the atomic Prisma migration, applies to Supabase branch
              auditor runs 12/12 checks → all pass → foundation lane
              auto-approved, but for high-risk changes you may want to override:
              
You: audit T1.13 --cross
Orchestrator: runs the auditor on Codex (or other provider)
              second opinion confirms pass → done (already was done, just double-verified)
```

### Session 4 (≈10 min)

```
You: sweep M1 small
Orchestrator: t1.9, t1.14, t1.16 are no longer blocked on t1.13 — actually they're medium, not small
              (these got built in session 2/3)
              t1.17 (small, pair) + t1.18 (small, agent) are now unblocked (wave 9)
              t1.17 is pair — agent verifies backend but asks you to do the OAuth install
              
You: [complete the OAuth install on dev store, tell agent]
Orchestrator: verifies shop.isActive = true in DB → marks review
You: approve T1.17

Orchestrator: t1.18 unblocks → executes commit + tag → marks review
              (small task, no auditor) → operator approves → done

M1 COMPLETE. autoUnblockDependents → M2 tasks become available.
```

---

## When the operator is in the loop

| Scenario | Operator action required |
|---|---|
| Audit passes on backend lane (foundation/product_engines) | **None.** Auto-approved to `done`. |
| Audit passes on frontend/launch lane (merchant_facing/ship_and_operate) | Eyeball review + click approve. |
| Audit fails (any lane) | Review the failure report in task notes; decide to fix + rebuild, accept + approve anyway, or reject. |
| Task has `execution_mode: pair` | Operator performs the embedded external action (paste API key, complete OAuth, provision account). Agent waits. |
| Task has `execution_mode: human` | Operator does the task entirely. Agent doesn't drive. |
| Large/architectural task completes | Task may auto-approve per rule, but operator often reviews the diff as a sanity check. Use `audit T<id> --cross` for extra assurance. |

---

## MCP tool reference

| Tool | Purpose |
|---|---|
| `get_next_actionable_tasks(milestone_id?, tier?, limit?)` | Backs the `next` command |
| `compute_waves(milestone_id, tier?)` | Backs the sweep's wave walking |
| `claim_next_task(tier?, milestone_id?, execution_mode?, agent_id?)` | Atomic task pickup |
| `check_file_collisions(task_ids[])` | Pre-wave safety check |
| `bulk_prepare(milestone_id, tier?)` | Backs the `prepare M<N>` command |
| `enrich_task(task_id, prompt_additions)` | Explorer + Researcher write findings |
| `request_audit(task_id, cross_model?)` | Auditor entry point |
| `submit_audit(task_id, results, auditor_id, summary?)` | Auditor submits results + MCP decides auto-approve |
| `approve_task(task_id)` | Operator manual override |
| `get_task_context(task_id)` | Full task briefing (prompt + deps + milestone context) |

---

## Agents deployed

| Agent ID | Type | Role |
|---|---|---|
| `claude_code` | Orchestrator (human-driven) | Runs the 4 commands; spawns sub-agents |
| `codex` | Orchestrator (human-driven) | Same — either provider works |
| `explorer` | Sub-agent | Codebase investigation during prepare |
| `researcher` | Sub-agent | External docs lookup during prepare |
| `auditor` | Sub-agent | Runs 12-point checklist after build |

Sub-agents register themselves in the tracker on first MCP call — no pre-seeding needed.

---

## End of workflow doc

---

## Milestone-level audit (the 5th command)

After a milestone's subtasks are all `done`, the operator runs **one additional command** to audit the milestone as an integrated subsystem. This is separate from — and stricter than — the per-task auditor.

### Command

| Command | What it does | When |
|---|---|---|
| **`audit M<N>`** | Fans out the Milestone Auditor orchestrator + 4 specialist sub-agents · produces a milestone audit report · auto-ticks submission-checklist items · writes an app state snapshot for the next milestone's audit to reference | After all subtasks in M<N> are `done`. Operator-triggered (manual), not auto-fired. |

### Agents deployed

```
                  milestone-auditor (orchestrator)
                          │
        ┌─────────────────┼─────────────────┬──────────────────┐
        ▼                 ▼                 ▼                  ▼
   Coherence         Security           UX                Compliance
   (integration)    (sec surface)    (UI/UX + a11y)     (PPA + checklist)
```

Each sub-agent returns `{ verdict, findings[], checklist_updates[] }`. The orchestrator synthesizes them into a single milestone verdict:

| Verdict | Meaning |
|---|---|
| `pass` | All 4 sub-audits green, zero critical or major findings |
| `pass_with_notes` | Minor findings only; milestone closed, notes logged for operator |
| `fail` | One or more critical findings OR any sub-agent returned `fail` — operator action recommended (does NOT block downstream work) |

**Failures warn, they don't block.** M<N+1> tasks stay unblocked (the per-task dependency graph governs unblocking, not the milestone audit).

### What the Milestone Auditor reads

1. **Goal state** — relevant manifesto sections for this milestone (hardcoded per-milestone map in `MILESTONE_MANIFESTO_SECTIONS`)
2. **Prior state** — `docs/state/after-m<N-1>-state.md` if it exists (written by the previous milestone's audit)
3. **All per-task audit results** — every subtask's `audit_results` field
4. **Git diff for the milestone** — the combined code change
5. **Submission checklist categories linked to this milestone** — via `category.linked_milestone === m<N>`

### What the Milestone Auditor writes

1. **`docs/audit-reports/m<N>-audit.md`** — full report with per-dimension sections, findings list, verdict, remediation suggestions
2. **`docs/state/after-m<N>-state.md`** — snapshot of current app state (new modules, Prisma tables, routes, scopes, env vars, test coverage) — feeds the NEXT milestone's audit
3. **Submission checklist items auto-ticked** where verifiable; flagged but not ticked where manual confirmation required

### MCP tools used

| Tool | Purpose |
|---|---|
| `start_milestone_audit(m<N>)` | Validates readiness; returns full audit context bundle |
| `submit_milestone_audit(m<N>, verdict, findings, checklist_updates, report_path, state_doc_path)` | Records audit on milestone; applies checklist ticks |
| `get_milestone_audit_context(m<N>)` | Read-only version of the context bundle (no state mutation) |

### Typical timing

- **Backend milestones (M1–M6)**: ~5–10 min (mostly Coherence + Security + Compliance; UX auditor no-ops)
- **Frontend milestones (M7, M8)**: ~20–30 min (Playwright screenshots at 3 widths for every new page + axe-core)
- **Quality/launch milestones (M9, M10)**: ~15–25 min (heavy compliance checklist coverage)

### Operator interaction

1. Type `audit M<N>` when a milestone looks done
2. Wait for the report (5–30 min depending on milestone)
3. Read `docs/audit-reports/m<N>-audit.md` — the one-page summary + findings list
4. For `pass`: nothing to do, milestone is closed
5. For `pass_with_notes`: review the minor findings at your leisure; no blocker
6. For `fail`: address critical findings (usually 1-3 specific tasks to rebuild or additional checklist items to verify); re-run `audit M<N>` when ready

### What the Milestone Auditor does NOT do

- Does NOT re-run the per-task 12-point audit (that already ran at build time)
- Does NOT block downstream milestones
- Does NOT fix findings — pure audit, operator decides how to address
- Does NOT write code

### Relationship to the per-task auditor

| Scope | Per-task Auditor | Milestone Auditor |
|---|---|---|
| Runs | After each non-small task build | Once per milestone, operator-triggered |
| Checklist | 12 deterministic points | Per-dimension + cross-task coherence + checklist progression |
| Sub-agents | None | 4 (Coherence / Security / UX / Compliance) |
| Output | Auto-approve or block `review → done` | `pass` / `pass_with_notes` / `fail` report |
| Blocks | Task's own approval (can be overridden) | Nothing — warns only |
| Specialization | Generic 12-point | Domain-specific via sub-agents |

Both auditors are additive. The per-task auditor keeps backend-lane work flowing; the milestone auditor provides the "step back and look at the whole thing" check before committing to the next milestone.

---

## End of workflow doc
