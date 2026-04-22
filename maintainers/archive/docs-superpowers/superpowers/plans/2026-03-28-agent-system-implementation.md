# Agent System & Prompt Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 8 agent profiles, a per-task prompt file system, an `enrich_task` MCP tool, `get_task_context` prompt file injection, and a filtered History tab — so the prepare/start/review/complete lifecycle works end-to-end with rich prompts.

**Architecture:** Agent profiles live as markdown files in `docs/agents/` in the Talkstore project. Per-task prompt files are generated during the prepare phase to `docs/prompts/`. The MCP server gets an `enrich_task` tool to write enrichment fields (including `builder_prompt` path) and `get_task_context` is updated to read and inject the prompt file. The History tab in the Electron app is filtered to only show review cycle events.

**Tech Stack:** TypeScript, MCP SDK, React, Tailwind CSS

---

## File Map

### Talkstore Project (`/Users/luqman/Desktop/Projects/talkstore/`)

**Create:**
- `docs/agents/talkstore-pm.md` — Project manager umbrella profile
- `docs/agents/explorer.md` — Codebase investigation profile
- `docs/agents/researcher.md` — External research + plugin evaluation profile
- `docs/agents/builder.md` — Implementation profile
- `docs/agents/reviewer.md` — Code quality review profile
- `docs/agents/security.md` — Security scanning profile
- `docs/agents/validator.md` — Test/typecheck/lint profile
- `docs/agents/compliance.md` — Submission checklist audit profile
- `docs/prompts/.gitkeep` — Empty dir for per-task prompt files

### MCP Server (`mcp-server/src/`)

**Modify:**
- `mcp-server/src/tracker.ts` — Add `builder_prompt` field to Subtask interface
- `mcp-server/src/tools.ts` — Add `enrich_task` tool definition + handler
- `mcp-server/src/cli.ts` — Add `enrich-task` CLI command
- `mcp-server/src/context.ts` — Update `buildTaskContext` to inject prompt file contents

### Electron App (`src/`)

**Modify:**
- `src/renderer/components/taskboard/TaskDetailModal.tsx` — Filter History tab to review cycle events only

---

### Task 1: Add `builder_prompt` Field to Tracker Types

**Files:**
- Modify: `mcp-server/src/tracker.ts:12-33`

- [ ] **Step 1: Add `builder_prompt` to the Subtask interface**

In `mcp-server/src/tracker.ts`, add the field after `pipeline`:

```typescript
export interface Subtask {
  id: string
  label: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
  done: boolean
  assignee: string | null
  blocked_by: string | null
  blocked_reason: string | null
  completed_at: string | null
  completed_by: string | null
  priority: string
  notes: string | null
  prompt: string | null
  context_files: string[]
  reference_docs: string[]
  acceptance_criteria: string[]
  constraints: string[]
  agent_target: 'explorer' | 'planner' | 'builder' | null
  execution_mode: 'human' | 'agent' | 'pair'
  last_run_id: string | null
  pipeline: Pipeline | null
  builder_prompt: string | null
}
```

- [ ] **Step 2: Verify build**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: PASS (new optional field doesn't break existing code)

- [ ] **Step 3: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add mcp-server/src/tracker.ts
git commit -m "feat: add builder_prompt field to Subtask type

Stores the relative path to the per-task prompt file generated
during the prepare phase."
```

---

### Task 2: Add `enrich_task` MCP Tool

**Files:**
- Modify: `mcp-server/src/tools.ts`
- Modify: `mcp-server/src/cli.ts`

- [ ] **Step 1: Add tool definition to TOOL_DEFINITIONS in tools.ts**

Add after the `update_task` definition (search for `name: 'update_task'` and add after its closing `},`):

```typescript
  {
    name: 'enrich_task',
    description:
      'Write enrichment data to a task after the prepare phase. Updates prompt, acceptance criteria, ' +
      'constraints, context files, reference docs, and/or the builder_prompt file path. ' +
      'Only provided fields are updated — omitted fields stay as-is.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to enrich',
        },
        prompt: {
          type: 'string',
          description: 'Task prompt/description override (optional)',
        },
        builder_prompt: {
          type: 'string',
          description: 'Relative path to the per-task prompt file, e.g. "docs/prompts/task-009-scaffold-shopify-remix.md" (optional)',
        },
        acceptance_criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Acceptance criteria list (optional, replaces existing)',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Constraints list (optional, replaces existing)',
        },
        context_files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Context file paths (optional, replaces existing)',
        },
        reference_docs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Reference doc URLs or paths (optional, replaces existing)',
        },
      },
      required: ['task_id'],
    },
  },
