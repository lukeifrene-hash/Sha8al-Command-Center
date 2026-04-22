Run the prepare phase for a milestone (batch) or a single task. Syntax:
- `/prepare M<N> <tier>` — batch prepare all tasks of tier in M<N> (tier is typically `medium` or `large`)
- `/prepare T<id>` — prepare one task (usually used for large/architectural)

Read the workflow doc at `.claude/rules/three-phase-workflow.md` section "Medium tasks" and "Large / architectural tasks" for the exact semantics.

What you do:

1. If `M<N> <tier>`: call `mcp__talkstore__bulk_prepare({milestone_id, tier})` to get the batch of tasks needing prepare.
   If `T<id>`: call `mcp__talkstore__get_task_context(task_id)` for the single task.
2. For each task in scope, spawn **Explorer + Researcher subagents in parallel** via the Agent tool:
   - Explorer reads 1-3 relevant files to learn the pattern (medium) or the entire related module (large)
   - Researcher looks up external docs (library APIs, schema specs, best practices)
3. Both subagents write findings back to the task's prompt via `mcp__talkstore__enrich_task({task_id, prompt_additions})`.
4. Rate-limit to ~5 parallel pairs at a time to stay within LLM rate limits.
5. Does NOT execute code. Pure context enrichment.

When done, tell the operator how many tasks were prepared and suggest `/build M<N> <tier>` as the next step.

Default tier if operator omits it: `medium`.
