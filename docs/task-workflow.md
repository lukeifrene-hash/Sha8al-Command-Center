# Task Workflow — Milestone Command Surface

This document describes the current command surface used to operate Sha8al Command Center. The workflow is milestone-driven, wave-based, and tier-aware. It is not the older task-by-task lifecycle that treated single-task transitions as the primary operator flow.

For the public `generic` profile, task tiers begin with parser-side sizing from `docs/roadmap.md`, then later preparation or dependency-analysis passes can refine the plan.

## Workflow Summary

The operator works through milestones with a small set of verbs:

- `next`
- `sweep M<N> <tier>`
- `prepare M<N> <tier>` or `prepare M<N> all` or `prepare T<id>`
- `build M<N> <tier>` or `build T<id>`
- `auto M<N>`
- `audit M<N>`

Rare overrides:

- `approve T<id>`
- `audit T<id> --cross`

Bare-word inputs such as `next`, `sweep`, `prepare`, `build`, `auto`, and `audit` are treated as the matching command.

## Command Table

| Command | Purpose | When to use it | Core backend behavior |
| --- | --- | --- | --- |
| `next` | Show what is actionable now | First command in a session | Calls `get_next_actionable_tasks`; read-only |
| `sweep M<N> <tier>` | Execute all unblocked tasks in one milestone tier | Usually for ready `small` work | Uses `compute_waves`, `check_file_collisions`, `claim_next_task`, `complete_task`; runs auditor for non-small work |
| `prepare M<N> <tier>` | Enrich a milestone batch before build | Before building `medium` work | Uses `bulk_prepare`, `get_task_context`, `enrich_task`; writes builder prompts |
| `prepare M<N> all` | Enrich every non-small task in one milestone | When you want a single prep pass across `medium`, `large`, and `architectural` work | Uses `bulk_prepare` without a tier filter, then preserves medium-vs-large prep depth per task |
| `prepare T<id>` | Enrich one larger task | Before building a `large` or `architectural` task | Same prepare machinery, scoped to one task |
| `build M<N> <tier>` | Build prepared milestone work | After batch prepare is done | Uses `get_task_context`, `start_task`, `complete_task`, then audit submission |
| `build T<id>` | Build one prepared task | When one prepared task is the right unit of work | Same build path, scoped to one task |
| `auto M<N>` | Run the milestone autonomously across waves | When you want command chaining without retyping | Composes `next`, `sweep`, and `build` semantics until a stop condition |
| `audit M<N>` | Run the milestone-level audit | After milestone execution is complete | Uses `start_milestone_audit`, specialist milestone auditors, `submit_milestone_audit` |
| `approve T<id>` | Manual `review → done` override | Rare explicit approval override | Uses `approve_task` directly |
| `audit T<id> --cross` | Cross-model second-opinion audit | High-risk task verification | Runs task auditor with `cross_model=true` |

## Read-Only Status: `next`

Supported forms:

- `next`
- `next <tier>`
- `next M<N>`

What it does:

- shows unblocked tasks only
- groups work by complexity tier
- includes task id, label, milestone, complexity, execution mode, and wave
- does not start, prepare, or complete anything

Use `next` to decide whether the milestone needs `sweep`, `prepare`, `build`, or `auto`.

## Sweep: `sweep M<N> <tier>`

Use `sweep` to drain one milestone tier wave by wave.

What happens:

1. The command reads the milestone wave map with `compute_waves`.
2. Same-wave tasks are checked with `check_file_collisions`.
3. Collision-safe tasks can run in parallel; colliding or dependency-linked tasks serialize.
4. Each task is claimed atomically with `claim_next_task`.
5. The work is executed.
6. The task is moved to `review` through `complete_task`.
7. For non-small tasks, the task auditor runs next.

Important behavior:

- `small` tasks skip the auditor; their acceptance commands are the audit.
- `sweep` stops when no more tasks of the requested tier are unblocked.
- A common stop condition is that the next actionable work is a different tier and now needs `prepare` or `build`.

## Prepare: `prepare M<N> <tier>` / `prepare M<N> all` / `prepare T<id>`

Use `prepare` to create implementation context before code changes begin.

What happens:

