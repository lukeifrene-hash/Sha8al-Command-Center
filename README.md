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

## Available Commands

| Command | Syntax | What it does | Best time to use it |
| --- | --- | --- | --- |
| [`next`](docs/task-workflow.md#read-only-status-next) | `next` `\|` `next <tier>` `\|` `next M<N>` | Shows what is actionable right now, grouped by tier | First command in a session |
| [`sweep`](docs/task-workflow.md#sweep-sweep-mn-tier) | `sweep M<N> <tier>` | Executes all unblocked tasks for one milestone tier, wave by wave | When ready `small` work is available |
| [`prepare`](docs/task-workflow.md#prepare-prepare-mn-tier--prepare-mn-all--prepare-tid) | `prepare M<N> <tier>` | Enriches a milestone batch before implementation | Before building `medium` work |
| [`prepare`](docs/task-workflow.md#prepare-prepare-mn-tier--prepare-mn-all--prepare-tid) | `prepare M<N> all` | Prepares every non-small task in a milestone while keeping medium-vs-large prep depth intact | When you want one prep pass across the full non-small queue |
| [`prepare`](docs/task-workflow.md#prepare-prepare-mn-tier--prepare-mn-all--prepare-tid) | `prepare T<id>` | Enriches one larger task with deeper context | Before building a `large` or `architectural` task |
| [`build`](docs/task-workflow.md#build-build-mn-tier--build-tid) | `build M<N> <tier>` | Executes prepared milestone work in dependency order | After a milestone batch has been prepared |
| [`build`](docs/task-workflow.md#build-build-mn-tier--build-tid) | `build T<id>` | Executes one prepared task | When a single prepared task is the right unit of work |
| [`auto`](docs/task-workflow.md#autonomous-milestone-run-auto-mn) | `auto M<N>` | Composes `sweep` and `build` across waves until a natural stop | When you want autonomous multi-wave progress |
| [`audit`](docs/task-workflow.md#milestone-audit-audit-mn) | `audit M<N>` | Runs the milestone-level audit | After milestone execution is complete |
| [`approve`](docs/task-workflow.md#approve-tid) | `approve T<id>` | Manually moves a reviewed task to `done` | Rare explicit override |
| [`audit --cross`](docs/task-workflow.md#audit-tid---cross) | `audit T<id> --cross` | Runs a cross-model second-opinion audit on one task | High-risk task verification |

## How The Commands Work Together

```text
┌──────────────┐
│     next     │  Read-only view of what is unblocked now
└──────┬───────┘
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
┌──────────────┐              ┌─────────────────────┐
│ sweep M<N>   │              │ prepare M<N> / T<id>│
│ small tier   │              │ tier / all / task   │
└──────┬───────┘              └──────────┬──────────┘
       │                                  │
       │ same-wave tasks                  │ builder prompt +
       │ may run in parallel              │ enriched context
       ▼                                  ▼
┌────────────────────────────────────────────────────┐
│                build M<N> / T<id>                 │
│ execute prepared work -> validate -> review       │
└──────────────────────────┬─────────────────────────┘
                           │
                           ▼
                 ┌──────────────────────┐
                 │ auditor + lane rules │
                 │ auto-approve or stop │
                 └──────────┬───────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
  next wave opens     review stop        audit fail stop
  and work continues  operator checks    fix before moving on
         │
         ▼
┌────────────────────────────────────────────────────┐
│ auto M<N> repeats the loop until a natural stop:  │
│ no unblocked work | pair/human task | unprepared  │
│ higher-tier task | review gate | audit fail       │
└──────────────────────────┬─────────────────────────┘
                           │
                           ▼
                     ┌────────────┐
                     │ audit M<N> │
                     │ milestone  │
                     │ review     │
                     └────────────┘
```

Waves control execution order. Tiers control how work is handled. `small` work is swept directly; `medium`, `large`, and `architectural` work go through `prepare` before `build`. `prepare M<N> all` is the convenience wrapper for prepping every non-small task in one pass.

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
