# Contributing to sha8al-command-center

Thanks for contributing to the Command Center platform.
Public-facing docs should treat `sha8al-command-center` as the platform identity.
`talkstore` remains a compatibility profile during the transition window for existing installs and workflows.

Please keep contributions focused, reviewable, and aligned with the existing profile model.
If you are reporting a security issue, do not use a public issue or pull request. Follow [SECURITY.md](SECURITY.md) instead.
All contributors are expected to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Local Setup

Install the root app dependencies and the MCP package dependencies:

```bash
npm install
cd mcp-server && npm install && cd ..
```

Use the external example project for generic-profile validation:

```bash
COMMAND_CENTER_PROFILE=generic npm run bootstrap -- \
  --project /absolute/path/to/this-repo/examples/minimal-command-center-project
```

Before writing any tracker data, inspect the resolved profile and target tracker path:

```bash
npm run tracker:guard:status
```

Prefer dry runs before real writes:

```bash
npm run tracker:parse:talkstore-tasks:dry-run
```

## Repo Structure

- `src/main/` contains Electron main-process code, IPC handlers, path resolution, and parser entrypoints.
- `src/preload/` exposes the Electron bridge used by the renderer.
- `src/renderer/` contains the React UI, Zustand store, and taskboard/swimlane views.
- `mcp-server/` contains the MCP stdio server, CLI, tracker utilities, and TypeScript build.
- `scripts/` contains bootstrap, parser, guard, and validation helpers.
- `docs/` contains architecture, packaging, transition, and workflow documentation.
- `playbooks/talkstore/` contains the TalkStore compatibility playbook mirror.
- `examples/` contains the minimal external example project used for public-install validation.

## Running The App And MCP Builds

Start the Electron app in development mode:

```bash
npm run dev
```

Build the Electron app bundle:

```bash
npm run build
```

Build the MCP package:

```bash
cd mcp-server
npm run build
```

If your change affects profile resolution, bootstrap, parser selection, or write guards, run the script-side validation set before you open a PR:

```bash
npm run check:validation
```

## Testing Profile-Resolution Changes Safely

- Prefer the `generic` profile plus `examples/minimal-command-center-project/` for fresh-install validation.
- Run `npm run tracker:guard:status` first so you know exactly which profile, root, and tracker path the scripts will target.
- Use the dry-run parser commands before any write command.
- Do not point local validation at a live sibling TalkStore checkout unless you intentionally need compatibility coverage.
- Do not bypass the tracker write guard unless you explicitly mean to write to a real tracker. `COMMAND_CENTER_ALLOW_TRACKER_WRITES=true` is an override, not a normal workflow.
- If a change affects compatibility inference, validate both the explicit public path and the TalkStore compatibility path.

## Docs Standards

- Lead with the platform identity: `sha8al-command-center`.
- Refer to TalkStore as a compatibility profile, not as the platform identity.
- State when a command, env var, filename, or CLI name is public-default versus compatibility-only.
- Avoid instructions that require a sibling TalkStore checkout for generic installs.
- Keep docs explicit about profile selection, tracker filenames, and source document paths.
- If the change is user-visible, add or update a release note under `docs/releases/`.

## TalkStore Compatibility Rules

- Preserve current TalkStore behavior only where the compatibility window requires it.
- Label legacy env vars, filenames, and CLI names as compatibility aliases when they appear in docs.
- Do not introduce new generic flows that depend on `TALKSTORE_PROJECT_ROOT`, `talkstore-tracker.json`, or a mirrored TalkStore playbook.
- Do not remove or narrow compatibility aliases without documenting migration impact and rollback notes.
- If a change can affect both generic and TalkStore installs, describe both outcomes in the pull request.

## Pull Requests

- Keep one logical change per pull request.
- Include the scope, affected surfaces, profiles affected, validation performed, and rollback notes in the PR body.
- Link issues or planning docs when the change is part of a larger transition.
- Call out any packaging or documentation follow-up that still needs operator action.