1. The command gathers the target task or milestone batch.
2. Explorer and Researcher run in parallel.
3. Explorer maps the local code patterns and relevant files.
4. Researcher checks external references, APIs, schemas, and constraints.
5. A canonical builder prompt is written to `docs/prompts/M<N>/<task_id>.md`.
6. The task is enriched with:
   - `builder_prompt`
   - `context_files`
   - `reference_docs`
   - `constraints`
   - refined acceptance criteria

Important behavior:

- `prepare` does not implement code.
- Batch prepare is rate-limited and parallelized.
- `prepare T<id>` is the normal path for deeper `large` or `architectural` work.

### `prepare M<N> all`

Use `prepare M<N> all` when you want the entire non-small queue prepared in one pass.

What happens:

1. The command calls `bulk_prepare` without a tier filter.
2. The returned task set is split by complexity.
3. `medium` tasks keep the standard batched-prepare path.
4. `large` and `architectural` tasks keep the deeper per-task prepare path.
5. Every prepared task gets a canonical builder prompt file under `docs/prompts/M<N>/<task_id>.md`.

Important behavior:

- `all` is a convenience wrapper, not a flattening of task semantics.
- `medium` stays batch-oriented and parallel-prep friendly.
- `large` and `architectural` stay deeper and lower-concurrency.
- the output is one fully prepared non-small milestone queue with builder prompts written for every task.

## Build: `build M<N> <tier>` / `build T<id>`

Use `build` to execute prepared work.

What happens:

1. The command loads enriched task context.
2. It uses `builder_prompt` when present.
3. It calls `start_task`.
4. It implements the work.
5. It runs the required build and validation commands.
6. It calls `complete_task` to move the task to `review`.
7. It runs the task auditor for non-small work.

Important behavior:

- `build` must stop on build failure, validation failure, or audit failure.
- `build` does not use manual approval as the normal path.
- Auto-approval is determined by the task’s lane and audit outcome.

## Autonomous Milestone Run: `auto M<N>`

Use `auto` when you want the system to keep pushing the milestone until it naturally has to stop.

What happens:

- reads the current actionable set for the milestone
- executes ready `small` work through sweep semantics
- executes prepared medium and larger work through build semantics
- moves wave by wave until a stop condition is reached

Natural stop conditions:

- no unblocked tasks remain
- the next task is `pair` or `human`
- a medium or larger task is unblocked but not prepared
- a task fails build or audit
- a task lands in `review` without auto-approval because operator eyeballing is required
- an optional task cap is reached

`auto` is best for backend-heavy milestones where successful audits can auto-approve work and unblock the next wave.

## Milestone Audit: `audit M<N>`

Use milestone audit after execution is complete.

What happens:

1. The milestone audit bundle is started with readiness validation.
2. Four specialist auditors run in parallel:
   - coherence
   - security
   - UX
   - compliance
3. Their findings are synthesized into a milestone verdict.
4. The audit report and after-state snapshot are written.
5. The audit result is persisted back through milestone audit submission.

Important behavior:

- milestone audit is not the same as the per-task auditor
- milestone audit failures warn; they do not hard-block downstream work automatically

## Auditor And Auto-Approval

Every non-small task runs the task auditor after build.

The task auditor uses a 12-point checklist covering:

- build, typecheck, lint, and acceptance commands
- failure-mode and diff-scope checks
- secrets and dependency safety
- injection safety
- merchant-data scoping
- consent and logging rules
- tests and reversible migrations

Lane-based outcome:

- `foundation` and `product_engines`: clean audit can auto-approve the task
- `merchant_facing` and `ship_and_operate`: task stays in `review` for operator eyeballing
- any failed audit: task stays in `review` with the audit report attached

## How To Choose The Next Command

Use this decision guide:

| Situation | Next command |
| --- | --- |
| You need to know what is unblocked | `next` |
| Ready `small` tasks exist in the milestone | `sweep M<N> small` |
| `medium` work is next and unprepared | `prepare M<N> medium` |
| You want every non-small task prepared together | `prepare M<N> all` |
| One `large` or `architectural` task is next | `prepare T<id>` |
| Prepared work is waiting to be implemented | `build ...` |
| You want the milestone to keep draining automatically | `auto M<N>` |
| The milestone is complete and needs broader review | `audit M<N>` |

## Manual Overrides

### `approve T<id>`

Manual `review → done` override for a single task. Use rarely.

### `audit T<id> --cross`

Cross-model second-opinion audit for a single task. Use for high-risk changes or when you want an extra verification pass.
