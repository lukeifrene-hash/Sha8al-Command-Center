# Warp Dispatch — Implementation Spec

**Created:** March 19, 2026
**Status:** Ready to build
**Goal:** Replace clipboard-based dispatch with automatic Warp tab launch + file-based live sync

---

## What We're Building

When you click "Run" on a pipeline step (or "Run Task" in single-dispatch mode), the Command Center:

1. Assembles the prompt (already works)
2. Appends a **reporting protocol** telling the agent to write status updates back to `talkstore-tracker.json`
3. Writes the prompt to a temp file
4. Writes a Warp Launch Configuration YAML
5. Opens it via `warp://launch/<config>` — a new tab appears in your existing Warp window
6. The file watcher (already works) picks up tracker changes as the agent reports progress
7. The UI updates live — cards move between columns, pipeline steps show completion

No new windows. No leaving the Command Center to paste. No manual result capture.

---

## Architecture

```
Command Center (Electron)                    Warp (existing window)
┌──────────────────────────┐                ┌───────────────────────┐
│                          │                │                       │
│  1. Assemble prompt      │                │                       │
│  2. Write prompt file    │──── write ────▶│  /tmp/ts-dispatch-    │
│  3. Write Warp YAML      │──── write ────▶│  ~/.warp/launch_conf/ │
│  4. shell.openExternal() │──── warp:// ──▶│  New tab opens        │
│                          │                │  claude --print runs   │
│                          │                │                       │
│                          │                │  Agent works...        │
│                          │                │  Agent writes to       │
│  5. fs.watch detects     │◀─── write ────│  tracker.json          │
│     tracker change       │                │                       │
│  6. UI updates live      │                │  Agent finishes        │
│                          │                │                       │
└──────────────────────────┘                └───────────────────────┘
```

---

## Implementation Steps

### Step 1: Add Reporting Protocol to Prompt Assembler

**File:** `src/main/promptAssembler.ts`

**What:** Add a new function `buildReportingProtocol()` that generates the reporting instructions section. Append it to the assembled prompt in `assemblePrompt()`.

**The reporting protocol text must include:**
- The absolute path to `talkstore-tracker.json` (from `TRACKER_PATH` in config)
- The subtask ID to update
- The milestone ID (so the agent can find it in the JSON)
- The pipeline step name (if in pipeline mode)
- Exact field paths to update:
  - `status` → `"in_progress"` on start, `"done"` on completion
  - `done` → `true` on completion
  - `completed_at` → ISO timestamp on completion
  - `completed_by` → `"claude_code"`
  - `pipeline.steps[stepName].status` → `"complete"`
  - `pipeline.steps[stepName].completed_at` → ISO timestamp
  - `pipeline.steps[stepName].output` → summary of findings/plan/work done
- Instruction to preserve all other fields and use 2-space indent
- Instruction to keep JSON valid

**Example output appended to prompt:**
```markdown
---

# REPORTING PROTOCOL

You are being tracked by the Talkstore Command Center. As you work, update
the tracker file so the Command Center reflects your progress in real-time.

**Tracker file:** /Users/luqman/Desktop/Projects/talkstore/talkstore-tracker.json
**Your subtask:** scaffold_auth_chat_shell_004
**Milestone:** scaffold_auth_chat_shell
**Pipeline step:** builder

## On Start
Read the tracker file. Find the subtask by navigating:
milestones → find where id === "scaffold_auth_chat_shell" → subtasks → find where id === "scaffold_auth_chat_shell_004"

Set:
- status: "in_progress"

Also set the pipeline step:
- pipeline.steps.builder.status: "dispatched"
- pipeline.steps.builder.dispatched_at: (current ISO timestamp)

Write the file back. Preserve all other fields. Use 2-space JSON indentation.

## On Completion
Set on the subtask:
- status: "done"
- done: true
- completed_at: (current ISO timestamp)
- completed_by: "claude_code"

Set on the pipeline step:
- pipeline.steps.builder.status: "complete"
- pipeline.steps.builder.completed_at: (current ISO timestamp)
- pipeline.steps.builder.output: (brief summary of what you did, 1-3 paragraphs)

Write the file back.

## If Blocked
Set on the subtask:
- status: "blocked"
- blocked_reason: (description of what's blocking you)

Write the file back.

IMPORTANT: Always read the file fresh before writing. Other agents may have
modified it. Preserve all fields you did not change. Keep the JSON valid.
```

