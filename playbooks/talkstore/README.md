# TalkStore Compatibility Playbook Mirror

This directory is the Phase 1, non-breaking mirror of the live TalkStore command-center playbook.
It ships inside `sha8al-command-center` so the public platform can keep the TalkStore operator path documented as a compatibility profile.

Current state:
- The live Command Center still runs from the `talkstore` repo.
- No MCP wiring, CLI wrapper, tracker path, parser path, or runtime path was changed by this mirror.
- Files here are duplicated from the live TalkStore setup so `sha8al-command-center` contains the full operator/agent playbook alongside the Electron app and MCP server.

Mirrored sources:
- `talkstore/AGENTS.md`
- `talkstore/CLAUDE.md`
- `talkstore/COMMAND-CENTER-GUIDE.md`
- `talkstore/.claude/commands/*`
- `talkstore/.claude/rules/*`
- `talkstore/.claude/agents/*`

Phase 1 rule:
- Treat the TalkStore repo as the live source of truth.
- Treat this directory as a mirrored copy for consolidation and public-repo preparation.
- Do not remove or re-point the live TalkStore copies until a later compatibility phase is complete.

Phase 2 drift control:
- Run `npm run playbook:check` from the repo root to compare this mirror against the live TalkStore playbook.
- Override the source path with `TALKSTORE_PLAYBOOK_SOURCE_ROOT=/absolute/path/to/talkstore` when needed.
