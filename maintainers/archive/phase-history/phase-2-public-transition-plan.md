# Phase 2 Public Transition Plan

This document is an earlier Phase 2 planning snapshot kept for background context.

The canonical Phase 2 deliverables are:
- [Phase 2 Execution Plan](phase-2-execution-plan.md)
- [Profile System Design](profile-system-design.md)
- [Naming Transition Plan](naming-transition-plan.md)
- [OSS Packaging Checklist](oss-packaging-checklist.md)
- [Validation Matrix](validation-matrix.md)
- [External Example Plan](external-example-plan.md)

If this file and the canonical Phase 2 deliverables differ, follow the canonical docs.

This document is the implementation-ready plan for Phase 2. It defines the public transition path from TalkStore-first compatibility to an explicit profile-based platform model.

Phase 2 is still planning-only in this document.
Do not execute the cutover yet.
Do not rename runtime packages yet.
Do not change live TalkStore wiring yet.

## Objectives

Phase 2 must define:
- the target profile system shape
- the runtime, MCP, and config cutover plan from TalkStore-first compatibility to explicit profile resolution
- the public naming transition to `sha8al-command-center`
- the OSS packaging checklist
- the validation matrix for fresh external installs

## Hard Non-Goals

- no runtime cutover in this phase
- no package rename in this phase
- no CLI rename in this phase
- no live TalkStore `.mcp.json` changes in this phase
- no removal of `TALKSTORE_PROJECT_ROOT`, `talkstore-tracker.json`, or the `talkstore` CLI alias in this phase

## Target Profile System Shape

Phase 2 should introduce one explicit platform concept: a consumer profile.

### Canonical platform concepts

- `platform`
  - the reusable Command Center codebase, runtime, MCP server, scripts, and tracker schema
- `consumer profile`
  - a named configuration bundle that defines how a specific project experiences the platform
- `compatibility alias`
  - a legacy name, env var, filename, or CLI alias retained during cutover

### Required profile model

Each profile should define:
- `id`
  - stable machine id, for example `talkstore` or `generic`
- `display_name`
  - operator-facing label
- `kind`
  - `compatibility`, `public`, or `internal`
- `root_resolution`
  - how project root is discovered
- `tracker`
  - default tracker filename and compatibility aliases
- `docs`
  - default tasks/checklist/manifesto/roadmap paths
- `playbook`
  - optional mirrored playbook root
- `parser_profiles`
  - which parser profiles the consumer supports
- `cli`
  - primary public CLI name plus compatibility aliases
- `packaging`
  - whether the profile is bundled in OSS releases or documented only

### Required initial profiles

`talkstore`
- kind: `compatibility`
- keeps existing live wiring intact
- preserves `TALKSTORE_PROJECT_ROOT`
- preserves `talkstore-tracker.json`
- preserves sibling `../talkstore` fallback during the compatibility window
- preserves the `talkstore` CLI alias during the compatibility window

`generic`
- kind: `public`
- becomes the default profile for fresh external installs
- uses `COMMAND_CENTER_PROJECT_ROOT`
- prefers `command-center-tracker.json`
- does not assume a TalkStore playbook mirror
- does not infer sibling `../talkstore`

Potential later profiles:
- `aci`
  - remains a parser profile and may later become a consumer profile if the project needs its own runtime conventions

## Explicit Profile Resolution Order

Phase 2 implementation should move every runtime surface to the same resolution order:

1. explicit process env `COMMAND_CENTER_PROFILE`
2. persisted project-local config written by bootstrap
3. explicit profile field stamped in tracker metadata, if trustworthy for that surface
4. compatibility inference only as a fallback during the transition window
5. fail with a clear error instead of guessing once the transition window ends

### Transition-window compatibility inference

Only during the compatibility window:
- if `TALKSTORE_PROJECT_ROOT` is set, resolve `talkstore`
- if the target tracker filename is `talkstore-tracker.json`, resolve `talkstore`
- if the resolved project root is sibling `../talkstore`, resolve `talkstore`

