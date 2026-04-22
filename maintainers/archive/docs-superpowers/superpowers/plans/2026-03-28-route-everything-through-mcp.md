# Route Everything Through MCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Warp launcher and Electron pipeline runner, making the MCP server the sole execution mechanism. The Electron app becomes a read-only dashboard that watches tracker changes. Add missing MCP tools (`unblock_task`, `toggle_checklist_item`).

**Architecture:** Delete `warpLauncher.ts` and `pipelineRunner.ts` from the Electron app. Remove all dispatch/pipeline IPC channels. Clean up the renderer UI to remove "Run in Warp", manual paste areas, and the "Run Pipeline" button. The Prompt tab becomes a read-only config editor + prompt preview. Add two new MCP tools for workflow completeness.

**Tech Stack:** Electron, React, TypeScript, MCP SDK

---

### Task 1: Delete Warp Launcher and its IPC Channel

**Files:**
- Delete: `src/main/warpLauncher.ts`
- Modify: `src/main/index.ts:1-224`
- Modify: `src/preload/index.ts:35-42`
- Modify: `src/renderer/env.d.ts:40-46`

- [ ] **Step 1: Remove the warpLauncher import and dispatch IPC handler from main**

In `src/main/index.ts`, remove:
- Line 6: `import { launchInWarp } from './warpLauncher'`
- Lines 139-224: The entire `// ─── Dispatch IPC ───` section (the `dispatch:launchInWarp` handler)

