# Release Notes

This directory holds release notes for public and compatibility-impacting changes.

## File Naming

Use one Markdown file per release:

- `vX.Y.Z.md` for tagged releases
- `YYYY-MM-DD-topic.md` for pre-release packaging or transition milestones

## When To Add A Release Note

Add or update a release note when a change affects:

- installation or packaging behavior
- public-facing docs or onboarding
- profile resolution or compatibility aliases
- tracker filenames, bootstrap defaults, or parser safety guards
- the Electron app or MCP package in a user-visible way

## Required Sections

Every release note should keep the following sections, even if some are `None`:

- Headline summary
- Breaking changes
- Compatibility changes
- Public install or packaging changes
- TalkStore-specific notes
- Rollback notes

Start from [`_template.md`](_template.md).
