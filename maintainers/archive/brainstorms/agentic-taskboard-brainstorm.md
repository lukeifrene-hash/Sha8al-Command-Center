# Agentic Task Board — Brainstorm Notes

> Captured from brainstorming session on 2026-03-16. To be revisited for implementation.

---

## Current State

The Task Board today is a simple Kanban view scoped to a single milestone at a time. Subtasks have: label, status, assignee, priority, notes. No execution capability — it's a display layer only.

---

## Identified Problems

1. **Milestone-scoped, but work isn't.** You're always working across multiple milestones simultaneously. The board only shows one at a time via a dropdown.

2. **No "my day" view.** No cross-milestone view of your active work. Can't answer "what should I work on today?"

3. **Swim Lane connection is one-way.** Task Board can link to Swim Lane, but you can't click a Swim Lane node and land on its tasks.

4. **No agent assignment workflow.** Assignee is just a text label — it doesn't trigger anything. No way to dispatch work to agents from the board.

5. **Priority doesn't drive order.** P3 tasks can appear above P1. No visual weight difference between priority levels.

6. **No dependency visibility.** Can't see what a blocked task is blocked BY in a way that helps you unblock it.

7. **Time pressure isn't reflected.** A P1 in a drifting Week 2 milestone should feel more urgent than a P1 in a Week 10 milestone. The board treats them the same.

---

## The Core Idea: Agentic Task Board

Transform the Task Board from a passive display into an execution layer — you can dispatch tasks to agents directly from the board with proper context.

### The Problem With Naive Execution

A subtask label like "Implement OAuth install + token exchange flow" is not enough for an agent. It needs:
- Framework context (Remix v2, Prisma, Polaris)
- What files already exist
- What patterns to follow
- What constraints matter
- What "done" looks like

### Solution: Layered Just-In-Time Prompt Assembly (Option C)

Three options were considered:

| Option | Approach | Trade-off |
|--------|----------|-----------|
| **A — Manual prompts** | You write every prompt by hand | Full control, doesn't scale across 165 subtasks |
| **B — Pre-generated prompts** | Prompts generated once at parse time | Goes stale as codebase evolves |
| **C — Just-in-time assembly** | Prompt assembled fresh at dispatch time from 3 layers | Always current, mostly automated, reviewable |

**Option C was selected** as the direction to pursue.

---

## Option C: How It Works

When you click "Run" on a subtask card, the system assembles a prompt from three layers:

### Layer 1 — Project Context (static, same for every task)

```
Sources:
├── CLAUDE.md (conventions, patterns, stack)
├── manifesto.md (product philosophy)
└── tasks.md (canonical task list, validated via multi-LLM audit)
```

Read once, cached. Provides the foundation every agent needs.

### Layer 2 — Milestone Context (semi-static, changes slowly)

Assembled from the tracker data:

```
Milestone: "Scaffold + Auth Shell" (Week 1)
├── Exit criteria from roadmap
├── Dependencies (upstream milestones)
├── Downstream (what depends on this)
├── Sibling subtasks and their current status
│   ├── ✅ Completed tasks (agent knows what's done)
│   ├── 🔄 In-progress tasks (agent knows what's being worked on)
│   └── ⬜ Remaining tasks (agent knows what's coming)
└── Drift status (on track / behind / ahead)
```

Prevents agents from re-doing work or making assumptions about things that don't exist yet.

### Layer 3 — Dynamic Codebase Scan (fresh every time)

An Explorer agent runs a pre-flight scan before dispatch:

1. Reads the subtask label
2. Infers what's relevant (files, patterns, modules)
3. Scans the actual codebase RIGHT NOW
4. Produces a context snapshot describing:
   - What files exist and their structure
   - What patterns are being used
   - What's relevant to this specific task
   - What doesn't exist yet (gaps to fill)

This snapshot is generated fresh every run — if you run the same subtask tomorrow after other agents have changed the codebase, the context reflects the new state.

### Final Assembled Prompt

```
SYSTEM CONTEXT:
[Layer 1 — project docs, conventions, stack]

MILESTONE CONTEXT:
[Layer 2 — milestone state, siblings, dependencies, drift]

CODEBASE STATE (scanned just now):
[Layer 3 — Explorer's fresh snapshot]

YOUR TASK:
[Subtask label + description]

ACCEPTANCE CRITERIA:
[Checklist of verifiable conditions]

CONSTRAINTS:
[What NOT to do]
```

---

## Subtask Data Model Expansion

Current:
```typescript
interface Subtask {
  id: string
  label: string
  status: 'todo' | 'in_progress' | 'done' | 'blocked'
  done: boolean
  assignee: string | null
  priority: 'P1' | 'P2' | 'P3'
  notes: string | null
  blocked_by: string | null
  blocked_reason: string | null
  completed_at: string | null
  completed_by: string | null
}
```