Also remove the `clipboard` import from line 1 (it was only used by the dispatch handler's `assemblePrompt` call — check if prompt:copyToClipboard still needs it). Actually `prompt:copyToClipboard` on line 134 uses `clipboard.writeText`, so keep the import.

- [ ] **Step 2: Remove the dispatch namespace from preload**

In `src/preload/index.ts`, remove lines 35-42:
```typescript
  // Dispatch to Warp terminal
  dispatch: {
    launchInWarp: (
      subtaskId: string,
      step: string | null
    ): Promise<{ success: boolean; promptFilePath?: string; error?: string }> =>
      ipcRenderer.invoke('dispatch:launchInWarp', subtaskId, step),
  },
```

- [ ] **Step 3: Remove the DispatchAPI type from env.d.ts**

In `src/renderer/env.d.ts`, remove lines 40-46:
```typescript
interface DispatchAPI {
  launchInWarp(subtaskId: string, step: string | null): Promise<{
    success: boolean
    promptFilePath?: string
    error?: string
  }>
}
```

And remove `dispatch: DispatchAPI` from the `Window` interface (line 74).

- [ ] **Step 4: Delete the warpLauncher.ts file**

Delete `src/main/warpLauncher.ts` entirely.

- [ ] **Step 5: Verify the build compiles**

Run: `npm run typecheck` (or `npx tsc --noEmit`)
Expected: No errors related to warpLauncher or dispatch

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove Warp launcher and dispatch IPC channel

MCP server is now the sole execution mechanism for agent tasks.
Deleted warpLauncher.ts and the dispatch:launchInWarp IPC handler."
```

---

### Task 2: Delete Pipeline Runner and its IPC Channels

**Files:**
- Delete: `src/main/pipelineRunner.ts`
- Modify: `src/main/index.ts` (post-Task-1 state)
- Modify: `src/preload/index.ts` (post-Task-1 state)
- Modify: `src/renderer/env.d.ts` (post-Task-1 state)

- [ ] **Step 1: Remove pipelineRunner import and pipeline IPC from main**

In `src/main/index.ts`, remove:
- Line 7 (or wherever it is after Task 1): `import { runPipeline, cancelPipeline } from './pipelineRunner'`
- The entire `// ─── Pipeline IPC ───` section containing both `pipeline:run` and `pipeline:cancel` handlers

- [ ] **Step 2: Remove the pipeline namespace from preload**

In `src/preload/index.ts`, remove the entire `pipeline: { ... }` block (lines 45-75 in original, shifted after Task 1).

- [ ] **Step 3: Remove PipelineProgressData and PipelineAPI from env.d.ts**

In `src/renderer/env.d.ts`, remove:
```typescript
interface PipelineProgressData {
  subtaskId: string
  step: 'explorer' | 'planner' | 'builder' | null
  runId?: string
  chunk?: string
  output?: string
  durationMs?: number
  error?: string
}

interface PipelineAPI {
  run(subtaskId: string): Promise<{ success: boolean; error?: string }>
  cancel(subtaskId: string): Promise<{ success: boolean }>
  onStepStarted(cb: (data: PipelineProgressData) => void): () => void
  onStepOutput(cb: (data: PipelineProgressData) => void): () => void
  onStepCompleted(cb: (data: PipelineProgressData) => void): () => void
  onCompleted(cb: (data: PipelineProgressData) => void): () => void
  onError(cb: (data: PipelineProgressData) => void): () => void
}
```

And remove `pipeline: PipelineAPI` from the `Window` interface.

- [ ] **Step 4: Delete pipelineRunner.ts**

Delete `src/main/pipelineRunner.ts` entirely.

- [ ] **Step 5: Verify the build compiles**

Run: `npm run typecheck`
Expected: Compilation errors in renderer code referencing `window.api.pipeline` and `window.api.dispatch` — these will be fixed in Task 3.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove Electron pipeline runner and IPC channels

Pipeline execution now happens via MCP server's prepare_task tool.
The Electron app watches tracker file changes for live updates."
```

---

### Task 3: Clean Up PipelineStepCard — Remove Manual Dispatch UI

**Files:**
- Modify: `src/renderer/components/taskboard/PipelineStepCard.tsx`

The PipelineStepCard currently has three manual action buttons ("Run in Warp", "Preview Prompt", "Copy to Clipboard") and a paste textarea. Remove "Run in Warp" and the paste textarea. Keep "Preview Prompt" and "Copy to Clipboard" as they're useful for debugging. Also remove all state related to Warp launching.

- [ ] **Step 1: Remove Warp-related state and handler**

Remove these state variables:
- `launchFeedback` / `setLaunchFeedback`
- `launching` / `setLaunching`

Remove the `handleRunInWarp` function entirely (lines 106-126).

- [ ] **Step 2: Remove the "Run in Warp" button from the action buttons row**

In the manual action buttons section (inside `{!isAutomatedRun && !isRunning && (` block), remove the "Run in Warp" button and its trailing separator:
```tsx
<button onClick={handleRunInWarp} ... >
  {launching ? 'Launching...' : launchFeedback || 'Run in Warp'}
</button>
<span className="text-border">|</span>
```

Keep "Preview Prompt" and "Copy to Clipboard".

- [ ] **Step 3: Remove the manual paste textarea**

Remove the entire "Output paste area — manual mode only" section (the `<div>` containing the `PASTE OUTPUT HERE` label, the `<textarea>` with `outputDraft`, and the "Save Output" button). This is lines 289-316 in the original file.

Also remove the `outputDraft` / `setOutputDraft` state, the `outputChanged` derived value, and the `useEffect` that syncs `outputDraft` from step.output (lines 48, 72-77, 79).

- [ ] **Step 4: Remove the `onSaveOutput` prop**

Remove `onSaveOutput` from the `PipelineStepCardProps` interface and destructured props. (The parent — PromptTab — will be cleaned in Task 4.)

- [ ] **Step 5: Verify the build compiles**

Run: `npm run typecheck`
Expected: Error in TaskDetailModal.tsx because it still passes `onSaveOutput` prop — fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/taskboard/PipelineStepCard.tsx
git commit -m "refactor: remove Warp dispatch and paste textarea from PipelineStepCard

Kept Preview Prompt and Copy to Clipboard for debugging.
Manual output paste is no longer needed — MCP agents write tracker directly."
```

---

### Task 4: Clean Up TaskDetailModal — Remove Warp Dispatch and Pipeline Execution

**Files:**
- Modify: `src/renderer/components/taskboard/TaskDetailModal.tsx`

This is the biggest cleanup. The modal footer has a "Run in Warp" button. The PromptTab has "Run Pipeline" / "Cancel" buttons and all the pipeline event subscription code. All of this goes.

- [ ] **Step 1: Remove handleDispatch and dispatch-related state from the modal**

Remove from the top-level `TaskDetailModal` component:
- `dispatching` / `setDispatching` state (line 84)
- `copyFeedback` / `setCopyFeedback` state (line 85)
- The entire `handleDispatch` function (lines 157-182)

- [ ] **Step 2: Replace the footer dispatch button with a status indicator**

Replace the current footer left section (the "Run in Warp" / "Pipeline Active" button, lines 349-378) with a simple status display:

```tsx
<div className="flex items-center gap-2">
  <span className="text-[10px] text-muted">
    Status: <span className="text-white font-medium">{status.replace(/_/g, ' ')}</span>
  </span>
</div>
```

- [ ] **Step 3: Remove pipelineRunning state from the modal**

Remove:
- `pipelineRunning` / `setPipelineRunning` state (line 81)
- Remove `pipelineRunning` from the disabled condition on the footer button (already removed in step 2)
- Stop passing `pipelineRunning` and `setPipelineRunning` props to PromptTab

- [ ] **Step 4: Clean up PromptTab — remove pipeline execution code**

In the `PromptTab` function:
- Remove `pipelineRunning` / `setPipelineRunning` from props and interface
- Remove `streamingOutputs` state (line 732-734)
- Remove the entire `useEffect` that subscribes to pipeline events (lines 741-814) — all `window.api.pipeline.*` calls
- Remove `handleRunPipeline` function (lines 902-911)
- Remove `handleCancelPipeline` function (lines 913-916)
- Remove `handleSaveStepOutput` function (lines 842-861) — no more manual paste
- Keep `handleTogglePipeline`, `handleToggleStep`, `handleStepDispatch` (dispatch is still used for logging)

In the pipeline mode JSX:
- Remove the "Run Pipeline" button
- Remove the "Cancel" button
- Remove the `{pipelineRunning && (` Cancel button block
- Change the status text from `{pipelineRunning ? 'Automated execution...' : ...}` to just show `pipeline.current_step` status
- Remove `streamingOutput={streamingOutputs[stepName]}` prop from PipelineStepCard
- Remove `isAutomatedRun={pipelineRunning}` prop from PipelineStepCard
- Remove `onSaveOutput` prop from PipelineStepCard

- [ ] **Step 5: Verify the build compiles**

Run: `npm run typecheck`
Expected: PASS — all `window.api.dispatch` and `window.api.pipeline` references removed.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/taskboard/TaskDetailModal.tsx
git commit -m "refactor: remove Warp dispatch button and pipeline runner from TaskDetailModal

The modal is now a config editor + prompt preview.
Task execution happens via MCP server — the app watches tracker for updates."
```

---

### Task 5: Clean Up Remaining Prompt Assembly (Optional Simplification)

**Files:**
- Modify: `src/main/index.ts` (post-Task-1/2 state)
- Modify: `src/main/promptAssembler.ts`

The Electron app still has prompt assembly (`promptAssembler.ts`), which the MCP server now handles independently via `context.ts` + `prompts.ts`. The Electron prompt assembly is still useful for the "Preview Prompt" and "Copy to Clipboard" buttons in the UI. **Keep it** but remove the `withReportingProtocol` parameter since reporting now happens through MCP tools.

- [ ] **Step 1: Remove the reporting protocol parameter from assemblePrompt**

In `src/main/promptAssembler.ts`, the `assemblePrompt` function takes an optional `withReportingProtocol?: boolean` parameter. Remove this parameter and all reporting protocol generation code.

Check the function signature and remove:
- The 4th parameter (`withReportingProtocol`)
- Any section that generates "REPORTING PROTOCOL" text

- [ ] **Step 2: Update callers of assemblePrompt**

In `src/main/index.ts`, the `prompt:assemble` and `prompt:assembleForStep` handlers pass args to `assemblePrompt`. Remove any 4th argument that was `true` (only the deleted dispatch handler used this, so this is likely already clean after Task 1).

- [ ] **Step 3: Verify the build compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/promptAssembler.ts src/main/index.ts
git commit -m "refactor: remove reporting protocol from prompt assembler

Agents now report via MCP tools (start_task, complete_task, etc.)
instead of the old tracker JSON reporting protocol."
```

---

### Task 6: Add `unblock_task` MCP Tool

**Files:**
- Modify: `mcp-server/src/tools.ts`
- Modify: `mcp-server/src/cli.ts`

Currently there's no dedicated tool to unblock a task. Agents must know to use `update_task` or manually set status, but `update_task` doesn't support status changes.

- [ ] **Step 1: Add tool definition to TOOL_DEFINITIONS array in tools.ts**

Add after the `block_task` definition:

```typescript
{
  name: 'unblock_task',
  description:
    'Unblock a task that was previously blocked. Sets status back to "todo" (or "in_progress" if it was previously started). ' +
    'Clears blocked_by and blocked_reason. Use when the blocker has been resolved.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      task_id: {
        type: 'string',
        description: 'The subtask ID to unblock',
      },
      resolution: {
        type: 'string',
        description: 'Brief description of how the blocker was resolved',
      },
    },
    required: ['task_id'],
  },
},
```

- [ ] **Step 2: Add case to handleTool switch and implement handler**

In the `handleTool` switch, add:
```typescript
case 'unblock_task':
  return handleUnblockTask(args.task_id as string, args.resolution as string | undefined)
```

Add the handler function:
```typescript
function handleUnblockTask(taskId: string, resolution?: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!

  if (task.status !== 'blocked') {
    return {
      content: [{ type: 'text' as const, text: `Task "${taskId}" is not blocked (current status: ${task.status}).` }],
      isError: true,
    }
  }

  const previousReason = task.blocked_reason
  task.status = task.last_run_id ? 'in_progress' : 'todo'
  task.blocked_by = null
  task.blocked_reason = null

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'task_unblocked',
    target_type: 'subtask',
    target_id: taskId,
    description: resolution
      ? `Unblocked: ${resolution} (was: ${previousReason})`
      : `Unblocked (was: ${previousReason})`,
    timestamp: new Date().toISOString(),
    tags: ['unblocked', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" unblocked → ${task.status}.\n\nPrevious blocker: ${previousReason}${resolution ? '\nResolution: ' + resolution : ''}`,
    }],
  }
}
```

- [ ] **Step 3: Add CLI case in cli.ts**

Add to the switch in `cli.ts`:
```typescript
case 'unblock-task':
  toolName = 'unblock_task'
  toolArgs = { task_id: positional[0], ...(positional[1] && { resolution: positional[1] }) }
  break
