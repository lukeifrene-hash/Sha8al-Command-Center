# Sha8al Command Center Validation Matrix

This document defines the exact validation set for the public transition to Sha8al Command Center (`sha8al-command-center`) while preserving TalkStore as a compatibility profile.

It is implementation-ready planning only.
Do not execute the cutover from this document alone.

## Validation Principles

- validate current TalkStore compatibility and fresh external installs in parallel
- validate runtime, MCP, and script resolution against the same profile contract
- keep live TalkStore validation read-only or dry-run-only until a later execution phase explicitly says otherwise
- require rollback evidence before any default switch, package rename, or heuristic removal

## Matrix Overview

| Area | Scenario | Profile | Expected result |
| --- | --- | --- | --- |
| Compatibility | Existing live TalkStore setup | `talkstore` | Still works unchanged during the compatibility window |
| Fresh install | Clean external project bootstrap | `generic` | Works with no TalkStore-specific env vars, filenames, or sibling repo assumptions |
| Resolution | Explicit public profile selection | `generic` | Runtime, MCP, and scripts all resolve `generic` consistently |
| Resolution | Explicit TalkStore profile selection | `talkstore` | Runtime, MCP, and scripts all resolve `talkstore` consistently |
| Resolution | Compatibility inference path | `talkstore` | Only activates during the compatibility window and never overrides explicit profile selection |
| Safety | Parser/profile mismatch | any | Fails clearly before write |
| Safety | Tracker backup path | any write-capable script | Backup is created before mutation when content changes |
| Release | Publish-readiness gate | mixed | Public package/docs/install path are coherent and rollback-ready |

## Exact Validation Checks

## 1. Current TalkStore Compatibility Still Working

Required checks:

`runtime config compatibility`
- with the current live TalkStore setup, runtime resolves the same project root it resolves today
- runtime still accepts `TALKSTORE_PROJECT_ROOT` during the compatibility window
- runtime still accepts `talkstore-tracker.json` during the compatibility window

`MCP compatibility`
- MCP resolves the same tracker target as runtime
- the `talkstore` CLI alias still works during the compatibility window
- current TalkStore-facing help and invocation flow still function until naming cutover is explicitly executed

`script compatibility`
- TalkStore parser commands still work in dry-run mode
- script-side compatibility rules remain bounded to the documented compatibility window

Evidence required:
- command outputs for runtime/MCP/script resolution
- no live tracker mutation during validation

## 2. Fresh External Project Setup Working

Required checks:

`bootstrap`
- clean project bootstrap works with explicit public profile selection
- no sibling `../talkstore` checkout is required
- no `TALKSTORE_PROJECT_ROOT` env var is required

`tracker`
- the default created tracker filename is `command-center-tracker.json`
- the tracker is placed in the expected external project root

`docs`
- default external docs resolve from the public profile contract
- tasks, checklist, and manifesto docs are found without TalkStore-specific assumptions

Evidence required:
- clean-install walkthrough
- generated config sample
- successful parser dry-run and write in a non-TalkStore example

## 3. Profile Resolution Correctness

Required checks:

`explicit profile precedence`
- `COMMAND_CENTER_PROFILE` always beats compatibility inference
- persisted bootstrap profile always beats compatibility inference

`shared resolution`
- runtime, MCP, and scripts resolve the same consumer profile for the same project
- profile-specific tracker and docs defaults match across all three surfaces

`compatibility guardrails`
- compatibility inference only activates when no explicit profile is present
- `generic` never silently downgrades to `talkstore` because of unrelated filesystem coincidence

Evidence required:
- one table of equivalent inputs and resolved profiles across runtime/MCP/scripts

## 4. Runtime / MCP / Script Path Consistency

Required checks:

`project root consistency`
- each surface resolves the same project root from the same inputs

`tracker path consistency`
- each surface resolves the same tracker filename and path from the same inputs

`docs path consistency`
- runtime, MCP, and scripts agree on tasks/checklist/manifesto defaults for the selected profile

`profile metadata consistency`
- tracker-stamped metadata, when used, does not conflict with explicit profile config

Evidence required:
- one comparison table listing project root, tracker path, and docs paths for each surface

## 5. Parser / Profile Mismatch Failure Behavior

Required checks:

`consumer-profile mismatch`
- scripts fail when the selected parser is not allowed for the selected consumer profile

`source mismatch`
- scripts fail when a source path does not match the command/profile contract

`existing tracker mismatch`
- scripts fail when the existing tracker’s stamped parser/profile metadata conflicts with the requested operation

`error quality`
- failures are clean, non-zero, and operator-readable
- no raw stack traces are emitted in the normal expected-failure path

Evidence required:
- concrete mismatch commands and expected error messages

## 6. Tracker Backup Behavior

Required checks:

`changed write`
- every script-side tracker mutation creates a backup before writing when the target content changes

`unchanged write`
- no backup is created if the target content is unchanged

`dry run`
- dry-run never writes and never creates a backup

`scope`
- backup behavior is verified in temp fixtures only until later execution phases explicitly widen it

Evidence required:
- temp fixture path
- resulting backup path
- final tracker diff summary

## 7. Cutover Rollback Readiness

Required checks:

`naming rollback`
- rollback notes exist for package naming and CLI naming changes

`resolution rollback`
- rollback notes exist for changing default profile resolution behavior

`compatibility rollback`
- rollback notes exist for preserving or reinstating TalkStore aliases if a cutover step fails

Evidence required:
- one rollback checklist per cutover phase

## 8. Publish-Readiness Verification

Required checks:

`repo metadata`
- README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, templates, and release docs are all present

`install path`
- public install docs are coherent for a fresh external user

`examples`
- the external example exists and passes the documented walkthrough

`naming`
- public names and compatibility aliases are documented consistently

Evidence required:
- pre-release checklist signed off against the OSS packaging checklist
- executable publish checks:
  - `npm run check:docs-completeness`
  - `npm run check:example-readiness`
  - `npm run check:public-repo-readiness`
  - `npm run check:publish-readiness`

## Command Expectations By Phase

Before any cutover execution:
- live TalkStore checks stay read-only or dry-run-only
- temp fixtures are used for real writes and backup proofs
- no package rename commands are executed
- no runtime or MCP cutover commands are executed

## Exit Condition

Phase 3 implementation should not begin until every section above has:
- a concrete command or procedure
- a defined expected result
- a documented rollback path where the check guards a cutover step
