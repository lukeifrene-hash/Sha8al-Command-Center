# Sha8al Command Center

Sha8al Command Center (`sha8al-command-center`) is a tracker-driven desktop app plus MCP/CLI command center for milestone-based project execution. The Electron app shows live project state, the command surface drives autonomous progress, and the tracker keeps operators and agents synchronized.

## Why It's Powerful

- one tracker file is the shared source of truth
- the desktop app visualizes milestone, wave, and review state in real time
- the MCP server and CLI execute the same workflow commands against that state
- the public parser reads `docs/roadmap.md` and auto-sizes tasks into `small`, `medium`, `large`, or `architectural`
- operators stay in control while agents handle repeatable execution
- the system stops at clear checkpoints instead of hiding progress inside chat

## Installation Options

| Option | Best for | Status | What it gives you |
| --- | --- | --- | --- |
| Source install from this repo | New users, contributors, local evaluation | Recommended today | Electron app, MCP server, CLI, scripts, examples, public docs |
| Local MCP/CLI usage after build | Terminal-first workflows and agent execution | Supported today | Built MCP server plus local CLI help and command surface |
| Existing compatibility setup | Legacy installs already using the older wiring | Supported today | Current compatibility path without changing existing setup |

Packaged desktop distribution and broader install surfaces are future work. The validated install path today is source-based.

For the public `generic` path, `docs/roadmap.md` is mandatory. That file is the task source that feeds the swim lane and task board.

## How The Commands Work Together

```text
┌──────────────────────┐
│    docs/roadmap.md   │  task source of truth
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│        next          │  optional read-only check:
│   what is ready?     │  milestone, tier, and wave
└──────────┬───────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│               PREPARATION                  │
│ prepare M<N> all                           │
│ prepare M<N> <tier>                        │
│ prepare T<id>                              │
│                                            │
│ Explorer + Researcher -> prompt + context  │
└──────────┬─────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│                EXECUTION                   │
│ auto M<N>                                  │
│                                            │
│ auto composes:                             │
│ - sweep for ready small work               │
│ - build for prepared non-small work        │
│ - auditor after non-small build            │
└──────────┬─────────────────────────────────┘
           │
           ├──────────────► natural stop
           │                review gate
           │                audit fail
           │                no unblocked work
           │                pair/human-only task
           ▼
┌──────────────────────┐
│      audit M<N>      │  milestone closeout
└──────────────────────┘
```

The main loop is simple: prepare the milestone, then run `auto`. `next` helps you inspect what is ready, and `audit M<N>` closes the milestone after execution. `small` work can be swept directly, but the public operator model revolves around preparing non-small work first and letting `auto` handle execution wave by wave.

## Available Commands

| Command | Syntax | What it does | Best time to use it |
| --- | --- | --- | --- |
| [`prepare`](docs/task-workflow.md#prepare-prepare-mn-tier--prepare-mn-all--prepare-tid) | `prepare M<N> all` | Prepares every non-small task in a milestone in one pass | Main preparation command before autonomous execution |
| [`auto`](docs/task-workflow.md#autonomous-milestone-run-auto-mn) | `auto M<N>` | Runs the milestone autonomously across waves until a natural stop | Main execution command after preparation |
| [`prepare`](docs/task-workflow.md#prepare-prepare-mn-tier--prepare-mn-all--prepare-tid) | `prepare M<N> <tier>` | Prepares one milestone tier instead of the full non-small queue | When you want a narrower prep pass |
| [`prepare`](docs/task-workflow.md#prepare-prepare-mn-tier--prepare-mn-all--prepare-tid) | `prepare T<id>` | Prepares one larger task with focused context and prompt material | When one task needs isolated prep |
| [`next`](docs/task-workflow.md#read-only-status-next) | `next` `\|` `next <tier>` `\|` `next M<N>` | Shows what is actionable right now, grouped by tier | Before prep, before auto, or when checking the next wave |
| [`sweep`](docs/task-workflow.md#sweep-sweep-mn-tier) | `sweep M<N> <tier>` | Executes all unblocked tasks for one milestone tier, wave by wave | When ready `small` work should be cleared directly |
| [`build`](docs/task-workflow.md#build-build-mn-tier--build-tid) | `build M<N> <tier>` | Executes prepared milestone work in dependency order | When you want manual execution instead of `auto` |
| [`build`](docs/task-workflow.md#build-build-mn-tier--build-tid) | `build T<id>` | Executes one prepared task | When one prepared task is the right unit of work |
| [`audit`](docs/task-workflow.md#milestone-audit-audit-mn) | `audit M<N>` | Runs the milestone-level audit | After milestone execution is complete |
| [`approve`](docs/task-workflow.md#approve-tid) | `approve T<id>` | Manually moves a reviewed task to `done` | Rare explicit override |
| [`audit --cross`](docs/task-workflow.md#audit-tid---cross) | `audit T<id> --cross` | Runs a cross-model second-opinion audit on one task | High-risk task verification |

## Quickstart

Install dependencies:

```bash
npm install
cd mcp-server && npm install && cd ..
```

Bootstrap the public example project:

```bash
npm run bootstrap -- --project /absolute/path/to/this-repo/examples/minimal-command-center-project
```

If your project is empty, bootstrap will scaffold `docs/roadmap.md` and `docs/manifesto.md`.

Check the resolved profile, project root, and tracker target:

```bash
npm run tracker:guard:status
```

Dry-run the public parser path first:

```bash
npm run tracker:parse:project-tasks:dry-run
```

Write the tracker after review:

```bash
npm run tracker:parse:project-tasks
```

Start the desktop app:

```bash
npm run dev
```

Build the MCP package and inspect local CLI help:

```bash
cd mcp-server
npm run build
node dist/cli.js help
```

## Profiles

- `generic` is the default public path for fresh external projects.
- The public generic path requires `docs/roadmap.md`; that file drives the swim lane and task board.
- `talkstore` is the compatibility path for existing installs that still use older wiring and aliases.

TalkStore is a compatibility profile.

New users should start with `generic`.

If script-side tooling ever resolves the live sibling tracker, `COMMAND_CENTER_ALLOW_TRACKER_WRITES` exists only for intentional compatibility writes and should not be used for a fresh external project.

## Examples

- [Examples Overview](examples/README.md)
- [Minimal Example Project](examples/minimal-command-center-project/README.md)

The minimal example is the fastest way to see the public flow end to end: bootstrap, guard status, parser dry-run, tracker write, and dashboard usage.

## Documentation

- [Public Boundary](docs/public-boundary.md)
- [Public Naming](docs/public-naming.md)
- [Profiles](docs/profile-system-design.md)
- [Architecture Overview](docs/architecture-overview.md)
- [Task Workflow](docs/task-workflow.md)
- [Three-Phase Task Workflow](docs/three-phase-workflow.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Operator Playbook](playbooks/command-center/README.md)
- [MCP Server README](mcp-server/README.md)

## Compatibility

TalkStore remains a supported compatibility profile.

- existing installs still work
- current compatibility aliases remain available
- new users should use the `generic` path first
