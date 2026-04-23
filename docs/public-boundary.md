# Sha8al Command Center Public Boundary

This document defines the public platform boundary for Sha8al Command Center (`sha8al-command-center`). It separates stable, reusable platform surfaces from TalkStore-specific compatibility behavior.

## Boundary Statement

Sha8al Command Center (`sha8al-command-center`) is the platform.
TalkStore is a consumer profile that the platform currently supports for compatibility.

That means:
- TalkStore-specific names, paths, and CLI aliases are not the platform identity.
- Existing TalkStore wiring can remain in place while the platform boundary is documented and expanded.
- New platform work should land behind generic names and profile-aware configuration where possible.

## Stable Public Platform Surface

The platform surface that other projects can rely on is:
- A project-root-based tracker model with a JSON state file.
- Script-side parser entrypoints under `package.json` and `scripts/*`.
- Public parser alias names such as `tracker:parse:project-tasks`.
- the public `sha8al-command-center` CLI alias in the MCP package
- The Electron dashboard and MCP server as tracker consumers.
- Generic configuration keys such as `COMMAND_CENTER_PROJECT_ROOT`, `COMMAND_CENTER_TRACKER_FILE`, `COMMAND_CENTER_TASKS_DOC`, and `COMMAND_CENTER_CHECKLIST_DOC`.
- Profile-stamped parser metadata written into `tracker.project`.

Current markdown-parser contract:
- `COMMAND_CENTER_PROFILE` is the consumer-profile switch for public installs.
- The public markdown path runs under parser profile `generic` and stamps `generic-markdown:generic`.
- The TalkStore compatibility path runs under parser profile `talkstore` and stamps `talkstore-markdown:talkstore`.
- Parser/source compatibility stays explicit. Public installs require `docs/roadmap.md`; TalkStore compatibility keeps its own task-source aliases.

## TalkStore Compatibility Surface

The following are compatibility features for the TalkStore consumer profile, not the public platform boundary:
- `TALKSTORE_PROJECT_ROOT`
- `talkstore-tracker.json`
- the sibling `../talkstore` root fallback
- the live TalkStore tracker write guard in script-side tooling
- `playbooks/talkstore/`
- the `talkstore` CLI alias in the MCP package
- the `tracker:parse:talkstore-*` script aliases

These remain supported until cutover work intentionally replaces them.

## Platform vs Consumer Responsibilities

Platform responsibilities:
- define the tracker schema and mutation semantics
- provide parser, CLI, dashboard, and MCP surfaces
- validate profile/source pairing before script-side writes
- preserve compatibility while new profiles are added

Consumer profile responsibilities:
- choose source docs and tracker naming conventions
- provide playbooks, prompts, and domain-specific workflows
- opt into compatibility aliases when needed
- own any project-specific branding or operator language

## Current Profiles

### TalkStore

TalkStore is the current compatibility profile for:
- legacy env aliases
- legacy tracker filename
- mirrored playbook content
- current CLI naming and many operator examples
- compatibility parser aliases

### ACI

ACI is the current parser profile for:
- roadmap parsing from `Brainstorming & Pivot/ROADMAP.md`
- checklist seeding and dependency-analysis scripts
- milestone topology that differs from the TalkStore task parser

ACI parser support does not make ACI the platform identity either. It is another profile-specific surface.

## Rules For New Work

- Do not introduce new platform docs that present TalkStore as the product identity.
- Do not widen TalkStore-only defaults when a generic `COMMAND_CENTER_*` equivalent already exists.
- Keep runtime compatibility in place until the cutover checklist is completed.
- Treat any TalkStore-only behavior as a compatibility layer unless it is explicitly promoted into the public boundary.
