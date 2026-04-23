# Sha8al Command Center Playbook

This directory is the public entrypoint for the native command-center workflow.

The active operator playbook lives at the repo root so Codex and Claude Code can discover it automatically:

- [AGENTS.md](../../AGENTS.md)
- [CLAUDE.md](../../CLAUDE.md)
- [Three-Phase Workflow](../../.claude/rules/three-phase-workflow.md)
- [Command Specs](../../.claude/commands)
- [Canonical Agents](../../.claude/agents)

## Command Surface

The command center's operator verbs are:

- `next`
- `sweep M<N> <tier>`
- `prepare M<N> <tier>`
- `prepare M<N> all`
- `prepare T<id>`
- `build M<N> <tier>`
- `build T<id>`
- `auto M<N>`
- `audit M<N>`
- `approve T<id>`
- `audit T<id> --cross`

## Canonical Agent Roster

The repo seeds and displays a shared roster:

- `claude_code`
- `codex`
- `explorer`
- `researcher`
- `auditor`
- `milestone-auditor`
- `milestone-coherence-auditor`
- `milestone-security-auditor`
- `milestone-ux-auditor`
- `milestone-compliance-auditor`
- `luqman`

## Compatibility

`playbooks/talkstore/` remains as the TalkStore compatibility mirror. The root `.claude` layer is now the primary workflow surface for this repo.