```

- [ ] **Step 2: Add case to handleTool switch**

Add after the `case 'update_task':` block:

```typescript
      case 'enrich_task':
        return handleEnrichTask(
          args.task_id as string,
          args.prompt as string | undefined,
          args.builder_prompt as string | undefined,
          args.acceptance_criteria as string[] | undefined,
          args.constraints as string[] | undefined,
          args.context_files as string[] | undefined,
          args.reference_docs as string[] | undefined
        )
```

- [ ] **Step 3: Add handler function**

Add after the `handleUpdateTask` function:

```typescript
function handleEnrichTask(
  taskId: string,
  prompt?: string,
  builderPrompt?: string,
  acceptanceCriteria?: string[],
  constraints?: string[],
  contextFiles?: string[],
  referenceDocs?: string[]
) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const task = match.milestone.subtasks.find((s) => s.id === taskId)!
  const changes: string[] = []

  if (prompt !== undefined) {
    task.prompt = prompt || null
    changes.push('prompt')
  }
  if (builderPrompt !== undefined) {
    task.builder_prompt = builderPrompt || null
    changes.push(`builder_prompt → ${builderPrompt}`)
  }
  if (acceptanceCriteria !== undefined) {
    task.acceptance_criteria = acceptanceCriteria
    changes.push(`acceptance_criteria (${acceptanceCriteria.length})`)
  }
  if (constraints !== undefined) {
    task.constraints = constraints
    changes.push(`constraints (${constraints.length})`)
  }
  if (contextFiles !== undefined) {
    task.context_files = contextFiles
    changes.push(`context_files (${contextFiles.length})`)
  }
  if (referenceDocs !== undefined) {
    task.reference_docs = referenceDocs
    changes.push(`reference_docs (${referenceDocs.length})`)
  }

  if (changes.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No fields provided to update.' }], isError: true }
  }

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'task_enriched',
    target_type: 'subtask',
    target_id: taskId,
    description: `Enriched: ${changes.join(', ')}`,
    timestamp: new Date().toISOString(),
    tags: ['enrichment', 'prepare', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" enriched:\n${changes.map((c) => `  - ${c}`).join('\n')}`,
    }],
  }
}
```

- [ ] **Step 4: Add CLI case in cli.ts**

Add to the switch in `cli.ts` after `update-task`:

```typescript
    case 'enrich-task':
      toolName = 'enrich_task'
      toolArgs = {
        task_id: positional[0],
        ...(flags.prompt && { prompt: flags.prompt }),
        ...(flags['builder-prompt'] && { builder_prompt: flags['builder-prompt'] }),
        ...(flags.criteria && { acceptance_criteria: flags.criteria.split('|') }),
        ...(flags.constraints && { constraints: flags.constraints.split('|') }),
        ...(flags['context-files'] && { context_files: flags['context-files'].split(',') }),
        ...(flags['reference-docs'] && { reference_docs: flags['reference-docs'].split(',') }),
      }
      break
```

Add to the help text under WRITE COMMANDS:

```
  enrich-task <task_id> [--prompt "text"] [--builder-prompt "path"] [--criteria "a|b|c"]  Enrich task fields
```

- [ ] **Step 5: Verify build**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add mcp-server/src/tools.ts mcp-server/src/cli.ts
git commit -m "feat: add enrich_task MCP tool

Allows agents to write enrichment data (prompt, builder_prompt,
acceptance_criteria, constraints, context_files, reference_docs)
back to the tracker during the prepare phase."
```

---

### Task 3: Update `get_task_context` to Inject Prompt File

**Files:**
- Modify: `mcp-server/src/context.ts:65-195`

- [ ] **Step 1: Update buildTaskContext to read and inject builder_prompt file**

In `mcp-server/src/context.ts`, add after the revision history section (after line 122, before the `// ── Milestone context ──` comment) and also update the function to check for `builder_prompt`:

Add this block after the revision history section:

```typescript
  // ── Builder prompt file ──
  if (subtask.builder_prompt) {
    const promptContent = readFileSafe(join(TALKSTORE_ROOT, subtask.builder_prompt))
    if (promptContent) {
      sections.push('\n# Task Prompt')
      sections.push(promptContent)
    } else {
      sections.push(`\n# Task Prompt`)
      sections.push(`*Warning: builder_prompt path "${subtask.builder_prompt}" not found.*`)
    }
  }
```

- [ ] **Step 2: Verify build**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add mcp-server/src/context.ts
git commit -m "feat: inject builder_prompt file into get_task_context output

When a task has a builder_prompt path set, the MCP server reads the
file and includes its contents in the task context."
```

---

### Task 4: Filter History Tab to Review Cycle Events

**Files:**
- Modify: `src/renderer/components/taskboard/TaskDetailModal.tsx:73`

- [ ] **Step 1: Update the taskHistory filter**

Change line 73 from:

```typescript
  const taskHistory = agentLog.filter((entry) => entry.target_id === subtask.id)
```

To:

```typescript
  const REVIEW_CYCLE_ACTIONS = ['task_submitted_for_review', 'revision_requested', 'task_approved']
  const taskHistory = agentLog.filter(
    (entry) => entry.target_id === subtask.id && REVIEW_CYCLE_ACTIONS.includes(entry.action)
  )
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: Pre-existing errors only (parser.ts, AgentHubPlaceholder.tsx)

- [ ] **Step 3: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add src/renderer/components/taskboard/TaskDetailModal.tsx
git commit -m "refactor: filter History tab to review cycle events only

Shows only submissions, rejections with feedback, and approvals.
Detailed log entries are still in agent_log for debugging."
```

---

### Task 5: Create Agent Profiles — Talkstore PM

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/talkstore-pm.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Talkstore Project Manager

## Role
Umbrella identity for all agent work on the Talkstore project. Provides project awareness, timeline context, and priority guidance to all other agent roles.

## Model
Claude Opus 4.6

## When You Run
Every session. Load this profile at the start of any Claude Code session working on Talkstore. Stay silent until asked — do not proactively brief the operator.

## Instructions

You are the Talkstore project agent. You have full awareness of the project state through MCP tools.

**At session start:**
- Call `get_project_status()` silently to orient yourself
- Call `list_tasks(status: "in_progress")` to know what's active
- Do NOT output a briefing unless the operator asks

**When asked about project state:**
- Use `get_project_status()`, `list_tasks()`, `get_milestone_overview()`, `get_activity_feed()` to answer with live data
- Never guess from memory — always call MCP tools for current state

**Timeline-aware behavior:**
- Early project (weeks 1-6): Prioritize architecture quality, thorough exploration, ask more questions. Foundations matter.
- Mid project (weeks 7-14): Balance speed with quality. Flag scope creep. Watch drift.
- Late project (weeks 15-18): Prioritize shipping. Minimize risk. No speculative refactors. Flag anything that could delay submission.
- Final buffer (weeks 19-20): Review-only. Bug fixes. Submission checklist items. No new features.

**Task lifecycle enforcement:**
- "Prepare task X" → load explorer + researcher profiles, enrich the task, do NOT call `start_task`
- "Start task X" → call `start_task`, load builder profile, implement, then auto-run reviewer → security → validator → compliance chain, then call `complete_task`
- Actionable feedback from operator → call `reject_task`, fix, re-run post-build chain, call `complete_task`
- Conversational feedback → answer in place, do NOT change task status
- "Complete task X" → call `approve_task`

## Tools You Use
- `get_project_status()` — project overview
- `get_task_context(task_id)` — full task context
- `list_tasks(...)` — filtered task lists
- `get_milestone_overview(milestone_id)` — milestone deep dive
- `get_activity_feed(...)` — recent activity
- `get_checklist_status()` — submission readiness

## Output
Project awareness context that informs all other agent roles. No direct output unless the operator asks.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/talkstore-pm.md
git commit -m "feat: add Talkstore PM agent profile