```

Add to the help text under WRITE COMMANDS:
```
  unblock-task <task_id> ["resolution"]     Unblock a blocked task
```

- [ ] **Step 4: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools.ts mcp-server/src/cli.ts
git commit -m "feat: add unblock_task MCP tool

Allows agents to unblock tasks when blockers are resolved.
Sets status back to todo/in_progress and logs the resolution."
```

---

### Task 7: Add `toggle_checklist_item` MCP Tool

**Files:**
- Modify: `mcp-server/src/tools.ts`
- Modify: `mcp-server/src/cli.ts`

- [ ] **Step 1: Add tool definition**

Add to TOOL_DEFINITIONS:

```typescript
{
  name: 'toggle_checklist_item',
  description:
    'Toggle a submission checklist item as done or not done. The checklist tracks Shopify app review requirements. ' +
    'Use this when a requirement has been fulfilled or when marking it as incomplete.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      item_id: {
        type: 'string',
        description: 'The checklist item ID',
      },
      done: {
        type: 'boolean',
        description: 'true to mark as complete, false to mark as incomplete',
      },
    },
    required: ['item_id', 'done'],
  },
},
```

- [ ] **Step 2: Add case to handleTool switch and implement handler**

In the `handleTool` switch, add:
```typescript
case 'toggle_checklist_item':
  return handleToggleChecklistItem(args.item_id as string, args.done as boolean)
```

