# Codex Entrypoint

This file is the Codex-side entrypoint for Sha8al Command Center. Shared repo behavior and project context live in `CLAUDE.md`. Codex and Claude Code should follow the same operator command surface from this repo's native `.claude` layer.

## Read first

1. `CLAUDE.md` — repo context, architecture, compatibility rules, and operator command summary
2. `.claude/rules/three-phase-workflow.md` — the full milestone-driven command workflow
3. `.claude/commands/*.md` — per-command execution specs
4. `.claude/agents/*.md` — the canonical sub-agent roster

## Operator commands

When the operator's message starts with one of these first tokens, treat it as a command invocation rather than ordinary prose:

| First token | What to do | Full spec |
| --- | --- | --- |
| `next` | Call `mcp__talkstore__get_next_actionable_tasks` and format the result by tier. Read-only. | `.claude/commands/next.md` |
| `sweep` | Run the wave-driven execution loop for a milestone tier. | `.claude/commands/sweep.md` |
| `prepare` | Run the prep phase for `M<N> <tier>`, `M<N> all`, or `T<id>` using Explorer + Researcher. | `.claude/commands/prepare.md` |
| `build` | Execute prepared work from `builder_prompt` when present, then hand off to the Auditor. | `.claude/commands/build.md` |
| `auto` | Compose `next`, `sweep`, and `build` across waves until a natural stop. | `.claude/commands/auto.md` |
| `audit` | Run milestone-level audit or task-level cross audit depending on arguments. | `.claude/commands/audit.md` |
| `approve` | Manual `review -> done` override for one task. | `.claude/rules/three-phase-workflow.md` |

Slash-prefixed forms such as `/next` and `/prepare` mean the same thing.

## Canonical sub-agents

The command center ships with a canonical agent roster. These IDs are shared across the tracker, MCP server, Agent Hub, and the repo-level playbook:

- `explorer`
- `researcher`
- `auditor`
- `milestone-auditor`
- `milestone-coherence-auditor`
- `milestone-security-auditor`
- `milestone-ux-auditor`
- `milestone-compliance-auditor`

Codex orchestration should identify itself as `codex`. Claude orchestration should identify itself as `claude_code`. The tracker also preserves `luqman` as the human operator.

## MCP/tooling notes

- The current MCP tool namespace remains `mcp__talkstore__*` for compatibility.
- Use the MCP server and tracker tools rather than editing tracker JSON directly.
- Respect the active profile and project root resolution rules in `CLAUDE.md`.
