# Task Workflow — Command Reference

## The Flow

```
         PREPARE               START                COMPLETE             APPROVE
TODO ─────────────→ TODO ─────────────→ IN PROGRESS ─────────→ REVIEW ─────────→ DONE
  (enrich prompt,     (begin work)        (agent works)         │
   research,                                                    │ REJECT
   ask questions)                                               ↓
                                         IN PROGRESS ←──────── REVIEW
                                           (agent fixes)        │
                                               │                │ APPROVE
                                               └── COMPLETE ──→ REVIEW ──→ DONE
```

Every task starts as **Todo**. You drive it through the lifecycle using these commands in your Claude Code session. The MCP server updates the tracker, and the Command Center dashboard updates in real-time.

Commands marked with **OPERATOR** are initiated by you. Everything else is handled by the agent automatically.

---

## Commands

### 1. Prepare a Task — **OPERATOR**

> **You say:** "Prepare task `distribution_campaigns_001`"

**What happens:**
- The agent calls `get_task_context` to read the task details, milestone context, CLAUDE.md, and manifesto
- The agent researches the codebase (reads files, searches, web research if needed)
- The agent evaluates how much research is needed based on task complexity
- If the task has ambiguity or design choices, the agent asks you questions
- The agent writes enrichment back to the tracker (acceptance criteria, constraints, context files)
- The task stays in **Todo** — no status change yet

**MCP tools used:**
- `get_task_context(task_id)` — read full context
- `update_task(task_id, ...)` — write notes

**Board:** stays in **Todo** (task is enriched, not started)

---

### 2. Start a Task — **OPERATOR**

> **You say:** "Start task `distribution_campaigns_001`"

**What happens:**
- The agent calls `get_task_context` to get the enriched task (with criteria from the prepare step)
- The agent calls `start_task` → task moves to **In Progress** on the board
- The agent does the actual implementation — writes code, runs tests, etc.
- When finished, the agent calls `complete_task` with a summary → task moves to **Review** automatically

**MCP tools used:**
- `get_task_context(task_id)` — read enriched context
- `start_task(task_id)` — move to In Progress
- `log_action(task_id, action, description)` — log significant events during work
- `complete_task(task_id, summary)` — automatically submits for review when done

**Board:** Todo → **In Progress** → **Review** (automatic when agent finishes)

---

### 3. Give Feedback (Reject) — **OPERATOR**

> **You say:** "The campaign pixels need to respect cookie consent preferences"

The task is in the **Review** column. You've looked at the code and it needs changes.

**What happens:**
- The agent calls `reject_task` with your feedback → task moves back to **In Progress** automatically
- Your feedback is logged in the task's revision history
- The agent addresses your feedback
- When finished, the agent calls `complete_task` again → task moves back to **Review** automatically
- This cycle repeats until you're satisfied

**MCP tools used:**
- `reject_task(task_id, feedback)` — move back to In Progress with your feedback
- `complete_task(task_id, summary)` — automatically resubmits for review when fixes are done

**Board:** Review → **In Progress** → **Review** (repeats until approved)

---

### 4. Complete a Task (Approve) — **OPERATOR**

> **You say:** "Complete task `distribution_campaigns_001`"

The task is in **Review** and the work looks good.

**What happens:**
- The agent calls `approve_task` → task moves to **Done**
- `completed_by` is set to "Luqman", `completed_at` is timestamped
- If this was the last task in the milestone, the milestone's `actual_end` is auto-stamped

**MCP tools used:**
- `approve_task(task_id)` — move to Done

**Board:** Review → **Done**

---

### 5. Block / Unblock a Task

If the agent hits a blocker it can't resolve:

**MCP tools used:**
- `block_task(task_id, reason)` — move to Blocked
- `unblock_task(task_id, resolution)` — move back to Todo or In Progress

**Board:** Any → **Blocked** → Todo/In Progress

---

## Summary: Your 4 Commands

| # | You say | What happens | Board change |
|---|---------|-------------|-------------|
| 1 | **"Prepare task `X`"** | Agent researches, enriches, asks questions | Stays in **Todo** |
| 2 | **"Start task `X`"** | Agent implements, then auto-submits for review | Todo → **In Progress** → **Review** |
| 3 | **"[your feedback]"** | Agent fixes, then auto-resubmits for review | Review → **In Progress** → **Review** |
| 4 | **"Complete task `X`"** | Task is approved and done | Review → **Done** |

---

## Full Tool Reference

### Read Tools (no state changes)

| Command | What it does |
|---------|-------------|
| `get_task_context(task_id)` | Full context: task details, criteria, constraints, milestone, dependencies, CLAUDE.md, manifesto |
| `get_project_status()` | Overall progress, schedule, current week, blocked count |
| `get_milestone_overview(milestone_id)` | Milestone details with all task statuses |
| `list_tasks(milestone_id?, status?, domain?)` | List tasks with optional filters |
| `get_checklist_status()` | Submission checklist progress |
| `get_task_history(task_id)` | Agent log entries for a task |
| `list_agents()` | All registered agents with status |
| `get_activity_feed(agent_id?, limit?)` | Recent activity log |

### Write Tools (update tracker)

| Command | Status change | Who calls it |
|---------|--------------|-------------|
| `start_task(task_id)` | → **in_progress** | Agent (when you say "start task") |
| `complete_task(task_id, summary)` | → **review** | Agent (automatic when work is done) |
| `approve_task(task_id, feedback?)` | → **done** | Agent (when you say "complete task") |
| `reject_task(task_id, feedback)` | → **in_progress** | Agent (when you give feedback) |
| `block_task(task_id, reason)` | → **blocked** | Agent |
| `unblock_task(task_id, resolution?)` | → **todo** or **in_progress** | Agent |
| `update_task(task_id, ...)` | No status change | Either |
| `log_action(task_id, action, description)` | No status change | Agent |
| `toggle_checklist_item(item_id, done)` | No status change | Either |
| `add_milestone_note(milestone_id, note)` | No status change | Either |
| `set_milestone_dates(milestone_id, ...)` | No status change | Either |
| `update_drift(milestone_id, drift_days)` | No status change | Either |
| `register_agent(agent_id, name, type, permissions)` | No status change | Agent |

### CLI Equivalents

Every MCP tool is also available via the `talkstore` CLI:

```bash
talkstore get-task-context distribution_campaigns_001
talkstore start-task distribution_campaigns_001
talkstore complete-task distribution_campaigns_001 "Implemented UTM tracking and pixel installation"
talkstore approve-task distribution_campaigns_001
talkstore reject-task distribution_campaigns_001 "Pixels need cookie consent check"
talkstore block-task distribution_campaigns_001 "Waiting on analytics provider API key"
talkstore unblock-task distribution_campaigns_001 "Got the API key"
```
