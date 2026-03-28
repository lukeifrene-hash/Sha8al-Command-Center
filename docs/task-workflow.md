# Task Workflow — Command Reference

## The Flow

```
TODO ──→ IN PROGRESS ──→ REVIEW ──→ DONE
              ↑              │
              └──── REJECT ──┘
```

Every task starts as **Todo**. You drive it through the lifecycle using these commands in your Claude Code session. The MCP server updates the tracker, and the Command Center dashboard updates in real-time.

---

## Commands

### 1. Prepare a Task

> **You say:** "Prepare task `distribution_campaigns_001`"

**What happens:**
- The agent calls `get_task_context` to read the task details, milestone context, CLAUDE.md, and manifesto
- The agent calls `start_task` → task moves to **In Progress** on the board
- The agent researches the codebase (reads files, searches, web research if needed)
- The agent may ask you questions if the task has ambiguity or design choices
- The agent writes enrichment back to the tracker (acceptance criteria, constraints, context files)

**MCP tools used:**
- `get_task_context(task_id)` — read full context
- `start_task(task_id)` — move to In Progress
- `update_task(task_id, ...)` — write notes, assignee, priority

**Board:** Todo → **In Progress**

---

### 2. Execute a Task

> **You say:** "Execute task `distribution_campaigns_001`"

**What happens:**
- The agent calls `get_task_context` to get the enriched task (with criteria from the prepare step)
- If the task isn't already in progress, the agent calls `start_task`
- The agent does the actual implementation — writes code, runs tests, etc.
- When finished, the agent calls `complete_task` with a summary of what was done

**MCP tools used:**
- `get_task_context(task_id)` — read enriched context
- `start_task(task_id)` — move to In Progress (if not already)
- `log_action(task_id, action, description)` — log significant events during work
- `complete_task(task_id, summary)` — submit for your review

**Board:** In Progress → **Review**

---

### 3. Review a Task

The task is now in the **Review** column. You look at the code, test it, check the agent's work.

#### If it's good:

> **You say:** "Approve task `distribution_campaigns_001`"

**MCP tools used:**
- `approve_task(task_id)` — move to Done

**Board:** Review → **Done**

#### If it needs changes:

> **You say:** "Reject task `distribution_campaigns_001` — the campaign pixels need to respect cookie consent preferences"

**MCP tools used:**
- `reject_task(task_id, feedback)` — move back to In Progress with your feedback

**Board:** Review → **In Progress**

The agent sees your feedback in the task's revision history the next time it calls `get_task_context`. The feedback includes a warning: "Address ALL prior revision feedback before resubmitting."

The agent fixes the issues, then calls `complete_task` again → back to **Review**. This cycle repeats until you approve.

---

### 4. Block / Unblock a Task

If the agent hits a blocker it can't resolve:

**MCP tools used:**
- `block_task(task_id, reason)` — move to Blocked
- `unblock_task(task_id, resolution)` — move back to Todo or In Progress

**Board:** Any → **Blocked** → Todo/In Progress

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
| `start_task(task_id)` | → **in_progress** | Agent |
| `complete_task(task_id, summary)` | → **review** | Agent |
| `approve_task(task_id, feedback?)` | → **done** | You (operator) |
| `reject_task(task_id, feedback)` | → **in_progress** | You (operator) |
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
talkstore start-task distribution_campaigns_001
talkstore complete-task distribution_campaigns_001 "Implemented UTM tracking and pixel installation"
talkstore approve-task distribution_campaigns_001
talkstore reject-task distribution_campaigns_001 "Pixels need cookie consent check"
talkstore block-task distribution_campaigns_001 "Waiting on analytics provider API key"
talkstore unblock-task distribution_campaigns_001 "Got the API key from Luqman"
```