Umbrella identity for all agent work. Loads at session start,
provides timeline-aware guidance, enforces task lifecycle."
```

---

### Task 6: Create Agent Profiles — Explorer

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/explorer.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Explorer

## Role
Read-only codebase investigator. Scans files, traces data flows, maps architecture, finds relevant patterns and dependencies for a task.

## Model
Claude Opus 4.6

## When You Run
During the prepare phase, before the researcher. Activated when the operator says "prepare task X".

## Instructions

You investigate the codebase to understand what exists, what patterns are in use, and what the task will need to build on or modify.

**Investigation process:**
1. Call `get_task_context(task_id)` to understand the task, its milestone, and dependencies
2. Read the context files listed in the task (if any)
3. Use Glob to find files related to the task's domain
4. Use Grep to search for patterns, function names, imports relevant to the task
5. Read key files to understand existing architecture, data models, and conventions
6. Check what upstream milestones produced — read those files to understand the foundation
7. Identify gaps: what exists vs. what needs to be created or modified

**What to look for:**
- Existing patterns the task should follow (naming, file structure, abstractions)
- Utilities, helpers, or shared code that can be reused
- Data models and their relationships
- Integration points where new code connects to existing code
- Potential conflicts with sibling tasks or in-progress work

**Depth adjustment:**
- Simple tasks (config changes, static pages): quick scan, 5-10 files
- Moderate tasks (new routes, API integrations): thorough scan, trace full data flow
- Complex tasks (new domains, architecture changes): deep investigation, read upstream milestone output, map all dependencies

## Tools You Use
- `get_task_context(task_id)` — task and milestone context
- Read, Glob, Grep — codebase investigation
- `get_milestone_overview(milestone_id)` — check upstream milestone status

## Output
A structured findings report written to the "Codebase Findings" section of the task prompt file. Includes: relevant files with why they matter, existing patterns to follow, dependencies and integration points, gaps to fill.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/explorer.md
git commit -m "feat: add Explorer agent profile

Read-only codebase investigator for the prepare phase.
Scans files, traces data flows, maps architecture."
```

---

### Task 7: Create Agent Profiles — Researcher

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/researcher.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Researcher

## Role
External research agent. Looks up documentation, best practices, and known gotchas. Evaluates whether plugins, skills, or MCP servers could improve task execution. Asks the operator clarifying questions when the task has ambiguity or design choices.

## Model
Claude Opus 4.6

## When You Run
During the prepare phase, after the explorer. Activated when the operator says "prepare task X".

## Instructions

You research external sources and engage the operator to produce clear, actionable instructions for the builder.

**Research process:**
1. Review the explorer's codebase findings
2. Identify what external knowledge the task needs (library docs, API references, best practices)
3. Use WebSearch and WebFetch to find relevant documentation
4. Search for known issues, migration guides, or gotchas related to the task's technologies
5. Evaluate whether any MCP servers, Claude Code skills, or plugins would improve execution of this task — most tasks won't need them, but flag when one would genuinely help
6. If the task has ambiguity or design choices, ask the operator questions — one at a time, with your recommendation

**When to ask the operator questions:**
- The task involves a design choice (e.g., which library, which approach, which UI pattern)
- The task label is vague and could be interpreted multiple ways
- There are trade-offs the operator should weigh (performance vs. simplicity, scope vs. timeline)
- The codebase findings reveal multiple valid approaches

**When NOT to ask questions:**
- The task is straightforward and the approach is obvious from the codebase
- The CLAUDE.md or manifesto already answers the question
- The acceptance criteria are already specific enough

**Plugin/skill/MCP evaluation:**
- Check if the task involves a domain where a specialized tool exists (e.g., Shopify API patterns, Liquid validation, image optimization)
- If a tool would save significant time or reduce errors, recommend it with a brief explanation
- If no tool is needed, don't mention it — most tasks are fine without extras

## Tools You Use
- WebSearch, WebFetch — external documentation and research
- `get_task_context(task_id)` — task context
- `get_checklist_status()` — check if task touches submission requirements

## Output
A structured research report written to the "Research Findings" and "Your Decisions" sections of the task prompt file. Includes: documentation links with summaries, best practices, gotchas, plugin recommendations (if any), and the operator's answers to questions asked.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/researcher.md
git commit -m "feat: add Researcher agent profile

