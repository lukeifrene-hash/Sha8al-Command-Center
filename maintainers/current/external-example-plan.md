# Sha8al Command Center External Example Plan

This document defines the minimal example project that should ship with the public repo for Sha8al Command Center (`sha8al-command-center`).

It is implementation-ready planning only.

The checked-in scaffold lives at `examples/minimal-command-center-project/` and should be the default public walkthrough in onboarding docs.

## Goal

The example project must prove:
- someone outside the TalkStore environment can install the platform
- bootstrap a project explicitly
- parse docs into a tracker
- open the command center
- understand the tracker-driven model without private repo assumptions

## Example Project Type

The example should be:
- minimal
- local-file based
- documentation-heavy rather than product-heavy
- safe to run without external services

Recommended name:
- `examples/minimal-command-center-project`

## Files The Example Needs

Required files:
- `docs/tasks.md`
- `docs/submission-checklist.md`
- `docs/manifesto.md`
- optional `docs/roadmap.md` only if used to demonstrate explicit override behavior
- an initial README explaining the project scenario

Optional files:
- a starter `command-center-tracker.json` for snapshot-based demos
- sample prompts or playbook snippets if the example needs them

## Experience It Should Demonstrate

The example should demonstrate:
- explicit public profile bootstrap
- parser dry-run
- parser write with backup behavior
- dashboard opening against the generated tracker
- MCP package working against the same project root

Recommended bootstrap order for the public walkthrough:

1. set `COMMAND_CENTER_PROFILE=generic`
2. point `COMMAND_CENTER_PROJECT_ROOT` at `examples/minimal-command-center-project/`
3. bootstrap the project root explicitly
4. dry-run the parser before any write
5. write the tracker
6. open the dashboard

## What Should Be Real vs Mocked

### Real

- real docs files
- real parser flow
- real tracker generation
- real dashboard consumption of the tracker
- real MCP build and local invocation

### Mocked or intentionally simplified

- any product-specific business logic
- external services
- live deployment
- private playbooks
- TalkStore-specific operator conventions

## Success Criteria

The example is successful when a new user can:

1. clone the public repo
2. install dependencies
3. bootstrap the example with the public profile
4. dry-run the parser
5. generate the tracker
6. open the app and see the tracker-driven experience

## Why This Proves The Platform Model

This example proves the public platform model because it removes:
- the sibling TalkStore repo dependency
- the `talkstore-tracker.json` assumption
- the `TALKSTORE_PROJECT_ROOT` assumption
- the TalkStore CLI naming dependency

If the same command center model works here, the platform is no longer implicitly private to TalkStore.

## Required Implementation Notes For Phase 3

When implementation starts:
- create the example under `examples/`
- keep it small enough for fast validation
- make it the default walkthrough in public docs
- ensure it uses the public profile path first
- ensure it does not require any live repo mutation
