## Task Workflow (MCP)

You have access to the Talkstore Command Center MCP server. Use it to track task status throughout the lifecycle.

### Agent Dispatch

The orchestrator MUST dispatch sub-agents via the Agent tool at specific lifecycle points. These agents are defined in `.claude/agents/` and report their activity to the MCP tracker.

**Prepare-phase agents** (dispatched during "prepare task X"):
1. **Explorer** (`subagent_type: "explorer"`) — investigates codebase, finds relevant files and patterns
2. **Researcher** (`subagent_type: "researcher"`) — looks up external docs, best practices, gotchas

**Post-build** (after the builder finishes, before calling `complete_task`):
1. **Post-Build Auditor** (`subagent_type: "post-build-auditor"`) — reviews code quality, security, and compliance in a single pass. Combines the former reviewer, security, validator, and compliance agents.
2. **Diagnostic Agent** (`subagent_type: "diagnostic"`) — sends test prompts to /api/chat in diagnostic mode, evaluates classification + response correctness, compares against baselines. Only dispatched when modified files touch AI pipeline or UI components (see Diagnostic Trigger Paths).

### Diagnostic Trigger Paths

The diagnostic agent is dispatched post-build when `git diff --name-only` includes any of these paths:

**Backend diagnostics:**
- `app/routes/api.chat.tsx`
- `app/lib/ai/**`
- `app/lib/shopify/**`
- `app/lib/db/conversations.ts`

**Visual diagnostics (additional):**
- `app/components/**`
- `app/routes/app.*.tsx`

### Status Rules

**When the operator says "prepare task X" (may include additional context):**
- The operator may provide extra context, preferences, or requirements alongside the prepare command (e.g., "prepare task 002 — I want a dark theme with animated hero section"). Treat this as high-priority input that shapes the entire preparation.
- Call `get_task_context(task_id)` to read the task
- Dispatch the **Explorer agent** via the Agent tool: give it the task_id, ask it to investigate the codebase and return findings. The explorer MUST call `log_action` with `agent_id: "explorer"` before returning.
- Dispatch the **Researcher agent** via the Agent tool: give it the task_id and a **compressed brief** of the explorer's findings (relevant files, patterns found, gaps identified — max 500 tokens, not the raw output). The researcher MUST call `log_action` with `agent_id: "researcher"` before returning.
- Ask the operator clarifying questions if the task has ambiguity or design choices — but skip questions already answered by the operator's initial context
- Incorporate the operator's context, explorer findings, and researcher findings into the task prompt file
- Write enrichment back to the tracker via `enrich_task`
- Do NOT call `start_task` — the task stays in Todo

**When the operator says "start task X":**
- Call `start_task(task_id)` — task moves to In Progress
- Call `get_task_context(task_id)` to get the enriched context
- Do the implementation work (the orchestrator acts as the builder)
- After implementation is complete, run the **post-build sequence** before calling `complete_task`:
  1. Run `npm run build && npm run typecheck && npm run lint` directly (no agent needed — these are deterministic commands)
  2. If the build/typecheck/lint fails, fix the errors yourself and re-run until clean
  3. Dispatch **Post-Build Auditor** via Agent tool — give it the task_id AND a list of modified files (`git diff --name-only`), wait for result
  4. If the auditor returned "FIXED", re-run `npm run build && npm run typecheck && npm run lint` to confirm the build still passes
  5. If the auditor returned "FAIL" that it could not resolve, do NOT call `complete_task` — report the failure to the operator
  6. **Check `git diff --name-only` against diagnostic trigger paths** (see "Diagnostic Trigger Paths" section above)
  7. If any trigger path matches: dispatch **Diagnostic Agent** (`subagent_type: "diagnostic"`) via Agent tool — give it the task_id and the list of modified files. Wait for result.
  8. If the diagnostic agent returned "FAIL", do NOT call `complete_task` — report the diagnostic failures to the operator
- Only after the auditor AND diagnostic agent (if triggered) pass, call `complete_task(task_id, summary)` — task moves to Review

**When the operator gives feedback on a task in Review:**
- DEFAULT BEHAVIOR: If the feedback involves ANY code changes, refactoring, fixes, additions, or modifications → IMMEDIATELY call `reject_task(task_id, feedback)` FIRST to move back to In Progress, THEN do the work, THEN call `complete_task` to resubmit to Review. This is the most common case.
- Examples of actionable feedback that MUST trigger `reject_task`: "refactor this", "change X", "fix Y", "add Z", "make it do X", "update the styling", "move this to", "use X instead", "remove Y", "clean up Z"
- The ONLY exception: purely conversational feedback that requires NO code changes (questions, research requests, "what do you think about...", "explain why you...") → answer the question, keep the task in Review. Do NOT call `reject_task`.
- When in doubt, call `reject_task`. It is always better to move back to In Progress unnecessarily than to make code changes while the task is stuck in Review.

**When the operator says "complete task X":**
- Call `approve_task(task_id)` — task moves to Done
- This is the ONLY way a task reaches Done. Never call `approve_task` unless the operator explicitly says the task is complete/done/approved.

### General Rules
- Always call `start_task` before doing implementation work. Never write code for a task that's still in Todo.
- Always call `complete_task` after finishing implementation work. Never leave a task in In Progress when the work is done.
- Use `log_action` to record significant events during work (files created, tests passed, architecture decisions).
- Use `block_task` if you hit a blocker you cannot resolve. Explain the blocker clearly.
- If a task has revision history (from prior `reject_task` calls), address ALL prior feedback before resubmitting.

### Debug & Review Milestone Tasks

Tasks in the `debug_review` milestone are pushed from the Review tab's Fixes section. They follow a streamlined workflow — NO explorer, NO researcher, NO prompt file. The orchestrator investigates and builds inline.

**Lifecycle:** `todo` → `in_progress` → `review` → `done`

**When the operator says "start task X" (debug_review):**

1. Call `start_task(task_id)` — task moves to In Progress
2. Call `get_task_context(task_id)` — read the fix label, notes, severity, source session
3. **Inline investigation** (no sub-agents):
   - Grep/read 2-3 relevant files based on keywords in the fix label
   - Identify root cause and files to modify
4. **Enrich the task notes** via `enrich_task` — append to the existing notes:
   - `## Root Cause` — 2-3 sentences on what's wrong and why
   - `## Files to Modify` — explicit file paths
   - `## Fix Approach` — 1-2 sentences on what to change
5. **Implement the fix**
6. Run `npm run build && npm run typecheck && npm run lint`
7. **Diagnostic verification** — check if the fix touches diagnostic trigger paths:
   - If yes: dispatch the **Diagnostic Agent** (`subagent_type: "diagnostic"`) with the task_id and modified files. The agent crafts targeted prompts, sends them through the diagnostic endpoint, and returns a pass/fail verdict with details.
   - If no (build/type/lint fixes, or UI-only changes not testable via API): confirm build passes. For visual UI changes, note what the operator should check (page, element, expected vs previous behavior).
   - Record the diagnostic results in the task notes.
8. Call `complete_task(task_id, summary)` — task moves to Review

**Operator review:**
The operator reviews the agent's self-verification results in the task notes. For API-verifiable fixes, the agent has already confirmed the fix works — the operator spot-checks if desired. For UI/visual fixes, the operator verifies in the browser. If verification fails → `reject_task` with feedback, task returns to In Progress.