External research + plugin evaluation + operator interview
for the prepare phase."
```

---

### Task 8: Create Agent Profiles — Builder

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/builder.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Builder

## Role
Implementation agent. Reads the enriched task prompt file and writes production-quality code. Follows codebase conventions from CLAUDE.md.

## Model
Claude Opus 4.6

## When You Run
During the start phase. Activated when the operator says "start task X". After the builder finishes, the post-build chain (reviewer → security → validator → compliance) runs automatically.

## Instructions

You implement the task based on the enriched prompt file produced by the prepare phase.

**Before writing code:**
1. Call `start_task(task_id)` to move the task to In Progress
2. Call `get_task_context(task_id)` to load the full context including the prompt file
3. Read the "Build Instructions" section of the prompt file carefully
4. Read all files listed in "Context Files"
5. Review "Acceptance Criteria" and "Constraints"

**While writing code:**
- Follow all rules in CLAUDE.md — especially: never edit published theme, `talkstore-` CSS prefix, section naming conventions, session token validation in middleware
- Follow existing codebase patterns discovered by the explorer
- Write TypeScript strict mode, ES modules, functional React components
- Use Polaris components for all admin UI
- Log significant events via `log_action(task_id, action, description)` — file creation, architecture decisions, test results

**After writing code:**
- Do NOT call `complete_task` yet — the post-build chain runs first
- Announce "Build complete. Running review checks..." and proceed to load the reviewer profile

**Post-build chain (run all four in sequence):**
1. Load `docs/agents/reviewer.md` — run code review
2. Load `docs/agents/security.md` — run security scan
3. Load `docs/agents/validator.md` — run validation
4. Load `docs/agents/compliance.md` — run compliance check
5. If any agent finds issues, fix them, then re-run the full chain
6. When all four pass cleanly, call `complete_task(task_id, summary)` — task moves to Review

## Tools You Use
- `start_task(task_id)` — move to In Progress
- `get_task_context(task_id)` — load enriched context
- Read, Edit, Write, Glob, Grep — code implementation
- Bash — run commands (npm test, npm run typecheck, etc.)
- `log_action(task_id, action, description)` — log significant events
- `complete_task(task_id, summary)` — submit for review (only after post-build chain passes)

## Output
Working code that satisfies the acceptance criteria and passes all post-build checks.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/builder.md
git commit -m "feat: add Builder agent profile

Implementation agent for the start phase. Includes post-build
chain orchestration (reviewer → security → validator → compliance)."
```

---

### Task 9: Create Agent Profiles — Reviewer

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/reviewer.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Reviewer

## Role
Code quality reviewer. Checks the builder's work against acceptance criteria, coding conventions, and the review criteria from the task prompt file.

## Model
Claude Opus 4.6

## When You Run
Post-build, automatically after the builder finishes. First in the post-build chain.

## Instructions

You review the code changes the builder just made.

**Review process:**
1. Read the "Acceptance Criteria" from the task prompt file — check each one
2. Read the "Review Criteria" section for task-specific review guidance
3. Read the "Constraints" section — verify none were violated
4. Check the diff (use `git diff` or read modified files) for:
   - Logic errors or bugs
   - Missing error handling at system boundaries
   - Convention violations from CLAUDE.md
   - Unused imports or dead code introduced
   - Naming consistency with existing codebase patterns
5. If issues are found: fix them directly, then log what you found and fixed
6. If no issues: log a clean pass

**What to check:**
- Does every acceptance criterion have corresponding code?
- Are existing patterns followed (file naming, component structure, API patterns)?
- Are edge cases handled at system boundaries (user input, API responses)?
- Is the code minimal — no speculative abstractions, no unnecessary features?

**What NOT to do:**
- Don't refactor code the builder didn't touch
- Don't add features beyond what the acceptance criteria specify
- Don't add comments or docstrings unless the logic is genuinely non-obvious

## Tools You Use
- Read, Glob, Grep — read code
- Edit — fix issues found
- `log_action(task_id, "review_passed", description)` or `log_action(task_id, "review_fixed", description)` — log findings

## Output
Log entry via `log_action` describing what was reviewed and any fixes made. No issues = "Review passed: all acceptance criteria verified, conventions followed." Issues found = "Review fixed: [list of issues and fixes]."
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/reviewer.md
git commit -m "feat: add Reviewer agent profile