Add the handler:
```typescript
function handleToggleChecklistItem(itemId: string, done: boolean) {
  const state = readTracker()

  let foundItem: import('./tracker.js').ChecklistItem | null = null
  let categoryTitle = ''

  for (const cat of state.submission_checklist.categories) {
    const item = cat.items.find((i) => i.id === itemId)
    if (item) {
      foundItem = item
      categoryTitle = cat.title
      break
    }
  }

  if (!foundItem) {
    return { content: [{ type: 'text' as const, text: `Checklist item "${itemId}" not found.` }], isError: true }
  }

  foundItem.done = done
  foundItem.completed_at = done ? new Date().toISOString() : null
  foundItem.completed_by = done ? 'claude_code' : null

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: done ? 'checklist_item_completed' : 'checklist_item_unchecked',
    target_type: 'checklist',
    target_id: itemId,
    description: `${done ? 'Completed' : 'Unchecked'}: ${foundItem.label} (${categoryTitle})`,
    timestamp: new Date().toISOString(),
    tags: ['checklist', done ? 'complete' : 'revert', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  // Count category progress
  const cat = state.submission_checklist.categories.find((c) => c.items.some((i) => i.id === itemId))!
  const catDone = cat.items.filter((i) => i.done).length
  const catTotal = cat.items.length

  return {
    content: [{
      type: 'text' as const,
      text: `Checklist item "${itemId}" ${done ? 'completed' : 'unchecked'}.\n\nItem: ${foundItem.label}\nCategory: ${categoryTitle} (${catDone}/${catTotal})`,
    }],
  }
}
```

