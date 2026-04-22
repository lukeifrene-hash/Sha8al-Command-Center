# Commit & Deploy Button — Design Spec

**Date:** 2026-04-15
**Scope:** Talkstore Command Center (Electron app)
**Goal:** One-click commit + push from the dashboard header. Railway auto-deploys from the push.

---

## Architecture

Three layers, following the existing Electron IPC pattern:

```
Renderer (CommitButton)
    ↓ window.api.git.commitAndPush()
Preload (IPC bridge)
    ↓ ipcRenderer.invoke('git:commit-and-push')
Main Process (git handler)
    ↓ execFile('git', [...], { cwd: TALKSTORE_ROOT })
Git CLI → GitHub → Railway (async)
```

## Main Process — `git:commit-and-push` IPC Handler

Location: `src/main/index.ts` (add to existing IPC section)

Uses `child_process.execFile` (not exec — avoids shell injection) to run git commands sequentially in `TALKSTORE_ROOT`:

1. `git status --porcelain` — if empty, return `{ status: 'nothing' }`
2. `git diff --cached --stat` + `git diff --stat` — get changed file summary for message generation
3. Generate commit message (heuristic, see below)
4. `git add -A` — stage everything (`.gitignore` handles exclusions)
5. `git commit -m "<generated message>"` — commit
6. `git push` — push to origin (current branch)
7. Return `{ status: 'success', message, branch, filesChanged }` or `{ status: 'error', error }`

All git commands use `execFile` with the `cwd` option set to `TALKSTORE_ROOT`.

### Commit Message Heuristic

No LLM call. Pure path analysis:

1. Collect changed file paths from `git diff --stat`
2. Map directories to domain labels:
   - `app/lib/ai/` → `ai`
   - `app/components/` → `ui`
   - `app/lib/shopify/` → `shopify`
   - `app/lib/db/` → `db`
   - `app/routes/` → `routes`
   - `docs/` → `docs`
   - `prisma/` → `db`
   - `.gitignore`, config files → `chore`
3. Determine verb from operation types:
   - Mostly new files → `feat`
   - Mostly modifications → `update`
   - Mostly deletions → `chore`
   - Mix → `chore`
4. Build message: `{verb}({primary_domain}): {summary}`
   - Single domain: `feat(ai): add content-ops handler and tools`
   - Multiple domains: `chore: update ai pipeline, ui components, and docs`
   - Deletions: `chore: clean up dead code and temp files`

## Preload — Bridge

Location: `src/preload/index.ts`

Add to the existing `contextBridge.exposeInMainWorld('api', { ... })`:

```typescript
git: {
  commitAndPush: (): Promise<GitResult> =>
    ipcRenderer.invoke('git:commit-and-push'),
}
```

Where `GitResult` is:
```typescript
type GitResult =
  | { status: 'success'; message: string; branch: string; filesChanged: number }
  | { status: 'nothing' }
  | { status: 'error'; error: string }
```

## Renderer — CommitButton Component

Location: `src/renderer/components/CommitButton.tsx`

Placement: Inside `StatusBar.tsx`, between the sync indicator and the theme toggle.

### States

| State | Visual |
|-------|--------|
| Idle | Accent-bordered button with git icon + "Commit" text |
| Running | Spinner replacing icon, text changes to "Pushing...", button disabled |
| Success | Green check icon + "Deployed" text, reverts to idle after 3s |
| Error | Red border + truncated error text, reverts to idle after 5s |
| Nothing | Yellow text "No changes", reverts to idle after 3s |

### Behavior

- Click calls `window.api.git.commitAndPush()`
- Button is disabled during the operation (no double-clicks)
- No modal, no popup, no confirmation — single click executes
- `WebkitAppRegion: 'no-drag'` so it's clickable in the title bar

## Styling

Follows existing StatusBar patterns:
- `text-xs` size
- `font-mono` for consistency
- Accent color (`var(--theme-accent)` / `#14B8A6`) for the idle border
- Existing color tokens: `text-on-track` for success, `text-behind` for error, `text-muted` for secondary text

## Out of Scope

- Railway deploy status tracking (separate feature)
- File selection / diff preview
- Branch selection
- Custom commit message input
- LLM-generated commit messages
