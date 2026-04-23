# Quickstart Walkthrough

This walkthrough is the shortest beginner path for learning Sha8al Command Center with a real sample project.

It uses the public `generic` profile, a tiny roadmap, and the built-in agent roles:

- `codex` or `claude_code`: the main orchestrator you talk to
- `explorer`: codebase and file-pattern discovery during `prepare`
- `researcher`: external docs and reference lookup during `prepare`
- `auditor`: the task-level audit that runs after non-small `build`
- `milestone-*` auditors: the specialist milestone audit fan-out used by `audit`

## What MCP Means Here

MCP is the tool bridge between the agent and the project state.

In this repo, the MCP server is the part that lets an agent such as `codex` or `claude_code` do real workflow actions instead of only chatting about them. The agent uses MCP tools to:

- read what task is ready next
- claim a task safely
- compute milestone waves
- enrich a task during `prepare`
- move a task to `review`
- submit audit results
- run milestone audits

That is why the system can support real orchestration. The dashboard shows the tracker state, while MCP is the control surface that agents use to read and update that state.

## How Codex Uses MCP

Think of the roles like this:

- `codex` or `claude_code` is the orchestrator you talk to
- the orchestrator calls MCP tools to inspect and update the tracker
- the orchestrator can spawn specialist agents such as `explorer`, `researcher`, and `auditor`
- those specialist agents also report back through MCP-backed workflow steps

Simple example:

1. You type `next`.
2. `codex` calls the MCP tool that returns actionable tasks.
3. You type `prepare M1 all`.
4. `codex` coordinates `explorer` and `researcher`, writes prompt files, and stores the prompt path back through MCP.
5. You type `auto M1`.
6. `codex` keeps moving the milestone forward with MCP-backed task claims, completions, and audits until a natural stop.

## MCP Tools New Users Should Know

You do not usually call these directly at first, but they are the engine under the command layer:

- `get_next_actionable_tasks`
- `compute_waves`
- `claim_next_task`
- `bulk_prepare`
- `get_task_context`
- `enrich_task`
- `complete_task`
- `request_audit`
- `submit_audit`
- `start_milestone_audit`
- `submit_milestone_audit`

## Use This Sample Project

Use [examples/quickstart-sample-project/README.md](../examples/quickstart-sample-project/README.md) with these source files:

- [examples/quickstart-sample-project/docs/roadmap.md](../examples/quickstart-sample-project/docs/roadmap.md)
- [examples/quickstart-sample-project/docs/manifesto.md](../examples/quickstart-sample-project/docs/manifesto.md)
- [examples/quickstart-sample-project/docs/submission-checklist.md](../examples/quickstart-sample-project/docs/submission-checklist.md)

The roadmap is intentionally small, but it still contains both `small` and `medium` work so new users can see:

- `sweep` for ready small tasks
- `prepare` using `explorer` and `researcher`
- `build` followed by the `auditor`
- `audit` for milestone closeout

## Fastest First Run

From the repo root:

```bash
npm run bootstrap -- --project ./examples/quickstart-sample-project
npm run tracker:guard:status
npm run tracker:parse:project-tasks:dry-run
npm run tracker:parse:project-tasks
npm run dev
```

That gives you:

- a generated `.env` pointed at the sample project
- a profile check before writing anything
- a parser dry run against `docs/roadmap.md`
- a real tracker write
- the desktop app for visual verification

## Full MCP Binding Setup

This is the full setup that binds the agent, the MCP server, and the Electron app together without hardcoded machine-specific paths.

The important rule is simple:

- the MCP server and the Electron app must point at the same project root
- both must read and write the same tracker file

For the sample walkthrough, that project root is:

```text
./examples/quickstart-sample-project
```

### Step 1: Build the MCP server

From the repo root:

```bash
cd mcp-server
npm install
npm run build
cd ..
```

### Step 2: Start the Electron app

Use your normal app launcher for your platform, or run:

```bash
npm run dev
```

Then choose or confirm the sample project folder inside the app:

```text
./examples/quickstart-sample-project
```

The Electron app watches the tracker file for changes and updates live when the MCP server changes task state.

### Step 3: Bind Codex to the MCP server

Codex uses TOML for MCP config. Add a project-scoped config at:

```text
.codex/config.toml
```

Use a repo-relative setup like this:

