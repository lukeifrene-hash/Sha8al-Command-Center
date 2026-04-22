# Phase 2 Execution Plan

This document converts the accepted Phase 2 planning docs into an execution sequence for the implementation work that follows Phase 2.

It does not authorize immediate cutover by itself.
Use it together with:
- [Public Boundary](public-boundary.md)
- [TalkStore Coupling Audit](talkstore-coupling-audit.md)
- [Cutover Checklist](cutover-checklist.md)
- [Profile System Design](profile-system-design.md)
- [Naming Transition Plan](naming-transition-plan.md)
- [OSS Packaging Checklist](oss-packaging-checklist.md)
- [Validation Matrix](validation-matrix.md)
- [External Example Plan](external-example-plan.md)

## Purpose

Phase 2 established the target platform model and the cutover constraints. This document defines:
- the target end state for `sha8al-command-center`
- the implementation phases after Phase 2
- the safest execution order
- hard stop conditions between phases
- dependencies between phases
- which work is additive versus which work requires coordinated cutover

## Target End State

The target end state is a public platform named `sha8al-command-center` with TalkStore preserved as a compatibility consumer profile rather than the platform identity.

At completion:
- the repo, app, MCP package, and primary CLI identity are `sha8al-command-center`
- runtime, MCP, scripts, and bootstrap all resolve the active consumer profile through the same explicit contract
- `generic` is the public default profile for fresh external installs
- `talkstore` remains supported as a compatibility profile during the compatibility window
- fresh installs do not depend on `TALKSTORE_PROJECT_ROOT`, `talkstore-tracker.json`, or sibling `../talkstore` inference
- TalkStore-specific names, paths, playbooks, and aliases are documented as compatibility surfaces only
- external users can install and run the platform without access to the TalkStore repo
- legacy TalkStore heuristics are removed only after the compatibility window, validation, and rollback preparation are complete

## Execution Principles

- Keep the public boundary stable while moving TalkStore-specific behavior behind the `talkstore` profile.
- Prefer additive introduction of new public surfaces before switching defaults or removing legacy ones.
- Treat runtime resolution, MCP resolution, and script/bootstrap resolution as one coupled system.
- Do not perform naming cutover, runtime cutover, or legacy cleanup in the same step.
- Require explicit rollback notes before any phase that changes defaults, package identity, or compatibility behavior.

## Major Phases After Phase 2

### Phase 3: Shared Profile Resolution Foundation

Objective:
- introduce the shared consumer-profile contract across runtime, MCP, scripts, and bootstrap
- encode `generic` and `talkstore` as explicit profiles
- preserve all current TalkStore behavior behind the `talkstore` compatibility profile

Primary outputs:
- one shared profile-resolution model
- one resolution order used in `src/main/config.ts`, `mcp-server/src/tracker.ts`, `scripts/lib/project-paths.mjs`, and bootstrap flows
- explicit profile metadata sufficient to describe tracker naming, docs paths, parser support, and CLI aliases

Classification:
- additive

Depends on:
- accepted Phase 2 boundary, coupling, and cutover docs

Phase exit gate:
- the same project resolves to the same profile across runtime, MCP, and scripts
- `generic` can exist without TalkStore heuristics
- existing TalkStore installs still resolve through `talkstore`

### Phase 4: Public Bootstrap and External Install Path

Objective:
- make fresh setup profile-first instead of TalkStore-first
- establish the public external install path without requiring naming cutover yet

Primary outputs:
- bootstrap writes explicit profile configuration
- `.env.example` and setup docs lead with `COMMAND_CENTER_*` and profile selection
- fresh external installs succeed with the `generic` profile and no hidden TalkStore assumptions

Classification:
- additive

Depends on:
- Phase 3 shared profile resolution

Phase exit gate:
- a new external project can boot the platform without `TALKSTORE_PROJECT_ROOT`
- setup does not require `talkstore-tracker.json`
- operator docs no longer present TalkStore as the default product identity

### Phase 5: Public Naming Introduction and Compatibility Window

Objective:
- introduce the public `sha8al-command-center` identity while retaining TalkStore compatibility entrypoints
- begin the compatibility window for package, CLI, and operator naming

Primary outputs:
- public-facing docs lead with `sha8al-command-center`
- CLI help, bootstrap output, and package metadata expose the public names
- TalkStore names remain available as compatibility aliases where required

Classification:
- mixed

Additive portion:
- docs, help text, bootstrap messaging, and alias expansion that add public names without removing legacy ones

Cutover portion:
- package identity changes, primary binary changes, and release metadata changes that affect how users install or invoke the platform

Depends on:
- Phase 4 external install path
- rollback notes for naming changes

Phase exit gate:
- new users see `sha8al-command-center` first
- existing TalkStore operators still have a documented working path
- both naming paths are validated before any legacy naming is removed

### Phase 6: Runtime and MCP Default Cutover

Objective:
- make explicit profile resolution the default operating model
- demote TalkStore inference to compatibility fallback only during the remaining compatibility window

Primary outputs:
- runtime and MCP prefer explicit profile selection
- compatibility inference is isolated, documented, and measurable
- validation covers both fresh external installs and live TalkStore flows