**Key design decisions:**
- The reporting protocol is ONLY appended when dispatching (not for preview)
- The protocol references concrete field paths, not abstract instructions
- It tells the agent to read-before-write to avoid conflicts

---

### Step 2: Add Warp Launcher to Main Process

**File:** `src/main/warpLauncher.ts` (new file)

**What:** A module that:
1. Writes the assembled prompt to a temp file in `/tmp/`
2. Writes a Warp Launch Configuration YAML to `~/.warp/launch_configurations/`
3. Opens it via Electron's `shell.openExternal()`
4. Cleans up temp files after a delay

**Function signature:**
```typescript
interface LaunchOptions {
  subtaskId: string
  stepName: 'explorer' | 'planner' | 'builder' | null  // null = single dispatch
  promptText: string
  workingDirectory: string  // TALKSTORE_ROOT
  allowedTools: string[]
}

interface LaunchResult {
  success: boolean
  promptFilePath: string
  configFileName: string
  error?: string
}

export function launchInWarp(options: LaunchOptions): LaunchResult
```

**Warp YAML template:**
```yaml
---
name: {{stepLabel}} — {{subtaskLabel}}
windows:
  - tabs:
      - title: "{{stepLabel}}: {{subtaskId}}"
        layout:
          cwd: "{{workingDirectory}}"
          commands:
            - exec: "claude --print --allowedTools '{{allowedTools}}' --prompt-file {{promptFilePath}}"
        color: {{tabColor}}
```

**Tab colors by agent type:**
- Explorer: `yellow`
- Planner: `blue`
- Builder: `green`
- Single dispatch (no type): `cyan`

**Allowed tools by agent type:**
- Explorer: `Read,Glob,Grep,Bash(ls),Bash(find)`
- Planner: `Read,Glob,Grep,Bash(ls),Bash(find)`
- Builder: `Edit,Write,Read,Glob,Grep,Bash(npm test),Bash(npm run typecheck),Bash(npx prisma generate)`

**Cleanup:** Delete the prompt temp file after 30 seconds (Warp reads it immediately). Delete the YAML config after 10 seconds.

---

### Step 3: Add Dispatch IPC Channel

**Files:** `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/env.d.ts`

Following the existing IPC pattern (3-file change), add:

**Main process handler:**
```typescript
ipcMain.handle('dispatch:launchInWarp', async (_event, subtaskId: string, step: string | null) => {
  // 1. Read tracker
  // 2. Assemble prompt (with step if provided)
  // 3. Append reporting protocol
  // 4. Call launchInWarp()
  // 5. Update tracker: set status to in_progress, pipeline step to dispatched
  // 6. Log to agent_log
  // 7. Return result
})
```

**Preload bridge:**
```typescript
dispatch: {
  launchInWarp: (subtaskId: string, step: string | null): Promise<LaunchResult> =>
    ipcRenderer.invoke('dispatch:launchInWarp', subtaskId, step),
}
```

**Type definition:**
```typescript
interface DispatchAPI {
  launchInWarp(subtaskId: string, step: string | null): Promise<{
    success: boolean
    promptFilePath: string
    configFileName: string
    error?: string
  }>
}
```

---

### Step 4: Add Dispatch Timeout Detection

**File:** `src/main/index.ts` (extend file watcher logic)

**What:** After dispatching, track that we're expecting a tracker update. If no update arrives within a configurable timeout, notify the renderer so it can show a "STALE" indicator.

**Mechanism:**
- Main process keeps a `Map<subtaskId, { dispatchedAt: number, stepName: string }>`
- When a dispatch happens, add an entry
- When a tracker file change arrives, check if the changed subtask matches a pending dispatch — if so, clear it
- A periodic check (every 30s) looks for entries older than 5 minutes and sends a `dispatch:stale` event to the renderer
- The renderer can show a warning: "Agent hasn't reported in 5 minutes — check the Warp tab"

---

### Step 5: Update PipelineStepCard UI

**File:** `src/renderer/components/taskboard/PipelineStepCard.tsx`

