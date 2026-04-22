# Sha8al Command Center — TalkStore Compatibility Guide

> TalkStore in this guide refers to the compatibility profile of `sha8al-command-center`. Existing TalkStore wiring remains valid.

> Reference document for YouTube video walkthrough. Covers every component, data flow, and design decision.

---

## What It Is

Sha8al Command Center is a desktop application + MCP server that lets a human operator and multiple AI agents (Claude, Codex, or any MCP-compatible client) collaborate on the same project through a shared state file. In this guide, TalkStore refers to the compatibility profile and live project wiring, not the platform identity. It is not the Shopify app itself; it is the control plane that coordinates building the app.

The core idea: one JSON file (`talkstore-tracker.json`) is the single source of truth. The Electron dashboard reads and writes it. Claude Code reads and writes it through MCP tools. Codex reads and writes it through the same MCP tools. The dashboard watches the file and updates in real time — so when an agent marks a task as done in a terminal, the dashboard reflects it instantly.

---

## Architecture Overview

```
                    ┌──────────────────────────┐
                    │   Operator (Luqman)       │
                    │   sees dashboard + chat   │
                    └─────────┬────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
     ┌────────▼───────┐ ┌────▼─────┐ ┌───────▼────────┐
     │  Electron App   │ │  Claude  │ │     Codex      │
     │  (Dashboard)    │ │  Code    │ │     CLI        │
     │                 │ │          │ │                │
     │  - Swim Lane    │ │  MCP     │ │  MCP           │
     │  - Task Board   │ │  Client  │ │  Client        │
     │  - Agent Hub    │ │          │ │                │
     └────────┬────────┘ └────┬─────┘ └───────┬────────┘
              │               │               │
              │        ┌──────▼──────┐        │
              │        │  MCP Server │        │
              │        │  (Node.js)  │        │
              │        └──────┬──────┘        │
              │               │               │
              └───────────────┼───────────────┘
                              │
                   ┌──────────▼──────────┐
                   │ talkstore-tracker   │
                   │      .json          │
                   │                     │
                   │  tasks, milestones, │
                   │  agents, audit log, │
                   │  checklist          │
                   └─────────────────────┘
```

**Three consumers, one file, real-time sync.**

---

## The Tracker File

Everything revolves around `talkstore-tracker.json`. It contains:

| Section | What It Holds |
|---------|--------------|
| `project` | Name, start date, target submit date, current week, schedule status, overall progress |
| `milestones[]` | Each milestone: title, domain, week, planned/actual dates, drift, subtasks, dependencies, exit criteria |
| `milestones[].subtasks[]` | Each task: ID, label, status, assignee, acceptance criteria, constraints, builder_prompt path, priority, depends_on |
| `submission_checklist` | 14 categories, 122 items tracking Shopify App Store review requirements |
| `agents[]` | Registered agents with type (orchestrator/sub-agent/human), permissions, parent_id, color, last action time |
| `agent_log[]` | Full audit trail — every action taken by every agent, timestamped with tags |
| `schedule` | Phase definitions with week ranges and colors |

The file is ~855KB with 138 tasks across 9 milestones, 14 registered agents, and 648+ audit log entries.

**Nobody edits this file directly.** The dashboard writes to it through the Electron IPC bridge. Agents write to it through MCP tools. The parser generates it from markdown. All roads lead to the same file.

---

## The Three Views

### 1. Swim Lane View (Timeline)

A horizontal timeline showing the entire project across 4 weeks. Two swim lanes arranged vertically:

- **Product Ops** — product mutations, DCI scoring, vision analysis, GEO readiness, enrichment, feeds, proactive insights
- **Launch Prep** — commerce intel, billing, onboarding, polish, submission, review buffer

Each milestone appears as a **circular node** positioned at its week. The circle is a progress indicator — the filled arc shows how many subtasks are done. Click a node to open a detail panel with dates, dependencies, exit criteria, and subtask checklist.

**Key visual elements:**

- **Phase bands** — colored background strips spanning week ranges (Foundation = purple, Commerce = blue, Polish = amber)
- **NOW marker** — a red/purple vertical line showing today's exact position, calculated to the day (e.g., "NOW Apr 7" between W1 and W2)
- **Major milestone markers** — dashed vertical lines for "App Store Submit" (W3) and version ship dates
- **Drift visualization** — when a milestone's actual dates differ from planned: a ghost node appears at the planned position, connected by a colored bar (green = ahead of schedule, red = behind)
- **Connection lines** — SVG lines connect adjacent milestones within a lane
- **Stacking** — multiple milestones in the same week stack vertically with tighter spacing

