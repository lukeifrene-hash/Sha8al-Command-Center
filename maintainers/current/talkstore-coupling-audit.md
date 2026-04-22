# TalkStore Coupling Audit

This audit records where the repo is still coupled to TalkStore-specific identity or defaults. It is descriptive, not a cutover patch list.

## Summary

The repo already has a partial platform split:
- generic `COMMAND_CENTER_*` configuration exists
- script-side parser commands are profile-aware
- tracker stamping now distinguishes parser profiles

The remaining TalkStore coupling is still concentrated in naming, compatibility fallbacks, and operator docs.

## Coupling Areas

### 1. Product identity and naming

Files:
- `README.md`
- `package.json`
- `mcp-server/package.json`
- `mcp-server/src/index.ts`

Current state:
- the repo and MCP package still use TalkStore names
- operator-facing copy still assumes TalkStore is the primary identity

Phase 1 action:
- document this as compatibility identity, not platform identity

Deferred cutover:
- package names, CLI branding, and public naming can only change in a coordinated cutover

### 2. Project-root and tracker fallback coupling

Files:
- `src/main/config.ts`
- `mcp-server/src/tracker.ts`
- `scripts/lib/project-paths.mjs`

Current state:
- runtime and MCP code still honor `TALKSTORE_PROJECT_ROOT`
- sibling `../talkstore` remains a fallback root
- `talkstore-tracker.json` remains the legacy-preferred filename when present

Phase 1 action:
- audit only; do not change live runtime wiring

Deferred cutover:
- move these heuristics behind explicit consumer-profile resolution

### 3. Parser and script compatibility coupling

Files:
- `package.json`
- `scripts/parse-markdown.mjs`
- `scripts/lib/project-paths.mjs`
- `scripts/apply-dependency-analysis.mjs`

Current state:
- TalkStore and ACI are already explicit parser profiles
- script-side writes are now backup-protected and profile-aware
- TalkStore command names remain profile-specific for operator clarity

Phase 1 action:
- keep the safety model
- document these commands as profile entrypoints, not the platform identity

### 4. Playbook and docs coupling

Files:
- `playbooks/talkstore/`
- `scripts/check-playbook-sync.mjs`
- `README.md`
- `docs/task-workflow.md`

Current state:
- the mirrored playbook is TalkStore-specific
- drift tooling points at a live TalkStore checkout by default
- several docs use TalkStore examples as if they were universal

Phase 1 action:
- preserve the mirror
- label it as a consumer-specific compatibility artifact

### 5. CLI alias coupling

Files:
- `mcp-server/package.json`
- `mcp-server/src/cli.ts`
- `docs/task-workflow.md`

Current state:
- CLI examples use the `talkstore` binary name
- this is useful for compatibility but still consumer-specific branding

Phase 1 action:
- document the alias as a TalkStore-profile surface

Deferred cutover:
- introduce a generic alias or package name only when compatibility strategy is ready

## Risk Ranking

High:
- runtime sibling-root fallback to `../talkstore`
- runtime preference for `talkstore-tracker.json`
- package and CLI naming that still imply the platform itself is TalkStore

Medium:
- playbook mirror and drift tooling defaulting to TalkStore
- docs that treat TalkStore examples as universal guidance

Low:
- scattered comments and example strings that still mention TalkStore but do not affect behavior

## Phase 1 Exit Condition

Phase 1 is successful when:
- the public boundary is documented
- the coupling points are enumerated
- the cutover path is written down
- the repo docs stop presenting TalkStore as the platform identity

Phase 1 does not require changing the live TalkStore runtime or MCP wiring.
