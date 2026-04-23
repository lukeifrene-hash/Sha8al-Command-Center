Execute a prepared task (or batch). Syntax:
- `/build T<id>` — build one specific task
- `/build M<N> <tier>` — sequentially build all prepared tasks of tier in M<N>

Read the workflow doc at `.claude/rules/three-phase-workflow.md` section "Medium tasks" / "Large / architectural tasks" for semantics.

What you do:

1. If `T<id>`: call `mcp__talkstore__get_task_context(task_id)` to read the enriched context.
   If `M<N> <tier>`: iterate prepared tasks in dependency order. By default, run same-wave tasks in parallel via Agent subagents when `check_file_collisions` says they are safe to parallelize; otherwise serialize them.
2. For each task:
   a. If `builder_prompt` is present on the task, open that markdown file and use it as the canonical build brief.
      If `builder_prompt` is absent, fall back to the enriched tracker prompt.
   b. Call `mcp__talkstore__start_task(task_id)` to flip it to `in_progress`
   c. Write the code, run `npm run build && npm run typecheck && npm run lint`
   d. Verify the acceptance commands from the prompt pass
   e. Call `mcp__talkstore__complete_task({task_id, summary})` to move to review
   f. Spawn the `auditor` subagent via the Agent tool. It runs the 12-point checklist and calls `submit_audit`.
   g. The MCP server auto-approves if the milestone is `foundation` or `product_engines` AND all 12 checks pass. Otherwise the task stays in `review` with the audit report attached for operator.
3. If any task fails its build or audit, stop and report to the operator. Don't continue the batch.

Do NOT skip the auditor step. Do NOT call `approve_task` directly — the MCP handles it.

The long-term workflow is:
- tracker = task metadata, dependencies, status, and summary context
- `builder_prompt` markdown file under `docs/prompts/M<N>/` = canonical builder-facing implementation brief

When the batch completes, summarize: tasks built, auto-approved count, tasks in review awaiting operator.
