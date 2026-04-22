Show what's actionable right now. Call `mcp__talkstore__get_next_actionable_tasks` with no filters (or with the filters the operator provided as arguments).

**If the operator typed just `/next`:** call it with no arguments. List the unblocked tasks grouped by complexity tier. Include task id, label, milestone, complexity, execution mode, and wave.

**If the operator typed `/next <tier>` (e.g., `/next small`):** pass `tier` to the tool.

**If the operator typed `/next M<N>` (e.g., `/next M1`):** pass `milestone_id` to the tool (expand the shortened form to the full id like `m1_purge_and_foundation_reset`).

**Output format:** a compact table per tier. Show at most 20 rows. Include the count by tier at the top. Reference the 4-command workflow at `.claude/rules/three-phase-workflow.md` if the operator asks what to run next.

Do NOT execute any task. This is a read-only status command.