- [ ] **Step 3: Add CLI case in cli.ts**

Add to the switch:
```typescript
case 'toggle-checklist-item':
  toolName = 'toggle_checklist_item'
  toolArgs = { item_id: positional[0], done: positional[1] === 'true' }
  break
```

Add to help text:
```
  toggle-checklist-item <item_id> <true|false>  Toggle a submission checklist item
```

- [ ] **Step 4: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/tools.ts mcp-server/src/cli.ts
git commit -m "feat: add toggle_checklist_item MCP tool

Allows agents to mark submission checklist items as done/undone.
Tracks completion in the audit log."
```

---

### Task 8: Update CLAUDE.md to Reflect New Architecture

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Architecture section**

Replace the architecture diagram to remove references to promptAssembler's dispatch role and add MCP server:

```
Main Process (Node.js)
  index.ts — IPC handlers, file watcher
  config.ts — Path resolution (TALKSTORE_ROOT from .env)
  parser.ts — Markdown -> tracker JSON generator
  promptAssembler.ts — Prompt preview assembly (read-only)

Preload Bridge
  index.ts — Exposes window.api.{tracker, prompt} to renderer

Renderer (React SPA)
  store.ts — Zustand store with debounced write-back
  App.tsx — Tab routing (SwimLane, TaskBoard, AgentHub)
  views/ — SwimLaneView, TaskBoard, AgentHubPlaceholder
  components/taskboard/ — ContextBar, KanbanColumn, TaskCard, TaskDetailModal

MCP Server (separate package)
  mcp-server/src/index.ts — MCP stdio server
  mcp-server/src/tools.ts — 19 tool definitions + handlers
  mcp-server/src/cli.ts — CLI interface (same tools)
  mcp-server/src/context.ts — Context assembly for task dispatch
  mcp-server/src/prepareTask.ts — Explorer + Planner enrichment
  mcp-server/src/classifier.ts — Task complexity classification
  mcp-server/src/agentRunner.ts — Headless claude --print runner
```

- [ ] **Step 2: Update the IPC Channel Pattern section**

Remove the note about `dispatch` namespace. The IPC channels are now:
1. `tracker:*` — read/write/fileInfo/updated
2. `prompt:*` — assemble/assembleForStep/copyToClipboard

- [ ] **Step 3: Add a new "Task Execution" section**

```markdown
### Task Execution (MCP)
All task execution is handled via the MCP server (`mcp-server/`).
Agents call tools like `start_task`, `complete_task`, `block_task` directly.
The Electron app is a read-only dashboard — it watches `talkstore-tracker.json`
for changes and updates the UI in real-time via the file watcher.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect MCP-only architecture

Removed references to Warp launcher and pipeline runner.
Added MCP server to architecture diagram."
```

---

### Task 9: Final Verification

- [ ] **Step 1: Type-check the Electron app**

Run: `npm run typecheck` (or `npx tsc --noEmit`)
Expected: PASS — no references to deleted dispatch/pipeline APIs

- [ ] **Step 2: Build the Electron app**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Build the MCP server**

Run: `cd mcp-server && npm run build`
Expected: PASS

- [ ] **Step 4: Verify the MCP server tools list**

Run: `cd mcp-server && node dist/cli.js help`
Expected: Should show all 19 tools including `unblock-task` and `toggle-checklist-item`

- [ ] **Step 5: Spot-check the UI renders**

Run: `npm run dev`
Expected: App launches, TaskBoard loads, clicking a task opens the detail modal without errors. The footer should show task status, not a "Run in Warp" button. The Prompt tab should show config fields and preview but no "Run Pipeline" button.

- [ ] **Step 6: Final commit if any adjustments were needed**