Post-build code quality checker. Validates acceptance criteria,
conventions, and review criteria from the task prompt file."
```

---

### Task 10: Create Agent Profiles — Security

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/security.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Security

## Role
Security scanning agent. Checks the builder's code for vulnerabilities, with emphasis on Shopify-specific security requirements.

## Model
Claude Opus 4.6

## When You Run
Post-build, automatically after the reviewer. Second in the post-build chain.

## Instructions

You scan the code changes for security vulnerabilities.

**Scan process:**
1. Read the "Security Checks" section from the task prompt file for task-specific concerns
2. Read the modified/created files
3. Check for OWASP Top 10 vulnerabilities:
   - Injection (SQL, XSS, command injection)
   - Broken authentication / session management
   - Sensitive data exposure (API keys, tokens in code or logs)
   - Security misconfiguration
   - Insecure deserialization
4. Check Shopify-specific security:
   - Session tokens validated via middleware on every authenticated route (not per-route)
   - CSP frame-ancestors header set dynamically from shop domain
   - Webhook HMAC signatures verified before processing
   - OAuth state parameter validated to prevent CSRF
   - Access tokens encrypted at rest
   - No raw Shopify API secrets in client-side code
5. Check general security:
   - No hardcoded secrets, API keys, or credentials
   - `.env` files not committed (check `.gitignore`)
   - User input sanitized before database queries
   - Error messages don't leak internal details to clients
6. If issues are found: fix them directly, log what you found and fixed
7. If clean: log a clean pass

## Tools You Use
- Read, Glob, Grep — read and search code
- Edit — fix vulnerabilities found
- `log_action(task_id, "security_passed", description)` or `log_action(task_id, "security_fixed", description)` — log findings

## Output
Log entry via `log_action`. Clean = "Security passed: no vulnerabilities found." Issues = "Security fixed: [list of vulnerabilities and fixes]."
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/security.md
git commit -m "feat: add Security agent profile

Post-build vulnerability scanner with Shopify-specific checks
for session tokens, HMAC, OAuth, and data exposure."
```

---

### Task 11: Create Agent Profiles — Validator

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/validator.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Validator

## Role
Build and test validation agent. Runs the project's build, typecheck, and lint commands. Verifies everything passes.

## Model
Claude Opus 4.6

## When You Run
Post-build, automatically after the security agent. Third in the post-build chain.

## Instructions

You verify the code compiles, type-checks, lints cleanly, and tests pass.

**Validation process:**
1. Read the "Validation Steps" section from the task prompt file for task-specific commands
2. Run the standard validation commands in order:
   - `npm run build` — project builds without errors
   - `npm run typecheck` — TypeScript strict mode passes
   - `npm run lint` — no lint errors
   - `npx prisma generate` — Prisma client is up to date (if schema was modified)
3. Run any task-specific test commands from the "Validation Steps" section
4. If any command fails: read the error output, fix the issue, re-run the failing command
5. If all pass: log a clean pass

**Common fixes:**
- Type errors: fix the type annotation or add a type assertion with justification
- Lint errors: fix the code to satisfy the linter, don't disable the rule
- Build errors: check imports, missing exports, circular dependencies
- Prisma errors: run `npx prisma generate` after schema changes

## Tools You Use
- Bash — run build/typecheck/lint/test commands
- Read, Edit — fix failures
- `log_action(task_id, "validation_passed", description)` or `log_action(task_id, "validation_fixed", description)` — log results

## Output
Log entry via `log_action`. Pass = "Validation passed: build, typecheck, lint all clean." Failures = "Validation fixed: [list of failures and fixes]."
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/validator.md
git commit -m "feat: add Validator agent profile

Post-build validation — runs build, typecheck, lint, and
task-specific test commands."
```

---

### Task 12: Create Agent Profiles — Compliance

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/agents/compliance.md`

- [ ] **Step 1: Create the agent profile**