Classification:
- requires cutover

Depends on:
- Phase 3 profile contract
- Phase 4 external install readiness
- Phase 5 naming compatibility window in place
- rollback steps documented and reviewed

Phase exit gate:
- fresh installs work without TalkStore heuristics
- TalkStore still works through the compatibility profile
- no surface still treats TalkStore-first inference as the primary default

### Phase 7: Legacy Inference Removal and Cleanup

Objective:
- remove temporary compatibility inference after the compatibility window closes
- leave TalkStore support only where intentionally retained as a documented compatibility surface

Primary outputs:
- sibling `../talkstore` inference removed
- `TALKSTORE_PROJECT_ROOT` demoted to compatibility alias only or removed if explicitly approved
- legacy tracker filename preference removed unless intentionally preserved as a compatibility alias
- docs and release notes reflect the final public platform posture

Classification:
- requires cutover

Depends on:
- Phase 6 cutover stability over the agreed compatibility window
- explicit decision on which TalkStore aliases remain supported
- migration and rollback guidance already published

Phase exit gate:
- no hidden TalkStore-only heuristics remain in the platform default path
- retained compatibility aliases are intentional and documented
- final validation passes for the supported profile set

## Safe Execution Order

Execute the work in this order and do not collapse adjacent phases into one PR unless every affected surface is already proven equivalent:

1. build the shared profile-resolution layer first
2. make bootstrap and fresh-install flows explicit-profile-first
3. introduce public naming while legacy names still work
4. switch runtime and MCP defaults to explicit profile resolution
5. remove compatibility inference only after the compatibility window and validation are complete

The key safety rule is that additive work comes before behavioral cutover. Public names must exist before they become primary. Explicit profiles must work before TalkStore-first inference stops being the default. Rollback notes must exist before any switch in default behavior or package identity lands.

## Phase Dependencies

| Phase | Requires | Why |
| --- | --- | --- |
| 3 | Accepted Phase 2 docs | The profile contract has to align with the approved boundary and cutover model. |
| 4 | Phase 3 complete | Bootstrap cannot write stable explicit config until profile resolution is shared. |
| 5 | Phase 4 complete | Public naming should follow a working external install story, not precede it. |
| 6 | Phases 3-5 complete | Default cutover is unsafe until profiles, install flow, and public naming all work together. |
| 7 | Phase 6 stable through compatibility window | Legacy removal must be the last move, not part of initial cutover. |

## Hard Stop Conditions

Stop the rollout and do not advance to the next phase if any of the following are true:

- runtime, MCP, and script/bootstrap surfaces resolve different profiles for the same project
- `generic` still depends on TalkStore-only heuristics such as sibling `../talkstore` discovery
- a fresh external install still requires `TALKSTORE_PROJECT_ROOT`, `talkstore-tracker.json`, or TalkStore repo structure
- a package rename or primary CLI rename would remove the current TalkStore path before dual-path validation is complete
- the live TalkStore compatibility path fails during transition-window validation
- rollback steps are missing for a naming change, default-resolution switch, or legacy heuristic removal
- docs, help text, or bootstrap output still present TalkStore as the platform identity after the naming-introduction phase begins
- a proposed change combines additive setup, default switch, and legacy removal into one unreviewable cutover step

## Additive Work vs Cutover Work

### Additive Work

The following work should land before cutover because it adds capability without removing current behavior:
- defining shared profile objects and explicit resolution rules
- adding the `generic` public profile
- keeping TalkStore behavior behind the `talkstore` profile
- updating bootstrap to write explicit profile config
- updating docs and examples to lead with public profile-first setup
- adding public CLI names or docs aliases while old names still work
- adding deprecation messaging, migration notes, and validation coverage

### Requires Coordinated Cutover

The following work changes defaults, identity, or compatibility posture and should only happen after earlier gates pass:
- changing package names or published install identities
- changing the primary CLI name or package `bin` contract
- switching runtime and MCP surfaces away from TalkStore-first default inference
- removing sibling `../talkstore` discovery
- removing or demoting `TALKSTORE_PROJECT_ROOT` beyond the documented compatibility window
- removing preference for `talkstore-tracker.json` when that affects existing installs
- deleting legacy docs, aliases, or examples that existing TalkStore operators still depend on

## Recommended PR Boundaries

- One PR for Phase 3 shared profile resolution.
- One PR for Phase 4 bootstrap and external install flow.
- One PR for additive Phase 5 naming introduction.
- One PR for Phase 6 default-resolution cutover.
- One final cleanup PR for Phase 7 legacy removal.

If a phase touches runtime, MCP, and scripts together, keep those changes in the same PR so the resolution contract does not drift between surfaces.

## Completion Criteria

This execution plan is complete when it is used as the sequencing document for implementation and every later phase can point to:
- its prerequisite phase
- its additive versus cutover classification
- its exit gate
- its hard stop conditions
- its rollback expectation

The implementation is complete only when the target end state is true and the platform no longer depends on hidden TalkStore-first defaults for fresh installs.
