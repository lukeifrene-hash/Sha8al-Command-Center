# Phase 2 Validation Matrix

This file is an earlier Phase 2 planning snapshot.
The canonical validation doc is [Validation Matrix](validation-matrix.md).
If this file differs from the canonical matrix, follow the canonical matrix.

This matrix defines the validation target for the public transition path: a fresh external project should get the same command center experience without hidden TalkStore assumptions.

This is a planning matrix only.

## Core expectation

A fresh external install should be able to:
- install dependencies
- bootstrap a project with an explicit public profile
- resolve tracker and docs without TalkStore-only defaults
- run the parser and dashboard flows successfully
- use the MCP package without a sibling TalkStore checkout

## Matrix

| Scenario | Profile | Expected result |
|---|---|---|
| Fresh external install with explicit public profile | `generic` | Works with no TalkStore env vars, no sibling TalkStore checkout, and public docs only |
| Fresh external install with explicit tracker filename override | `generic` | Same experience, custom tracker path respected |
| Fresh external install with explicit docs overrides | `generic` | Same experience, parser and runtime resolve the overridden docs correctly |
| Existing TalkStore install with current env and tracker naming | `talkstore` | Works unchanged during the compatibility window |
| Existing TalkStore install with explicit `COMMAND_CENTER_PROFILE=talkstore` | `talkstore` | Works unchanged and does not require heuristic inference |
| MCP CLI on a fresh external install | `generic` | Uses the public CLI/package path and resolves project profile explicitly |
| MCP CLI on an existing TalkStore install | `talkstore` | Existing TalkStore alias continues to work during the compatibility window |
| Parser scripts on a fresh external install | `generic` | Dry-run and write flows work with explicit profile/config |
| Parser scripts on live TalkStore repo | `talkstore` | Dry-run/read-only validation only; no live tracker mutation during validation |
| Dashboard startup on a fresh external install | `generic` | App resolves the target project correctly without TalkStore-first inference |

## Required validation buckets

### Install

- clean clone
- install root dependencies
- install MCP dependencies
- bootstrap a fresh external project

### Config resolution

- explicit public profile resolution
- explicit TalkStore compatibility profile resolution
- no sibling TalkStore required for fresh installs
- tracker filename selection behaves as documented

### Parser and scripts

- dry-run parser flows work for public installs
- dry-run parser flows remain safe for live TalkStore validation
- profile mismatch fails clearly
- write paths create backups before mutation

### Runtime and dashboard

- dashboard opens against a fresh external project
- tracker watcher resolves the correct file
- UI behavior matches the existing command center experience

### MCP and CLI

- public package/CLI path works for fresh installs
- TalkStore compatibility alias still works during the transition window
- help text and docs match actual package behavior

## Same Experience Definition

“Same command center experience” means:
- same tracker-driven dashboard behavior
- same task and milestone visibility
- same parser safety expectations
- same MCP capabilities
- no hidden requirement to clone or reference the TalkStore repo unless the TalkStore compatibility profile is intentionally selected

## Exit Rule

The public cutover should not be executed until every scenario in this matrix has a concrete validation procedure and expected output written down in the implementation phase.
