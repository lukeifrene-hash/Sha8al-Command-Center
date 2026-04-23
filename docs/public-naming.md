# Sha8al Command Center Naming

This document defines the public naming surface for Sha8al Command Center (`sha8al-command-center`).

## Public Platform Name

Display name:
- `Sha8al Command Center`

Slug and public machine name:
- `sha8al-command-center`

Use `sha8al-command-center` as the public-facing platform and repo name in:
- README copy
- onboarding docs
- example walkthroughs
- architecture and boundary docs
- CLI help and MCP package descriptions
- app window and dev-shell display copy where that does not change wiring

## TalkStore Compatibility Profile

TalkStore remains a supported compatibility profile.

Existing TalkStore operators can keep using:
- `TALKSTORE_PROJECT_ROOT`
- `talkstore-tracker.json`
- the `talkstore` CLI alias
- the `tracker:parse:talkstore-*` package scripts
- `playbooks/talkstore/`

These are compatibility surfaces, not the platform identity.

## Safe Usage Right Now

- New installs should follow the `generic` profile path and `COMMAND_CENTER_*` configuration.
- New installs should use the public parser alias `tracker:parse:project-tasks`, which resolves the public `generic-markdown` parser identity against `docs/roadmap.md`.
- Existing TalkStore installs should keep current wiring unless they are intentionally migrating.
- Package ids now use `sha8al-command-center` and `sha8al-command-center-mcp`.
- The public CLI alias `sha8al-command-center` can coexist with the compatibility alias `talkstore`.

## Compatibility Notes

The following compatibility details still exist:
- changing the live MCP server registration name used by existing TalkStore wiring
- removing the `talkstore` CLI alias or the `tracker:parse:talkstore-*` aliases
- keeping some TalkStore-first runtime identity in place until compatibility-sensitive cutover work is complete

## Related Docs

- [README](../README.md)
- [Public Boundary](public-boundary.md)
- [Architecture Overview](architecture-overview.md)
