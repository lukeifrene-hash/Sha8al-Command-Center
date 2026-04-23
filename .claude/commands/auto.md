Autonomous multi-wave execution for a milestone. Keeps walking the dependency graph, executing unblocked tasks wave-by-wave, until a natural stop is hit. Composes `sweep` + `build` without requiring the operator to re-run them between waves.

Syntax:
- `/auto M<N>` — run until natural stop
- `/auto M<N> --max-tasks=N` — cap at N tasks executed, then stop (safety net)
- `/auto M<N> --skip-large` — skip large/architectural tasks UNLESS they block downstream unblocked work (default: include)
- `/auto M<N> --dry-run` — print what would happen without executing

Read the workflow doc at `.claude/rules/three-phase-workflow.md` for underlying semantics. This command does not change the per-task or auditor rules — it only removes the need to re-type `/sweep` and `/build` between waves.

## Loop

Repeat until a stop condition triggers:

1. Call `mcp__talkstore__get_next_actionable_tasks({milestone_id})` — all unblocked tasks, any tier.
2. If empty → STOP (milestone complete OR fully blocked on pair/human tasks). Report to operator.
3. Check stop conditions BEFORE executing (details below).
4. Call `mcp__talkstore__check_file_collisions({task_ids})` across the wave's tasks to confirm parallel safety.
5. Execute each unblocked task by tier:
   - **Small tasks** → follow `.claude/commands/sweep.md`. Small tasks skip the auditor; their acceptance commands ARE the audit.
   - **Medium tasks** → follow `.claude/commands/build.md`. Must already be prepared (`prepared: true`). If not prepared, STOP and tell operator to run `/prepare M<N> medium` first.
   - **Large / architectural tasks** → follow `.claude/commands/build.md`. Same prepare-first rule. If `--skip-large` is set, skip unless the large task is a dependency of an otherwise-unblocked small/medium task (check via `depends_on` fields).
   - Default execution strategy: if two or more same-wave tasks of the same tier have no file collisions and no dependency edge between them, spawn Agent subagents and run them in parallel. Serialize only the colliding or dependency-linked tasks.
6. For each task executed, the MCP's auto-approval rule governs `review → done` transitions (see workflow doc). Don't call `approve_task` directly.
7. After all tasks in the wave complete, loop back to step 1. Newly unblocked tasks show up automatically because `autoUnblockDependents` fires on each approval.

## Stop conditions (natural checkpoints — NOT failures)

The loop halts immediately and reports to the operator when any of these fire:

1. **No unblocked tasks remain** — milestone done OR stuck on pair/human tasks. Report which.
2. **Auditor returned fail** on any task — the task stays in `review` with the audit report attached. Don't continue. Tell operator: task id, which of the 12 checks failed, short reason.
3. **Task landed in `review` without auto-approval** — this happens on `merchant_facing` / `ship_and_operate` lane tasks even when audits pass (operator eyeball required per workflow doc). Stop and tell the operator which task to review.
4. **Next unblocked task has `execution_mode` = `pair` or `human`** — operator has to do something external (paste a key, run OAuth install, manual data entry). Stop and report what the operator needs to do.
5. **Medium/large task is unblocked but not prepared** — STOP and suggest `/prepare M<N> medium` (or the matching tier).
6. **`--max-tasks=N` reached** — safety-net cap. Report progress.

## Parallelism

Per wave, tasks of the same tier and with no file collisions run in parallel via Agent subagents by default. Between waves, sequential — the next wave must wait for the previous wave's auto-approvals to fire.

## Stop summary format

When you stop, always report:
- Wave count (e.g. "3 waves executed")
- Tasks executed (e.g. "8 tasks: 5 small, 3 medium")
- Current milestone status (e.g. "M2: 12/32 done, 20 still blocked")
- Reason for stopping (one of the 6 conditions above)
- What the operator should do next (re-run `/auto M<N>`, run `/prepare M<N> medium`, fix an audit, handle a pair task, etc.)

## Safety

- Do NOT skip the auditor. The MCP server enforces auto-approval ONLY for backend lanes — `/auto` does not override that.
- Do NOT call `approve_task` directly under any circumstance.
- Do NOT auto-prepare tasks. If a medium/large is unprepared, STOP. Preparation is deliberate — it spawns Explorer + Researcher pairs and is an operator-authorized phase.
- Do respect `depends_on` — never execute a task whose dependencies are incomplete, even when they're mixed across tiers.
- Do prefer Agent subagents over inline execution whenever a wave contains 2+ collision-safe tasks. Inline execution is the fallback for a single ready task or when collisions force serialization.

## Use with `merchant_facing` / `ship_and_operate` milestones

Milestones in the `merchant_facing` (M7, M8) or `ship_and_operate` (M9, M10) lanes will stop quickly — every task lands in `review` for operator eyeball even on clean audits. That's intentional. `/auto` is most valuable for M1–M6 (foundation + product_engines), where clean audits auto-approve and the loop drains the whole milestone in one pass.