**Checklist lane** at the bottom: a compact grid of 12 checklist category boxes (5 columns) showing progress per category. Critical categories marked with a warning indicator.

**Interactions:**
- Click any milestone node to open the detail panel
- Drag to scroll horizontally across the timeline
- Auto-scrolls to the current week on load
- Edit dates in the detail panel — downstream milestones ripple-shift automatically

### 2. Task Board View (Kanban)

A kanban board scoped to a single milestone. Five columns:

| Column | Color | Meaning |
|--------|-------|---------|
| TO DO | Gray (#9B9BAA) | Not started |
| IN PROGRESS | Purple (#585CF0) | Agent or human is working on it |
| REVIEW | Amber (#f59e0b) | Work done, waiting for operator approval |
| DONE | Green (#22c55e) | Operator approved |
| BLOCKED | Red (#ef4444) | Stuck on a dependency or issue |

Each task is a card showing: domain badge, priority number, task label, and a drag handle.

**Features:**
- **Milestone dropdown** — switch between milestones, defaults to the current week's milestone
- **Filters** — All, My Tasks (assignee = Luqman), Agent Tasks (has an assignee), Blocked
- **Drag and drop** — drag cards between columns to change status. Uses @dnd-kit for smooth animations.
- **Task detail modal** — click a card to see full details: acceptance criteria, constraints, assignee, execution mode, context files, reference docs, revision history
- **Linked checklist items** — bottom section shows which submission checklist items are tied to this milestone

**Status transitions enforced:**
- Dragging to DONE sets `completed_at` and `completed_by`
- Dragging to BLOCKED prompts for a reason
- Cards show different visual treatments per status

### 3. Agent Hub View (Mission Control)

The real-time monitoring view for multi-agent operations. Split into two columns:

**Left sidebar:**

1. **Connected Agents panel** — shows every registered agent grouped by hierarchy:
   - Orchestrators (Claude Code, Codex) with their sub-agents nested underneath
   - Each agent has a colored dot, name, type badge, and active/idle indicator
   - Active = had an action within the last 30 minutes (green dot)
   - "Connect New Agent" button shows CLI instructions for registering new agents

2. **Shared State File Info** — technical details: file path, watcher status, milestone count, subtask count, log entry count, schema validity

3. **Context Injection Preview** — shows the status string that gets injected into agent prompts: `"WEEK 3, Phase: Product Ops, Progress: 45% (12/27), Schedule: ON TRACK, Blocked: 2"`

4. **Today's Summary** — completed/in-progress/blocked counts for the day, plus a table showing each agent's contributions

**Right column:**

1. **Activity Feed** — chronological log of every agent action across the project:
   - Grouped by day (TODAY, YESTERDAY, older dates)
   - Each entry shows: agent color dot, agent name, action type, description, timestamp
   - Tags with styled backgrounds: WRITE (purple), CHECKLIST (green), COMMIT (blue), ALERT (red)
   - Filterable by agent ID or tag
   - Searchable by description, action name, or target task ID
   - Paginated with "load more"

2. **Agent Performance Stats** — per-agent weekly metrics: total actions, checklist items completed, alerts raised

---

## The MCP Server

The MCP (Model Context Protocol) server is what makes AI agents first-class citizens. It's a Node.js process that exposes 20 tools over stdio, allowing any MCP-compatible client (Claude Code, Codex CLI, or custom agents) to read and write the tracker programmatically.

### Tool Catalog

**Read tools (no state changes):**

| Tool | What It Returns |
|------|----------------|
| `get_task_context(task_id)` | Full task details + acceptance criteria + constraints + builder prompt file content + milestone context + sibling tasks + dependencies + manifesto sections. ~8,000 tokens. Used by the builder. |
| `get_task_summary(task_id)` | Slim version: task ID, label, status, domain, acceptance criteria, constraints, context files, revision history only. ~500 tokens. Used by researcher and post-build auditor. |
| `get_project_status()` | Overall progress, current week, phase, schedule status, blocked count. ~200 tokens. |
| `get_milestone_overview(milestone_id)` | All tasks in a milestone with statuses, exit criteria, dependencies, progress percentage. |
| `list_tasks(milestone_id?, status?, domain?)` | Filtered task list with IDs, labels, and statuses. |
| `get_checklist_status(filter?)` | Submission checklist progress. Defaults to incomplete items only. |
| `get_task_history(task_id)` | Full audit log for a specific task. |
| `list_agents()` | All registered agents with status, permissions, last action time. |

**Write tools (mutate tracker state):**

| Tool | What It Does |
|------|-------------|
| `start_task(task_id, agent_id?)` | Moves task to `in_progress`. Auto-stamps milestone `actual_start` if first task. |
| `complete_task(task_id, summary, agent_id?)` | Moves task to `review`. Logs summary to audit trail. |
| `block_task(task_id, reason)` | Marks task as blocked with explanation. |
| `unblock_task(task_id, resolution?)` | Clears blocked state. Returns to previous status. |
| `approve_task(task_id, feedback?)` | Operator only. Moves to `done`. Auto-stamps milestone `actual_end` if last task. Triggers `autoUnblockDependents()` — automatically unblocks downstream tasks whose dependencies are now satisfied. |
| `reject_task(task_id, feedback)` | Operator only. Returns to `in_progress` with revision feedback logged to history. |
| `reset_task(task_id)` | Operator only. Resets to `todo` regardless of current state. |
| `log_action(task_id, action, description, tags?, agent_id?)` | Writes an entry to the audit trail. Used by agents to record significant events. |
| `update_task(task_id, ...)` | Change priority, assignee, execution mode, or notes. |
| `enrich_task(task_id, ...)` | Write prepare-phase outputs: builder_prompt path, acceptance criteria, constraints, context files, reference docs. |
| `register_agent(agent_id, name, type, permissions, color?, parent_id?)` | Register a new agent in the tracker. Appears in Agent Hub. |

**Milestone tools:**

| Tool | What It Does |
|------|-------------|
| `add_milestone_note(milestone_id, note)` | Add an exit criterion or observation. |
| `set_milestone_dates(milestone_id, actual_start?, actual_end?)` | Set actual dates. Auto-calculates drift. |
| `update_drift(milestone_id, drift_days)` | Manual drift adjustment. Recalculates schedule status. |

### Context Assembly

The `get_task_context` tool doesn't just return raw data — it assembles a rich markdown document designed to give an agent everything it needs in one call:

1. Task details (ID, status, priority, assignee, notes)
2. Acceptance criteria as a checklist
3. Constraints
4. Context files to read first
5. Revision history (if the task was previously rejected with feedback)
6. The full builder prompt file (the prepared task specification)
7. Milestone context (domain, phase, week, planned dates, drift)
8. Exit criteria for the milestone
9. Sibling task statuses (what else is in progress or blocked)
10. Upstream/downstream dependency status
11. Domain-specific manifesto sections (product philosophy relevant to this task's domain)

This is the "briefing packet" an agent receives before starting work. The `get_task_summary` version strips this to just items 1-5 for agents that only need to verify work, not understand the full context.

### Auto-Unblock System

When a task is approved (`approve_task`), the tracker automatically checks:

1. **Subtask-level dependencies** — if other tasks have `depends_on` pointing to the completed task, and all their dependencies are now done, they get unblocked automatically.
2. **Milestone-level dependencies** — if an entire milestone's tasks are all done, downstream milestones that depend on it get their blocked tasks unblocked.

This means approving the last task in a milestone can cascade-unblock an entire next phase.

---

## The CLI Wrapper

A shell script at `talkstore/talkstore` forwards commands to the MCP server's CLI mode:

```bash
./talkstore get-task-context <task_id>
./talkstore start-task <task_id>
./talkstore complete-task <task_id> --summary "Built the feature"
./talkstore log-action <task_id> --action "file_created" --description "Created handler"
```

This is the fallback for agents that can't use MCP directly — they can shell out to the CLI instead.

---

## Multi-Agent Workflow

### How a Task Moves Through the System

```
 OPERATOR: "prepare task X"
     │
     ▼
 ORCHESTRATOR (Claude or Codex session)
     │
     ├── Spawns EXPLORER sub-agent
     │   └── Scans codebase, returns findings
     │
     ├── Compresses explorer findings into ~500 token brief
     │
     ├── Spawns RESEARCHER sub-agent  
     │   └── Looks up docs, checks checklist, returns research
     │
     ├── Writes prompt file: docs/prompts/<task_id>.md
     │
     └── Calls enrich_task() → tracker updated, task stays TODO
         Dashboard updates in real time.

 OPERATOR: "start task X"
     │
     ▼
 ORCHESTRATOR calls start_task() → task moves to IN PROGRESS
     │                               Dashboard card moves to purple column.
     ▼
 ORCHESTRATOR reads prompt, writes code (acts as the builder)
     │
     ▼
 Runs: npm run build && npm run typecheck && npm run lint
     │
     ▼
 Spawns POST-BUILD AUDITOR sub-agent
     │   └── Reviews code quality, security, compliance in one pass
     │       └── Logs audit_complete to tracker
     │           Activity Feed shows the entry in real time.
     ▼
 ORCHESTRATOR calls complete_task() → task moves to REVIEW
                                       Dashboard card moves to amber column.

 OPERATOR reviews the work
     │
     ├── Approves: calls approve_task() → DONE (green column)
     │   └── Auto-unblocks dependent tasks if applicable
     │
     └── Gives feedback: orchestrator calls reject_task() → back to IN PROGRESS
         └── Fix, re-audit, re-submit
```

### Agent Registry

The Agent Hub shows all participants:

| Agent ID | Type | Provider | Role |
|----------|------|----------|------|
| `luqman` | human | — | Operator. Reviews and approves. |
| `claude_code` | orchestrator | Claude | Main Claude session. Coordinates and builds. |
| `explorer` | sub-agent | Claude | Codebase investigation during prepare phase. |
| `researcher` | sub-agent | Claude | External docs research during prepare phase. |
| `post-build-auditor` | sub-agent | Claude | Code review + security + compliance after build. |
| `codex` | orchestrator | Codex | Main Codex session. Coordinates and builds. |
| `codex_explorer` | sub-agent | Codex | Codex's codebase investigator. |
| `codex_researcher` | sub-agent | Codex | Codex's documentation researcher. |
| `codex_builder` | sub-agent | Codex | Attribution ID for Codex build work. |
| `codex_auditor` | sub-agent | Codex | Codex's post-build reviewer. |

Sub-agents are grouped under their parent orchestrator in the Agent Hub UI.

---

## Real-Time Sync

The magic moment for a demo: open the dashboard on one screen and a Claude Code terminal on another.

1. Claude calls `start_task("product_ops_write_001")` in the terminal
2. The MCP server writes to `talkstore-tracker.json`
3. Electron's file watcher detects the change (< 1 second)
4. IPC event fires: `tracker:updated`
5. React store updates via `setTracker()`
6. The Task Board card slides from TO DO to IN PROGRESS — live, no refresh

This works because:
- Electron's `fs.watch()` monitors the tracker file
- The watcher debounces internal writes (ignores changes within 1 second of dashboard-initiated writes, so it doesn't echo its own changes)
- External changes (from MCP agents) pass through immediately
- The React store diffs the state and re-renders only affected components

---

## Visual Design

**Dark theme (default):**
- Background: `#0A0A10` (near black)
- Surface: `#111118`
- Accent: `#585CF0` (purple)
- Text: white
- Status colors: green (on-track/done), amber (review), red (behind/blocked), purple (in-progress)

**Typography:**
- UI text: Inter
- Code/IDs/numbers: JetBrains Mono

**Components:** Tailwind CSS, custom scrollbars, 6-8px rounded corners, 4px grid spacing.

**Tab icons:** Unicode symbols — hexagon for Swim Lane, grid for Task Board, lightning bolt for Agent Hub.

---

## Key Technical Decisions

1. **JSON file, not a database** — the tracker is a plain JSON file in the repo. This means it's version-controlled, diff-able, and readable by any tool. No database server to manage.

2. **MCP as the agent interface** — instead of building a REST API, the command center uses the Model Context Protocol. This means any AI agent that supports MCP (Claude Code, Codex CLI, or custom agents) can plug in without any integration code.

3. **File watcher for real-time** — instead of WebSockets or polling, the dashboard watches the file system. When an agent writes to the tracker, the dashboard sees it instantly. Simple and reliable.

4. **Parser preserves state** — the roadmap is maintained as a markdown file. Re-parsing it regenerates the tracker structure but preserves all existing progress, assignments, and agent data. This means you can edit the roadmap and re-parse without losing work.

5. **Context assembly in the MCP server** — agents don't read raw JSON. The MCP server assembles rich, markdown-formatted briefing documents that include everything an agent needs. Two tiers: `get_task_context` (full briefing, ~8K tokens) and `get_task_summary` (slim, ~500 tokens).

6. **Provider-agnostic by design** — Claude and Codex both write to the same tracker using the same tools and action names. The dashboard doesn't know or care which provider performed an action. A task prepared by Claude can be built by Codex and vice versa.