Proposed additions:
```typescript
interface Subtask {
  // ... everything above, plus:

  // Prompt layer
  prompt: string | null              // Manual override instruction (optional)
  context_files: string[]            // Files the agent should read first
  reference_docs: string[]           // External docs / URLs
  acceptance_criteria: string[]      // How to verify it's done
  constraints: string[]              // What NOT to do

  // Execution config
  agent_target: string | null        // Which agent type should run this (explorer/planner/builder)
  execution_mode: 'human' | 'agent' | 'pair'  // Who does this?
  last_run_id: string | null         // Links to agent_log entry for last execution
}
```

---

## Task Board UI Changes

### Card Detail Modal — New Tabs

**Tab 1 — Details** (existing: status, assignee, priority, blocker)

**Tab 2 — Prompt**
- Auto-generated prompt preview (assembled from 3 layers)
- "Preview Full Prompt" button to see the assembled output
- "Edit Override" button to manually tweak before dispatch
- File picker for additional context_files
- Acceptance criteria editor (checklist)
- Constraints list editor
- Agent type selector: Explorer / Planner / Builder / Custom

**Tab 3 — Execution History**
- Previous runs of this task (linked from agent_log)
- What the agent did, what files it changed
- Whether it passed acceptance criteria
- Ability to re-run with the same or modified prompt

### Card Surface Changes
- "Run" button on task cards (or in detail modal)
- Visual indicator for execution_mode (human / agent / pair icons)
- Agent target badge showing which agent type is assigned

---

## Implementation Pieces

| Piece | Description | Complexity | Priority |
|-------|-------------|------------|----------|
| Subtask data model expansion | Add new fields to Subtask interface and parser | Small | P1 |
| Milestone context assembler | Function that reads milestone + siblings + dependencies → context block | Medium | P1 |
| Pre-flight Explorer scan | Spawns Explorer to scan relevant codebase state before dispatch | Medium | P1 |
| Prompt assembler | Combines all 3 layers into final prompt | Small | P1 |
| Dispatch mechanism | Bridge between Electron app and Claude Code to execute tasks | Medium | P1 |
| Task Board UI — prompt tab | Prompt preview, acceptance criteria editor, Run button | Medium | P2 |
| Task Board UI — execution history | Show past runs, results, file changes | Medium | P2 |
| Acceptance criteria checker | Post-run automated verification | Deferrable | P3 |
| Cross-milestone "my day" view | Show all in-progress/assigned tasks across milestones | Medium | P2 |
| Priority-weighted sorting | P1 above P2 above P3 within columns | Small | P2 |
| Dependency visualization | Show blocker chains on the board | Medium | P3 |
| Time pressure indicators | Visual urgency based on milestone drift + priority | Small | P3 |

---

## Open Question: Dispatch Mechanism

How does the Electron app actually tell Claude Code to run a task?

**Option A — Direct process launch:** Electron spawns a Claude Code process with the assembled prompt. Fully automated but requires CLI integration.

**Option B — Clipboard + manual paste:** Electron assembles the prompt, copies to clipboard, you paste into a Claude Code session. Simple but manual.

**Option C — Agent SDK integration:** Use the Claude Agent SDK to run agents programmatically from within the Electron app's main process. Most powerful, most complex.

**Option D — File-based handoff:** Electron writes the prompt to a file, a watcher script picks it up and feeds it to Claude Code. Decoupled, works with agent teams.

Decision deferred — to be revisited during implementation.

---

## Agent Architecture Context

### Claude Code's Built-in Sub-Agents

| Agent Type | Role | Tools |
|-----------|------|-------|
| Explore | Fast codebase search, read-only | Glob, Grep, Read, Bash |
| Plan | Architecture design, read-only | Glob, Grep, Read, Bash |
| General-purpose (Builder) | Full capabilities | All tools |

### Agent Teams (experimental, enabled in this project)

Multiple independent Claude Code sessions coordinating via shared task list + mailbox. Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings.

### Custom Agents

Defined as markdown files in `.claude/agents/`. Can specify tools, model, permissions, memory, and system prompt. Spawnable by name.

### Command Center Agent Roster

| Agent ID | Name | Type |
|----------|------|------|
| `luqman` | Luqman | human |
| `claude_code` | Claude Code (Main) | orchestrator |
| `claude_code_explore` | Claude Code (Explorer) | sub-agent |
| `claude_code_planner` | Claude Code (Planner) | sub-agent |
| `claude_code_builder` | Claude Code (Builder) | sub-agent |
