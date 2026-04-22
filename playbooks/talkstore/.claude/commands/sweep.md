Execute the sweep workflow for a milestone + tier. Syntax: `/sweep M<N> <tier>` (tier is `small` / `medium` / `large` / `architectural`).

Read the workflow doc at `.claude/rules/three-phase-workflow.md` section "Per-tier flow" for the exact semantics.

Summary of what you do:

1. Call `mcp__talkstore__compute_waves({milestone_id, tier})` to see the wave map.
2. For each wave that has unblocked tasks of the requested tier:
   a. Call `mcp__talkstore__check_file_collisions({task_ids})` to confirm parallel safety
   b. If collisions: serialize colliding tasks, parallelize the rest
   c. For each task in the wave (parallel via Agent tool for small tasks; sequential for medium/large):
      - `mcp__talkstore__claim_next_task({milestone_id, tier})` to atomically grab it
      - Read the task's prompt block (small: enough context; medium/large: include any prepared enrichment)
      - Execute (write code, run commands, verify acceptance)
      - `mcp__talkstore__complete_task({task_id, summary})` to move it to review
      - For non-small tasks, spawn the `auditor` subagent to run the 12-point check
3. When a wave's tasks all hit review/done and auto-unblock fires, loop back to step 1 to grab the next wave.
4. Stop when no tasks of the requested tier are unblocked (typical stop: the next available task is a different tier).

Respect dependencies. Never execute a task whose `depends_on` has unfinished entries.

Default tier if operator omits it: `small`.

The per-task auditor handles auto-approval on backend lanes (`foundation`, `product_engines`). For small tasks there's no auditor — their acceptance commands are the audit.

When you stop, tell the operator: how many tasks were executed, what's blocking further sweep, and what command they should run next (typically `/prepare M<N> medium`).
