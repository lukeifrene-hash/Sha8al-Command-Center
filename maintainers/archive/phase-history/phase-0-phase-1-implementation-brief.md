# Phase 0 + Phase 1 Implementation Brief

This brief is the durable source of truth for the script-side parser and CLI safety rollout in Talkstore Command Center. It applies only to `package.json`, `scripts/*`, `scripts/lib/*`, `README.md`, `.env.example`, and operator-facing docs that describe those entrypoints.

## Hard Scope Boundary

- Phase 0 is limited to parser and CLI safety.
- Do not modify runtime, UI, or MCP tracker write behavior as part of this brief.
- The following files are explicitly out of scope for Phase 0 implementation:
  - `src/main/index.ts`
  - `src/main/config.ts`
  - `mcp-server/src/tracker.ts`
  - `src/renderer/store.ts`
  - any other runtime or MCP tracker write path
- Safety claims in this brief apply only to the script wrappers under `scripts/*`.

## Live Repo Safety Rules

- The live TalkStore repo is `/Users/luqman/Desktop/Projects/talkstore`.
- The live tracker file is `/Users/luqman/Desktop/Projects/talkstore/talkstore-tracker.json`.
- Against the live TalkStore repo: dry-run only.
- No real write is allowed to the live tracker during Phase 0 validation.
- Any real write-path validation must happen only in a temp sandbox under `/tmp`.
- Before any change or command, ask: "Will this break the live TalkStore Command Center right now?"
  - If no, proceed.
  - If maybe, hard stop and report.

## Canonical Command Matrix

- Guard inspection:
  - `npm run tracker:guard:status`
- TalkStore parser using `docs/tasks.md`:
  - `npm run tracker:parse:talkstore-tasks`
  - `npm run tracker:parse:talkstore-tasks:dry-run`
- TalkStore parser using legacy `docs/roadmap.md` inputs:
  - `npm run tracker:parse:talkstore-roadmap`
  - `npm run tracker:parse:talkstore-roadmap:dry-run`
- ACI parser using `Brainstorming & Pivot/ROADMAP.md`:
  - `npm run tracker:parse:aci-roadmap`
  - `npm run tracker:parse:aci-roadmap:dry-run`
- ACI checklist seeder:
  - `npm run tracker:seed:aci`
  - `npm run tracker:seed:aci:dry-run`

There is no generic `tracker:parse` default. Parser source selection must be explicit per command or explicit env override.

## Phase 0

Phase 0 locks down operator-visible behavior and the script-side safety model before any broader implementation is treated as complete.

### Required Deliverables

- `docs/phase-0-phase-1-implementation-prompt.md` is this durable brief, not a one-line kickoff.
- `package.json` exposes only explicit parser commands.
- `scripts/lib/project-paths.mjs` removes silent fallback between `docs/tasks.md` and `docs/roadmap.md`.
- `scripts/lib/project-paths.mjs` removes the silent ACI fallback to `docs/roadmap.md`.
- Script-side tracker writes create a backup before any real write.
- Parser and profile validation fail before write on the wrong parser, wrong profile, or wrong explicit source.
- `README.md` and `.env.example` document the explicit command matrix and do not instruct operators to run a generic parser command.

### Acceptance Criteria

- An operator can determine the tracker target before any write attempt.
- An operator must choose an explicit parser/source combination.
- Dry-run and real-write code paths share the same parser logic.
- Live TalkStore dry-runs do not mutate the live tracker.
- Real write-path validation can be proven safely in `/tmp`.

## Phase 1

Phase 1 is the future implementation work that builds on the explicit safety model above. It must not start until Phase 0 is fully validated.

### Current Phase 1 Goals

- create the public boundary doc
- create the TalkStore coupling audit
- create the cutover checklist
- define TalkStore as a consumer profile, not the platform identity
- keep live TalkStore wiring unchanged while the boundary and cutover docs are written

### Current Deliverables

- `docs/public-boundary.md`
- `docs/talkstore-coupling-audit.md`
- `docs/cutover-checklist.md`
- docs updates that frame TalkStore as a compatibility profile instead of the platform identity
- carry-forward cleanup: `scripts/apply-dependency-analysis.mjs` adopts the same backup-before-write and profile-aware script safety model as the other tracker-writing scripts

### Required Behavior

- `scripts/parse-markdown.mjs` supports explicit TalkStore source selection only through `docs/tasks.md` or `docs/roadmap.md`.
- `scripts/parse-aci-roadmap.mjs` requires `Brainstorming & Pivot/ROADMAP.md` explicitly and never falls back to `docs/roadmap.md`.
- `scripts/lib/profile-validators.mjs` stamps parser metadata into `project` and rejects mismatched parser/profile/source combinations before write.
- `scripts/lib/tracker-backup.mjs` creates a backup in `.command-center-backups/` before a real tracker write.
- `scripts/seed-aci-checklist.mjs` validates the existing tracker profile before writing and uses the same backup path.
- `scripts/apply-dependency-analysis.mjs` validates the existing tracker profile before writing and uses the same backup path.
- `tracker:guard:status` reports the resolved project root, tracker path, and current script-side write allowance.

### Validation Requirements

- `npm run build`
- `cd mcp-server && npm run build`
- Every parser command in dry-run mode against the live TalkStore repo
- One intentional parser/profile mismatch that fails non-zero
- One temp-sandbox real write test under `/tmp` that proves backup-before-write works
- Proof that the live TalkStore repo was not modified
- Proof that `/Users/luqman/Desktop/Projects/talkstore/talkstore-tracker.json` was not written

## Non-Goals

- Broad repository-wide write guards
- Claims about protections in Electron IPC, renderer state, or MCP tracker writes
- Any runtime or UI mutation path changes as part of Phase 0

## Phase 2

Phase 2 is the implementation-ready planning pass for the public repo transition. It is docs-only first and must not execute the cutover yet.

### Current Phase 2 Goals

- define the target profile system shape
- define the runtime, MCP, and config cutover plan from TalkStore-first compatibility to explicit profile resolution
- define the public naming transition to `sha8al-command-center`
- define the OSS packaging checklist
- define the validation matrix for fresh external installs getting the same command center experience

### Current Deliverables

- `docs/phase-2-execution-plan.md`
- `docs/profile-system-design.md`
- `docs/naming-transition-plan.md`
- `docs/oss-packaging-checklist.md`
- `docs/validation-matrix.md`
- `docs/external-example-plan.md`

### Hard Phase 2 Constraints

- do not execute the cutover yet
- do not rename runtime packages yet
- do not change live TalkStore wiring yet
- produce the Phase 2 plan as docs only first
