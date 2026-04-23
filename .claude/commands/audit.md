Run the milestone-level audit. Syntax:
- `/audit M<N>` — run the full milestone auditor (4 specialist sub-agents in parallel)
- `/audit T<id> --cross` — cross-model second-opinion audit on a single task (uses the auditor agent but forces cross-model flag)

Read the workflow doc at `.claude/rules/three-phase-workflow.md` section "Milestone-level audit (the 5th command)" for full semantics.

### For `/audit M<N>`:

Spawn the `milestone-auditor` subagent (via the Agent tool). Pass the milestone id. The subagent will:
1. Call `mcp__talkstore__start_milestone_audit(milestone_id)` — validates all subtasks are `done`, returns context bundle.
2. Fan out 4 parallel sub-agents: `milestone-coherence-auditor`, `milestone-security-auditor`, `milestone-ux-auditor`, `milestone-compliance-auditor`.
3. Synthesize a verdict (`pass` / `pass_with_notes` / `fail`).
4. Write `docs/audit-reports/m<N>-audit.md` and `docs/state/after-m<N>-state.md`.
5. Call `mcp__talkstore__submit_milestone_audit(...)` to persist + auto-tick verifiable submission-checklist items.
6. Return a one-paragraph summary.

If the milestone isn't ready (tasks still in progress or blocked), report the blocker and stop.

### For `/audit T<id> --cross`:

Spawn the `auditor` subagent with `cross_model=true`. Same 12-point checklist, different model's eyes. Use for high-risk tasks (e.g., T1.13 Prisma migration).

### Important

Milestone audit failures WARN but do NOT block downstream work. The operator decides whether to address findings before proceeding with the next milestone.
