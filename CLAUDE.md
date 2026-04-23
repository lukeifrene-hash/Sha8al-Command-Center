# Sha8al Command Center — Project Context

## What This Is
An Electron desktop app that visualizes and manages a tracker-driven build timeline. It supports TalkStore as a compatibility profile and can read a `talkstore-tracker.json` state file from the main TalkStore project, displaying it as a swimlane view, task board, and agent hub.

## Stack
- **Electron** + **electron-vite** (build tool)
- **React 19** + **TypeScript** in the renderer
- **Zustand** for state management
- **Tailwind CSS v4** for styling
- **No backend** — all state lives in a single JSON file on disk

## Architecture
```
Main Process (Node.js)
├── index.ts — IPC handlers, file watcher
├── config.ts — Path resolution (TALKSTORE_ROOT from .env)
└── parser.ts — Markdown → tracker JSON generator

Preload Bridge
└── index.ts — Exposes window.api.tracker to renderer

Renderer (React SPA)
├── store.ts — Zustand store with debounced write-back
├── App.tsx — Tab routing (SwimLane, TaskBoard, AgentHub)
├── views/ — SwimLaneView, TaskBoard, AgentHubPlaceholder
└── components/taskboard/ — ContextBar, KanbanColumn, TaskCard, TaskDetailModal

MCP Server (mcp-server/ — separate package)
├── index.ts — MCP stdio server
├── tools.ts — 18 tool definitions + handlers
├── cli.ts — CLI interface (same tools via shell)
├── context.ts — Context assembly for get_task_context
└── tracker.ts — Tracker read/write utilities + type definitions
```

## Key Patterns

### Task Execution (MCP)
All task execution is handled via the MCP server (`mcp-server/`).
Agents call tools like `start_task`, `complete_task`, `block_task` directly.
The Electron app is a read-only dashboard — it watches `talkstore-tracker.json`
for changes and updates the UI in real-time via the file watcher.

### IPC Channel Pattern
The Electron app uses one IPC namespace:
1. `tracker:*` — read/write/fileInfo/updated (state I/O)

Adding a new IPC channel requires changes in 3 files:
1. `src/main/index.ts` — Add `ipcMain.handle('namespace:method', handler)`
2. `src/preload/index.ts` — Expose via `contextBridge` under the namespace
3. `src/renderer/env.d.ts` — Add TypeScript interface

### State Mutation Pattern
```typescript
updateTracker((draft) => {
  const ms = draft.milestones.find(m => m.id === milestoneId)
  const task = ms?.subtasks.find(s => s.id === taskId)
  if (task) task.status = 'done'
})
```
The store auto-writes back to disk with 500ms debounce.

### Cross-Project References
This app can read from the main TalkStore project at `TALKSTORE_ROOT` (configured in `.env`) when the compatibility profile is in use:
- `docs/tasks.md` — Canonical task list (parsed into milestones)
- `docs/submission-checklist.md` — Compliance checklist (parsed separately)
- `docs/manifesto.md` — Product vision (loaded into task context by MCP server)
- `talkstore-tracker.json` — Runtime state file (read/written by app)

## Native Command Layer

This repo now ships its own command-center-native operator playbook under:

- `AGENTS.md`
- `.claude/rules/three-phase-workflow.md`
- `.claude/commands/*.md`
- `.claude/agents/*.md`

Those files are the repo-local convention layer that lets Codex and Claude Code execute the same milestone-driven workflow here without relying on the mirrored TalkStore playbook as the primary source.

## Operator Commands

The active operator command surface is milestone-driven:

- `next`
- `sweep M<N> <tier>`
- `prepare M<N> <tier>`
- `prepare M<N> all`
- `prepare T<id>`
- `build M<N> <tier>`
- `build T<id>`
- `auto M<N>`
- `audit M<N>`

Rare overrides:

- `approve T<id>`
- `audit T<id> --cross`

The exact semantics live in `.claude/rules/three-phase-workflow.md` and `.claude/commands/*.md`.

## Canonical Agents

The tracker and Agent Hub now seed and normalize a canonical roster so the repo always recognizes the same orchestration identities:

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

### Do NOT
- Access `fs` from the renderer — use IPC via `window.api`
- Write to tracker without JSON validation
- Modify `roadmap.md` — it's been replaced by `tasks.md`