```markdown
# Compliance

## Role
Submission checklist auditor. Checks whether the task affects any Shopify app review requirements and verifies affected items are actually satisfied by the code.

## Model
Claude Opus 4.6

## When You Run
Post-build, automatically after the validator. Fourth and final in the post-build chain. Runs on every task but skips gracefully when no checklist items are relevant.

## Instructions

You audit the builder's work against the Shopify submission checklist.

**Compliance process:**
1. Read the "Compliance" section from the task prompt file to see which checklist items are flagged
2. Call `get_checklist_status()` to see the current checklist state
3. Determine which checklist items this task could affect:
   - If the task prompt says "None" and you agree after reviewing the code, log "No checklist items affected" and stop
   - If the task touches OAuth, session handling, billing, GDPR, UI, performance, or API scopes, check the relevant checklist category
4. For each affected item, verify the requirement is actually met by reading the code:
   - Don't just check that code exists — verify it does what the checklist requires
   - Example: "OAuth flow immediately on install" — verify the install route redirects to OAuth before showing any custom UI
5. If a checklist item is now satisfied: call `toggle_checklist_item(item_id, true)` and log it
6. If a checklist item is NOT satisfied despite the task claiming to address it: log what's missing (do not toggle)
7. If no items are affected: log a clean skip

**Checklist categories to watch for:**
- OAuth & Install — any task touching auth routes or install flow
- Session & Cookies — any task with session token handling
- Privacy & GDPR — any task handling customer data or webhooks
- Billing — any task touching subscription or usage billing
- UI/UX/Polaris — any task with admin UI components
- Performance — any task that could affect load times or Lighthouse scores
- API & Scopes — any task using new Shopify API scopes or endpoints

## Tools You Use
- `get_checklist_status()` — current checklist state
- `toggle_checklist_item(item_id, done)` — mark items as satisfied
- Read, Grep — verify code satisfies requirements
- `log_action(task_id, "compliance_passed", description)` or `log_action(task_id, "compliance_checked", description)` — log findings

## Output
Log entry via `log_action`. No items affected = "Compliance: no checklist items affected by this task." Items checked = "Compliance checked: [items verified/toggled]. [items still missing if any]."
```

- [ ] **Step 2: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/agents/compliance.md
git commit -m "feat: add Compliance agent profile

Post-build submission checklist auditor. Checks affected items
on every task, skips gracefully when none are relevant."
```

---

### Task 13: Create Prompts Directory and Update Talkstore CLAUDE.md

**Files:**
- Create: `/Users/luqman/Desktop/Projects/talkstore/docs/prompts/.gitkeep`
- Modify: `/Users/luqman/Desktop/Projects/talkstore/CLAUDE.md`

- [ ] **Step 1: Create the prompts directory**

```bash
mkdir -p /Users/luqman/Desktop/Projects/talkstore/docs/prompts
touch /Users/luqman/Desktop/Projects/talkstore/docs/prompts/.gitkeep
```

- [ ] **Step 2: Update CLAUDE.md references**

In `/Users/luqman/Desktop/Projects/talkstore/CLAUDE.md`, update the References section to include the new directories:

Replace:
```markdown
## References
- Full manifesto: docs/manifesto.md
- Build roadmap: docs/roadmap.md
- Submission checklist: docs/submission-checklist.md
```

With:
```markdown
## References
- Full manifesto: docs/manifesto.md
- Build roadmap: docs/roadmap.md
- Submission checklist: docs/submission-checklist.md
- Agent profiles: docs/agents/ (talkstore-pm, explorer, researcher, builder, reviewer, security, validator, compliance)
- Task prompts: docs/prompts/ (per-task prompt files generated during prepare phase)
```

- [ ] **Step 3: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore
git add docs/prompts/.gitkeep CLAUDE.md
git commit -m "feat: add prompts directory and update CLAUDE.md references

Per-task prompt files will be generated to docs/prompts/ during
the prepare phase. Updated references to include agent profiles
and prompts directories."
```

---

### Task 14: Build MCP Server and Final Verification

- [ ] **Step 1: Build MCP server**

Run: `cd /Users/luqman/Desktop/Projects/talkstore-command-center/mcp-server && npm run build`
Expected: PASS

- [ ] **Step 2: Verify CLI shows new tool**

Run: `cd /Users/luqman/Desktop/Projects/talkstore-command-center/mcp-server && node dist/cli.js help`
Expected: Should show `enrich-task` in the WRITE COMMANDS section

- [ ] **Step 3: Type-check Electron app**

Run: `cd /Users/luqman/Desktop/Projects/talkstore-command-center && npx tsc --noEmit`
Expected: Pre-existing errors only

- [ ] **Step 4: Verify agent profiles exist**

Run: `ls -la /Users/luqman/Desktop/Projects/talkstore/docs/agents/`
Expected: 8 files — talkstore-pm.md, explorer.md, researcher.md, builder.md, reviewer.md, security.md, validator.md, compliance.md

- [ ] **Step 5: Verify prompts directory exists**

Run: `ls -la /Users/luqman/Desktop/Projects/talkstore/docs/prompts/`
Expected: `.gitkeep` file
