# Quickstart Sample Project

This sample is the smallest walkthrough project for Sha8al Command Center that still demonstrates the real agent flow.

It is designed for new users who want to learn:

- how `docs/roadmap.md` feeds the tracker
- how the public `generic` profile is bootstrapped
- where `codex` or `claude_code` fit
- when `explorer`, `researcher`, and `auditor` appear

## MCP In One Paragraph

MCP is the tool layer that agents use to operate the tracker safely. In practice, `codex` or `claude_code` reads ready work, prepares tasks, completes tasks, and records audits through MCP tools. The desktop app is the live view of that state, but MCP is what lets the agent actually move the project forward.

## Files

- `docs/roadmap.md`
- `docs/manifesto.md`
- `docs/submission-checklist.md`

## Run It

From the repo root:

```bash
npm run bootstrap -- --project ./examples/quickstart-sample-project
npm run tracker:guard:status
npm run tracker:parse:project-tasks:dry-run
npm run tracker:parse:project-tasks
npm run dev
```

## Agent Walkthrough

Once the tracker is written, the simplest operator flow is:

```text
next
sweep M1 small
prepare M1 all
auto M1
audit M1
```

Use the concrete milestone id `m1_bootstrap_the_sample_project` if you are calling raw CLI or MCP tools that expect the stored tracker id instead of the shorthand `M1`.

## What This Sample Tries To Show

- one milestone is enough to test the parser and dashboard
- one small task is enough to demonstrate `sweep`
- several medium tasks are enough to demonstrate `prepare`, `build`, and the task auditor
- the milestone can still be closed with `audit`

For the longer step-by-step version, read [../../docs/quickstart-walkthrough.md](../../docs/quickstart-walkthrough.md).