Fresh external installs should never depend on these heuristics.

## Runtime / MCP / Config Cutover Plan

The cutover must happen in layers, not as one rename.

### Layer 1: shared profile resolution

Target files:
- `src/main/config.ts`
- `mcp-server/src/tracker.ts`
- `scripts/lib/project-paths.mjs`
- `scripts/bootstrap.mjs`

Implementation target:
- introduce a shared profile-resolution contract
- keep existing TalkStore behavior behind the `talkstore` compatibility profile
- add a public `generic` profile for fresh installs

Exit condition:
- all three surfaces resolve the same profile for the same project

### Layer 2: project bootstrap and persisted config

Target files:
- `scripts/bootstrap.mjs`
- `.env.example`
- `README.md`

Implementation target:
- bootstrap writes explicit public profile configuration for new installs
- bootstrap can still emit TalkStore-compatible config when asked
- docs lead with profile selection instead of TalkStore-specific assumptions

Exit condition:
- fresh external setup can be completed without any TalkStore-specific env vars or filenames

### Layer 3: runtime and MCP adoption

Target files:
- `src/main/config.ts`
- `mcp-server/src/tracker.ts`
- `mcp-server/src/cli.ts`
- `mcp-server/package.json`

Implementation target:
- runtime and MCP surfaces use explicit profile resolution first
- TalkStore remains a compatibility profile, not the implicit default
- the compatibility window preserves existing aliases and filenames

Exit condition:
- fresh installs and TalkStore installs both work, but through explicit profile resolution

### Layer 4: deprecation messaging

Target files:
- `README.md`
- `.env.example`
- CLI help text
- bootstrap output

Implementation target:
- document compatibility aliases as legacy
- tell operators what the public names are
- provide cutover notes before removing any legacy inference

Exit condition:
- deprecations are visible before behavior changes

## Public Naming Transition

The public naming target is:
- repo-facing identity: `sha8al-command-center`
- npm package identity for the root app: `sha8al-command-center`
- npm package identity for the MCP package: `sha8al-command-center-mcp`
- primary public CLI name: `sha8al-command-center`

### Compatibility window naming rules

During the compatibility window:
- `talkstore-command-center` remains accepted in existing package metadata and docs where needed
- the `talkstore` CLI alias remains available
- operator docs introduce the new public names first and label TalkStore names as compatibility aliases

### Deferred rename steps

Do not execute in this phase, but Phase 2 must prepare for:
- root `package.json` rename
- `mcp-server/package.json` rename
- CLI `bin` expansion to add the new public binary
- README and release docs update
- package publishing metadata and repository links update

## OSS Packaging Plan

Phase 2 packaging work should ship the platform, not a TalkStore-branded private artifact.

See the canonical checklist in [OSS Packaging Checklist](oss-packaging-checklist.md).

Required outcome:
- an external user can install the app and MCP package without needing the TalkStore repo
- TalkStore support remains available as a documented compatibility profile

## Fresh External Install Validation

See the canonical matrix in [Validation Matrix](validation-matrix.md).

Required outcome:
- a fresh external project gets the same command center experience without hidden TalkStore assumptions

## Implementation Sequence

1. add the docs-defined shared profile model
2. add `generic` and `talkstore` profile definitions
3. move bootstrap and docs to explicit profile-first setup
4. add public names and aliases without removing legacy names
5. validate fresh external installs and existing TalkStore installs in parallel
6. only then prepare the actual cutover execution PR

## Exit Criteria

Phase 2 planning is complete when:
- the target profile model is explicit
- the runtime/MCP/config cutover sequence is explicit
- the public naming target is explicit
- the OSS packaging checklist is explicit
- the validation matrix is explicit

Actual cutover execution belongs to the next implementation phase, not this one.
