Run the prepare phase for a milestone (batch) or a single task. Syntax:
- `/prepare M<N> <tier>` — batch prepare all tasks of tier in M<N> (tier is typically `medium` or `large`)
- `/prepare M<N> all` — prepare all non-small tasks in M<N>; medium tasks use batched prepare semantics, large/architectural tasks use deep per-task prepare semantics
- `/prepare T<id>` — prepare one task (usually used for large/architectural)

Read the workflow doc at `.claude/rules/three-phase-workflow.md` section "Medium tasks" and "Large / architectural tasks" for the exact semantics.

What you do:

1. If `M<N> <tier>`: call `mcp__talkstore__bulk_prepare({milestone_id, tier})` to get the batch of tasks needing prepare.
   If `M<N> all`: call `mcp__talkstore__bulk_prepare({milestone_id})` with no tier filter so MCP returns all non-small tasks needing prepare.
   If `T<id>`: call `mcp__talkstore__get_task_context(task_id)` for the single task.
2. If the scope came from `M<N> all`, split the returned tasks by complexity:
   - `medium` tasks keep the normal batched-prepare behavior
   - `large` / `architectural` tasks keep the deep per-task behavior; `all` is a convenience wrapper, not a flattening of semantics
3. For each task in scope, spawn **Explorer + Researcher subagents in parallel** via the Agent tool:
   - Explorer reads 1-3 relevant files to learn the pattern for `medium` tasks
   - Explorer reads the broader related module for `large` / `architectural` tasks
   - Researcher looks up external docs (library APIs, schema specs, best practices), with deeper scope on `large` / `architectural` tasks
4. Write a canonical builder prompt markdown file at `docs/prompts/M<N>/<task_id>.md` for each prepared task (for example `docs/prompts/M3/t3.1.md`). This file should contain the original task brief plus Explorer findings, Researcher findings, files to modify, constraints, context files, and reference URLs.
5. Call `mcp__talkstore__enrich_task(...)` to:
   - set `builder_prompt` to that markdown file path
   - update `context_files`, `reference_docs`, `constraints`, and any refined acceptance criteria
   - keep the tracker prompt as the concise task brief instead of the primary builder-facing spec
6. Rate-limit to ~5 parallel pairs at a time for `medium` tasks. For `large` / `architectural` tasks, prefer serial or very low concurrency (1-2 pairs) so the deeper exploration stays high-signal.
7. If `M<N> all` includes any `large` / `architectural` tasks and a milestone brief would materially help, draft or refresh that brief once before finalizing those deep-prep prompts.
8. Does NOT execute code. Pure context enrichment.

When done, tell the operator how many tasks were prepared by tier and suggest the next build command:
- If only `medium` tasks were prepared: `/build M<N> medium`
- If `all` was used: `/build M<N> medium` first, then `/build T<id>` (or the matching tier command) for the prepared `large` / `architectural` tasks

Default tier if operator omits it: `medium`.
