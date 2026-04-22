# Cutover Checklist

This checklist defines the future platform cutover from TalkStore-first compatibility to a consumer-profile model. It is planning only. Do not execute these changes implicitly.

## Preconditions

- The public boundary doc is accepted.
- The TalkStore coupling audit is accepted.
- A compatibility plan exists for the live TalkStore repo and its `.mcp.json` wiring.
- Runtime, MCP, and UI consumers can resolve a project profile explicitly.

## Naming and Branding

- Choose the generic platform name for the repo, app, and MCP package.
- Keep `Sha8al Command Center` / `sha8al-command-center` as the primary public identity.
- Decide whether the `talkstore` CLI alias remains as a secondary compatibility entrypoint.
- Update operator-facing docs to lead with the platform name and list TalkStore as a supported profile.

## Config and Resolution

- Replace implicit sibling `../talkstore` discovery with explicit project-profile resolution.
- Move `TALKSTORE_PROJECT_ROOT` to a documented compatibility alias only.
- Define profile-level defaults for tracker filename, tasks doc, checklist doc, manifesto doc, and optional roadmap doc.
- Ensure runtime, script, and MCP resolution logic all use the same profile model.

## Tracker and Parser Surfaces

- Keep parser profile stamping mandatory for any script-side tracker mutation.
- Decide whether `talkstore-tracker.json` remains a compatibility filename or is migrated.
- Provide a generic parser command layer only if it remains explicit about profile and source.
- Add migration guidance for existing TalkStore trackers if parser metadata becomes mandatory platform-wide.

## Playbooks and Consumer Assets

- Move mirrored playbooks into a consumer-profile layout if multiple consumers will be supported.
- Define where consumer prompts, playbooks, and examples live.
- Update drift tooling so the consumer profile is explicit instead of assumed.

## Runtime and MCP Cutover

- Introduce generic package and binary names without removing the existing TalkStore entrypoints immediately.
- Add a compatibility window where both old and new names work.
- Verify that dashboard, preload, IPC, and MCP behavior stay backward-compatible through the transition.
- Only remove TalkStore-first defaults after the compatibility window is complete.

## Validation Gates

- Local builds pass for both the app and MCP server.
- Live TalkStore compatibility remains intact during the transition window.
- Dry-run parser flows work for supported profiles.
- Profile-specific docs match actual runtime and script behavior.
- Rollback steps are documented before any naming or runtime cutover lands.

## Explicit Non-Goals For This Phase

- renaming live runtime binaries today
- changing the current TalkStore `.mcp.json` wiring today
- changing runtime or MCP tracker write behavior today
- forcing the live TalkStore repo onto a new tracker filename today