```toml
[mcp_servers.sha8al_command_center]
command = "node"
args = ["mcp-server/dist/index.js"]
cwd = "."
required = true
startup_timeout_sec = 20

[mcp_servers.sha8al_command_center.env]
COMMAND_CENTER_PROJECT_ROOT = "./examples/quickstart-sample-project"
COMMAND_CENTER_PROFILE = "generic"
```

Why this works:

- `cwd = "."` keeps the server launch relative to the repo root
- `COMMAND_CENTER_PROJECT_ROOT` points the MCP server at the sample project instead of a hardcoded absolute path
- `COMMAND_CENTER_PROFILE = "generic"` keeps the walkthrough on the public path

### Step 4: Bind Claude Code to the same MCP server

Claude Code uses project-scoped JSON config instead of TOML. Add this file at the repo root:

```text
.mcp.json
```

```json
{
  "mcpServers": {
    "sha8al-command-center": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "COMMAND_CENTER_PROJECT_ROOT": "./examples/quickstart-sample-project",
        "COMMAND_CENTER_PROFILE": "generic"
      }
    }
  }
}
```

If you prefer the Claude Code CLI, run this from the repo root:

```bash
claude mcp add --transport stdio --scope project --env COMMAND_CENTER_PROJECT_ROOT=./examples/quickstart-sample-project --env COMMAND_CENTER_PROFILE=generic sha8al-command-center -- node mcp-server/dist/index.js
```

### Step 5: Understand the live data flow

The connection model is:

1. Codex or Claude Code calls the MCP server.
2. The MCP server reads and writes `command-center-tracker.json` in the target project root.
3. The Electron app watches that tracker file and refreshes automatically.

That means the Electron app is the live dashboard, while MCP is the control surface used by the agent.

### Step 6: Confirm the tools are visible

After the config is loaded, the agent should be able to use the command-center MCP tools.

In this repo, the MCP namespace still uses the compatibility naming surface, so you may see tool ids such as:

- `mcp__talkstore__get_next_actionable_tasks`
- `mcp__talkstore__get_task_context`
- `mcp__talkstore__claim_next_task`
- `mcp__talkstore__complete_task`
- `mcp__talkstore__request_audit`

That naming is expected during the compatibility window.

### Step 7: Start using the command layer

Once the agent is bound to MCP and the Electron app is watching the same sample project, use the operator commands:

```text
next
sweep M1 small
prepare M1 all
auto M1
audit M1
```

As those commands run:

- the agent updates the tracker through MCP
- the Electron app shows the state changes live
- prompt generation, task review, and audits become visible in the dashboard

## Common Binding Mistakes

- If the Electron app looks empty while MCP commands succeed, the app is probably pointed at a different project folder.
- If Codex or Claude Code cannot see MCP tools, the config file is probably missing or the MCP server was not built yet.
- If the MCP server starts but errors about project root, `COMMAND_CENTER_PROJECT_ROOT` is missing or pointed at the wrong folder.
- If you want to use your own project instead of the sample, replace `./examples/quickstart-sample-project` in both the app workspace and the MCP config with your own project root.

## Simplest Command Flow

After the sample tracker exists, use the command layer in Codex or Claude Code:

```text
next
sweep M1 small
prepare M1 all
auto M1
audit M1
```

What each step does:

1. `next` shows what is unblocked right now.
2. `sweep M1 small` clears the ready small task(s) first.
3. `prepare M1 all` asks `explorer` and `researcher` to enrich every non-small task in the milestone and write builder prompts.
4. `auto M1` keeps draining the milestone until it reaches a natural stop.
5. `audit M1` runs the milestone-level closeout audit after the milestone is done.

If your surface expects concrete milestone ids instead of the shorthand `M1`, use the first sample milestone id:

```text
m1_bootstrap_the_sample_project
```

## What New Users Should Watch For

- `prepare` should create prompt files under `docs/prompts/M1/` for prepared tasks.
- `build` should move non-small tasks through `review` and then through the task auditor.
- backend-style audit passes can auto-approve tasks to `done`.
- `audit M1` should produce a milestone report and a state snapshot for the milestone.
- the visible command is simple, but the actual state transition is happening through MCP tools under the hood.

## Why This Is The Recommended Starter

- it uses the public `generic` profile, not the TalkStore compatibility path
- it keeps the source of truth in `docs/roadmap.md`
- it teaches the real operator verbs without requiring a big codebase
- it makes the agent handoffs visible in the smallest practical setup
