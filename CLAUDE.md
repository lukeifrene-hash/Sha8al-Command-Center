# Talkstore Command Center — Project Context

## What This Is
An Electron desktop app that visualizes and manages the Talkstore build timeline. It reads a `talkstore-tracker.json` state file from the main Talkstore project and displays it as a swimlane view, task board, and agent hub.

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
├── parser.ts — Markdown → tracker JSON generator
└── promptAssembler.ts — 3-layer prompt assembly for agent dispatch

Preload Bridge
└── index.ts — Exposes window.api.{tracker, prompt} to renderer

Renderer (React SPA)
├── store.ts — Zustand store with debounced write-back
├── App.tsx — Tab routing (SwimLane, TaskBoard, AgentHub)
├── views/ — SwimLaneView, TaskBoard, AgentHubPlaceholder
└── components/taskboard/ — ContextBar, KanbanColumn, TaskCard, TaskDetailModal
```

## Key Patterns

### IPC Channel Pattern
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
This app reads from the main Talkstore project at `TALKSTORE_ROOT` (configured in `.env`):
- `docs/tasks.md` — Canonical task list (parsed into milestones)
- `docs/submission-checklist.md` — Compliance checklist (parsed separately)
- `docs/manifesto.md` — Product vision (loaded into Layer 1 prompts)
- `talkstore-tracker.json` — Runtime state file (read/written by app)

### Do NOT
- Access `fs` from the renderer — use IPC via `window.api`
- Write to tracker without JSON validation
- Modify `roadmap.md` — it's been replaced by `tasks.md`