**What:** Replace the "Copy to Clipboard" button with "Run in Warp". Keep "Preview Prompt" as-is (it doesn't dispatch, just shows the assembled text).

**Changes:**
- Rename `handleCopyPrompt()` → `handleRunInWarp()`
- Instead of `window.api.prompt.copyToClipboard()`, call `window.api.dispatch.launchInWarp(subtaskId, stepName)`
- Update button text: "Copy to Clipboard" → "Run in Warp"
- Add visual feedback: "Launched!" instead of "Copied!"
- Add a stale indicator if the timeout fires
- Keep "Copy to Clipboard" as a secondary/fallback action (small text link) for manual dispatch

---

### Step 6: Update TaskDetailModal Footer

**File:** `src/renderer/components/taskboard/TaskDetailModal.tsx`

**What:** Update the "Run Task" button in the modal footer (single-dispatch mode, non-pipeline).

**Changes to `handleDispatch()`:**
- Replace `window.api.prompt.copyToClipboard()` with `window.api.dispatch.launchInWarp(subtaskId, null)`
- The rest of the logic (logging, status update) stays the same but moves to the main process handler
- Button text: "Run Task" stays, feedback changes from "Copied to clipboard!" to "Launched in Warp!"

---

### Step 7: Add Pipeline Auto-Chain (Optional Enhancement)

**File:** `src/renderer/components/taskboard/TaskDetailModal.tsx`

**What:** When the file watcher detects that a pipeline step completed (explorer → complete), automatically prompt the user to run the next step.

**Mechanism:**
- The `PromptTab` component already watches `pipeline.current_step`
- When the tracker updates and `current_step` advances, show a toast or highlight: "Explorer complete. Run Planner?"
- Do NOT auto-dispatch without confirmation — the user should review the explorer output first
- Add a "Run Next Step" button that appears when the current step is idle and the previous step is complete

---

## File Change Summary

| File | Change Type | Description |
|---|---|---|
| `src/main/promptAssembler.ts` | Modify | Add `buildReportingProtocol()`, append to prompt on dispatch |
| `src/main/warpLauncher.ts` | **New file** | Warp Launch Config writer + `shell.openExternal` launcher |
| `src/main/index.ts` | Modify | Add `dispatch:launchInWarp` IPC handler, dispatch timeout tracking |
| `src/preload/index.ts` | Modify | Expose `dispatch.launchInWarp` on `window.api` |
| `src/renderer/env.d.ts` | Modify | Add `DispatchAPI` interface to Window type |
| `src/renderer/components/taskboard/PipelineStepCard.tsx` | Modify | Replace clipboard button with Warp launch button |
| `src/renderer/components/taskboard/TaskDetailModal.tsx` | Modify | Update footer dispatch, add auto-chain prompt |

---

## What Already Works (No Changes Needed)

- Prompt assembly (3-layer system with agent profiles) — `promptAssembler.ts`
- File watcher detecting external changes — `src/main/index.ts:48-71`
- Renderer auto-refresh from file changes — `store.ts:186-196`
- Pipeline state model and step tracking — `parser.ts` types
- Pipeline UI (step cards, progress indicators) — `PipelineStepCard.tsx`, `TaskDetailModal.tsx`
- Write-back echo suppression — `store.ts:107-121`
- Agent log entries — already in tracker schema

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Agent doesn't follow reporting protocol | Timeout detection (Step 4) flags stale dispatches |
| Agent writes invalid JSON to tracker | File watcher already validates JSON before pushing to renderer (line 60) |
| Two agents write to tracker simultaneously | Reporting protocol tells agent to read-before-write; unlikely with sequential pipeline |
| Warp Launch Config path doesn't exist | `warpLauncher.ts` creates `~/.warp/launch_configurations/` with `mkdirSync({ recursive: true })` |
| `claude` CLI not installed or not in PATH | `launchInWarp()` should check `which claude` first and return a clear error |
| Prompt file too large for CLI arg | We use `--prompt-file` (file path) not `--prompt` (inline string), so no length limit |

---

## Testing Plan

1. **Unit test `buildReportingProtocol()`** — verify it generates correct field paths for a sample subtask
2. **Unit test `launchInWarp()`** — verify it writes valid YAML, correct prompt file, cleans up
3. **Manual test: single dispatch** — click "Run Task" on a subtask, verify Warp tab opens with correct command
4. **Manual test: pipeline** — run Explorer, verify output written to tracker, run Planner, verify prior output injected
5. **Manual test: live sync** — watch Command Center while agent runs in Warp, verify status updates appear in real-time
6. **Manual test: timeout** — dispatch a task, don't run the agent, verify stale warning appears after 5 minutes
7. **Edge case: no Warp installed** — verify clear error message
