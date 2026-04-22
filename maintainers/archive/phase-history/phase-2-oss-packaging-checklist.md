# Phase 2 OSS Packaging Checklist

This file is an earlier Phase 2 planning snapshot.
The canonical OSS packaging checklist is [OSS Packaging Checklist](oss-packaging-checklist.md).
If this file differs from the canonical checklist, follow the canonical checklist.

This checklist defines what must be true before the public transition can be executed as an OSS-friendly release.

This is a planning checklist only.

## Package Identity

- define the target root package name as `sha8al-command-center`
- define the target MCP package name as `sha8al-command-center-mcp`
- define the primary public CLI name
- define compatibility aliases that remain during the transition window

## Package Metadata

- `name`, `description`, `license`, `repository`, `bugs`, and `homepage` fields are present
- keywords describe the platform, not only TalkStore
- package descriptions identify TalkStore as a compatibility profile, not the product identity

## Release Structure

- root app package is buildable from a clean install
- MCP package is buildable from a clean install
- the public repo does not require the private or live TalkStore repo at publish time
- publish artifacts do not assume sibling `../talkstore`

## Public Docs

- README leads with the platform identity
- setup docs explain explicit profile selection
- TalkStore docs are labeled as compatibility guidance
- release docs explain the compatibility window and legacy aliases

## Bootstrap and Config

- bootstrap supports a public `generic` profile path
- bootstrap can still emit TalkStore-compatible config when explicitly requested
- `.env.example` shows public defaults first
- hidden TalkStore assumptions are removed from fresh-install docs

## Example Assets

- include at least one public example profile or sample project layout
- include example docs paths for a generic external install
- document how to opt into the TalkStore compatibility profile

## Packaging Safety

- no package publish step writes to a live TalkStore tracker
- no release docs instruct operators to mutate live TalkStore wiring as part of install
- script-side safety docs remain accurate after the rename

## Compatibility Window

- keep the `talkstore` CLI alias during the transition window
- keep `TALKSTORE_PROJECT_ROOT` documented as a compatibility alias during the transition window
- keep `talkstore-tracker.json` compatibility documented during the transition window
- document the eventual removal conditions before removing any alias

## Release Readiness Gate

- clean install works without a sibling TalkStore checkout
- app build passes
- MCP build passes
- public validation matrix passes
- rollback notes exist for naming and profile-resolution changes
