# QA + Review Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Review and QA tabs into a single QA tab with three sections (Use Case Verification, Open Sessions, Fixes Inbox), delete 7 dead review sessions, and remove the three-lane layout.

**Architecture:** Delete `ReviewView.tsx`, port its `FixesSection` and session card logic into `QAView.tsx`, update tab bar and app router to remove the Review tab, and clean up dead sessions from the tracker JSON via a one-time script.

**Tech Stack:** React + Zustand (renderer), Node.js MCP server (tools), JSON file storage (talkstore-tracker.json), Tailwind CSS.

---

### Task 1: Delete 7 Dead Sessions From Tracker

**Files:**
- One-time script (run and discard)

- [ ] **Step 1: Run deletion script**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
node -e "
const fs = require('fs');
const path = '/Users/luqman/Desktop/Projects/talkstore/talkstore-tracker.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const deleteIds = [
  'review-backend-1775940982125',
  'review-backend-1775940982147',
  'review-backend-1775940983126',
  'review-backend-1775940984066',
  'review-ux-1775940987422',
  'review-backend-1775951038614',
  'review-ui-1776001114837',
];
const before = data.review_sessions.length;
data.review_sessions = data.review_sessions.filter(s => !deleteIds.includes(s.id));
const after = data.review_sessions.length;
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Deleted ' + (before - after) + ' sessions. Remaining: ' + after);
"
```

Expected: `Deleted 7 sessions. Remaining: 11`

- [ ] **Step 2: Verify remaining sessions**

```bash
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/Users/luqman/Desktop/Projects/talkstore/talkstore-tracker.json', 'utf8'));
data.review_sessions.forEach(s => console.log(s.id + ' | ' + s.title));
"
```

Expected: 11 sessions listed, none of the 7 deleted IDs present.

- [ ] **Step 3: Commit tracker change**

This is a data file in the talkstore repo, not the command center repo. No git commit needed for the tracker JSON (it's gitignored / runtime data). Move on.

---

### Task 2: Remove Review Tab From Tab Bar and Router

**Files:**
- Modify: `src/renderer/store.ts`
- Modify: `src/renderer/components/TabBar.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Remove 'review' from TabId in store.ts**

Change:

```typescript
export type TabId = 'swim-lane' | 'task-board' | 'review' | 'agent-hub' | 'calendar' | 'birds-eye' | 'qa'
```

To:

```typescript
export type TabId = 'swim-lane' | 'task-board' | 'agent-hub' | 'calendar' | 'birds-eye' | 'qa'
```

- [ ] **Step 2: Remove review tab entry from TabBar.tsx**

Change the `TabId` type to match store.ts. Remove the review entry from the `TABS` array:

```typescript
type TabId = 'swim-lane' | 'task-board' | 'agent-hub' | 'calendar' | 'birds-eye' | 'qa'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'swim-lane', icon: '⬡', label: 'Swim Lane' },
  { id: 'task-board', icon: '⊞', label: 'Task Board' },
  { id: 'qa', icon: '◎', label: 'QA' },
  { id: 'agent-hub', icon: '⚡', label: 'Agent Hub' },
  { id: 'calendar', icon: '▦', label: 'Calendar' },
  { id: 'birds-eye', icon: '◉', label: "Bird's Eye" },
]
```

Update the QA notification dot to also fire on unpromoted session fixes. Change the existing `hasQAFailure` useMemo to:

```typescript
const hasQAFailure = useMemo(() => {
  const qaFail = (tracker?.qa?.groups ?? []).some((g: any) =>
    g.use_cases.some((uc: any) => uc.agent_status === 'fail' || uc.operator_status === 'fail')
  )
  const fixPending = (tracker?.review_sessions ?? []).some((s: any) =>
    (s.fixes ?? []).some((f: any) => !f.task_id)
  )
  return qaFail || fixPending
}, [tracker?.qa, tracker?.review_sessions])
```

- [ ] **Step 3: Remove ReviewView from App.tsx**

Remove the import:

```typescript
// DELETE: import { ReviewView } from './views/ReviewView'
```

Remove the route:

```typescript
// DELETE: {activeTab === 'review' && <ReviewView />}
```

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
npm run build
```

Expected: Build passes. ReviewView.tsx will show an "unused file" but won't cause build errors since nothing imports it anymore.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/store.ts src/renderer/components/TabBar.tsx src/renderer/App.tsx
git commit -m "feat(qa): remove Review tab from tab bar and router"
```

---

### Task 3: Port FixesSection Into QAView

**Files:**
- Modify: `src/renderer/views/QAView.tsx`

- [ ] **Step 1: Add FixesSection code to QAView.tsx**

Add the following code BEFORE the `export function QAView()` main component (after the `NotBuiltSummary` component). This is ported directly from ReviewView.tsx with one change: the `laneColor` decoration on fix rows is replaced with a neutral muted color since lanes are no longer displayed.

```typescript
// ── Fixes Section (ported from ReviewView) ─────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string; sort: number }> = {
  critical: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'CRITICAL', sort: 0 },
  major: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'MAJOR', sort: 1 },
  minor: { bg: 'rgba(155,155,170,0.12)', text: '#9B9BAA', label: 'MINOR', sort: 2 },
}

interface AggregatedFix {
  label: string
  severity: 'critical' | 'major' | 'minor'
  task_id: string | null
  task_done: boolean
  session_title: string
  session_id: string
  fixIndex: number
}

const MILESTONE_ID = 'debug_review'

function FixesSection({ sessions, milestones, updateTracker }: {
  sessions: { id: string; lane: string; title: string; fixes?: { label: string; severity: string; task_id: string | null }[] }[]
  milestones: { id: string; subtasks: { id: string; done: boolean }[] }[]
  updateTracker: (updater: (draft: TrackerState) => void) => void
}) {
  const doneTaskIds = new Set<string>()
  for (const ms of milestones) {
    for (const task of ms.subtasks) {
      if (task.done) doneTaskIds.add(task.id)
    }
  }

  const allFixes: AggregatedFix[] = []
  for (const session of sessions) {
    for (let fi = 0; fi < (session.fixes ?? []).length; fi++) {
      const fix = session.fixes![fi]
      allFixes.push({
        label: fix.label,
        severity: (fix.severity as AggregatedFix['severity']) || 'major',
        task_id: fix.task_id,
        task_done: fix.task_id ? doneTaskIds.has(fix.task_id) : false,
        session_title: session.title,
        session_id: session.id,
        fixIndex: fi,
      })
    }
  }

  allFixes.sort((a, b) => (SEVERITY_STYLES[a.severity]?.sort ?? 1) - (SEVERITY_STYLES[b.severity]?.sort ?? 1))

  const pending = allFixes.filter(f => !f.task_id)
  const promoted = allFixes.filter(f => f.task_id && !f.task_done)
  const completed = allFixes.filter(f => f.task_done)

  const promoteFix = (sessionId: string, fixIndex: number) => {
    updateTracker((draft: TrackerState) => {
      const milestone = draft.milestones.find(m => m.id === MILESTONE_ID)
      if (!milestone) return
      const session = (draft.review_sessions ?? []).find((s: any) => s.id === sessionId)
      if (!session?.fixes?.[fixIndex]) return
      const fix = session.fixes[fixIndex]
      if (fix.task_id) return

      const idPattern = new RegExp(`^${MILESTONE_ID}_(\\d+)$`)
      const existingNums = milestone.subtasks
        .map((s: any) => s.id.match(idPattern))
        .filter(Boolean)
        .map((m: any) => parseInt(m[1], 10))
      const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1
      const taskId = `${MILESTONE_ID}_${String(nextNum).padStart(3, '0')}`
      const priorityMap: Record<string, string> = { critical: 'P1', major: 'P2', minor: 'P3' }

      const notes = [
        `From: ${session.title}`,
        `Severity: ${fix.severity}`,
        ``,
        `## Verification`,
        `After fixing, the agent MUST verify the fix before completing the task.`,
        ``,
        `### Self-verification (agent does this)`,
        `For prompt/response issues, classifier bugs, handler routing, or backend logic:`,
        `- Send a test prompt via the dev test bypass (POST to /api/chat with X-Test-Bypass: local)`,
        `- Monitor the streamed response and server logs`,
        `- Confirm the classifier output (domain, verb, confidence)`,
        `- Confirm the handler produced the expected response`,
        `- Record the test prompt sent, the classifier result, and the response summary`,
        ``,
        `For build/type/lint issues:`,
        `- Run npm run build && npm run typecheck && npm run lint`,
        `- Confirm all pass`,
        ``,
        `### Operator verification (only if needed)`,
        `If the fix involves visual UI, layout, or browser-only behavior that cannot be verified via API:`,
        `- Describe what the operator should look at (page, element, interaction)`,
        `- Describe the expected vs previous behavior`,
      ].join('\n')

      milestone.subtasks.push({
        id: taskId,
        label: fix.label,
        status: 'todo',
        done: false,
        assignee: null,
        blocked_by: null,
        blocked_reason: null,
        completed_at: null,
        completed_by: null,
        priority: priorityMap[fix.severity] ?? 'P2',
        notes,
        prompt: null,
        context_files: [],
        reference_docs: [],
        acceptance_criteria: [],
        constraints: [],
        agent_target: null,
        execution_mode: 'agent',
        depends_on: [],
        last_run_id: null,
        pipeline: null,
        builder_prompt: null,
      } as never)

      fix.task_id = taskId
      session.updated_at = new Date().toISOString()
    })
  }

  return (
    <div className="rounded-lg border border-border bg-surface/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold tracking-wider text-white">FIXES</h2>
          {allFixes.length > 0 && (
            <span className="text-[10px] font-mono text-muted">
              {pending.length} pending{promoted.length > 0 ? ` / ${promoted.length} in progress` : ''}{completed.length > 0 ? ` / ${completed.length} done` : ''}
            </span>
          )}
        </div>
        {pending.length > 0 && (
          <span className="text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400">
            {pending.length} AWAITING TASK BOARD
          </span>
        )}
      </div>

      {allFixes.length === 0 ? (
        <p className="text-[11px] text-muted">No fixes found yet. Fixes appear here when QA tests fail or session bugs are logged.</p>
      ) : (
        <div className="space-y-2">
          {allFixes.map((fix, idx) => {
            const sev = SEVERITY_STYLES[fix.severity] ?? SEVERITY_STYLES.major
            return (
              <div
                key={`${fix.session_id}-${fix.fixIndex}-${idx}`}
                className={`group/fix flex items-start gap-3 rounded-lg border p-3 ${
                  fix.task_done
                    ? 'border-border/30 bg-dark/20 opacity-50'
                    : fix.task_id
                      ? 'border-border/50 bg-dark/30 opacity-70'
                      : 'border-border bg-dark'
                }`}
              >
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                    style={{ backgroundColor: sev.bg, color: sev.text }}
                  >
                    {fix.task_done ? 'DONE' : sev.label}
                  </span>
                  {fix.task_id ? (
                    <span className="text-[8px] font-mono text-accent">{fix.task_id}</span>
                  ) : (
                    <button
                      onClick={() => promoteFix(fix.session_id, fix.fixIndex)}
                      className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent-light hover:bg-accent/20 hover:text-accent transition-colors"
                      title="Push to task board"
                    >
                      Push
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] leading-snug ${fix.task_done ? 'text-muted line-through' : 'text-white/90'}`}>{fix.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-muted truncate">{fix.session_title}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Clean build. The FixesSection is defined but not yet rendered — that's fine for this step.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/QAView.tsx
git commit -m "feat(qa): port FixesSection into QAView"
```

---

### Task 4: Add Open Sessions Section to QAView

**Files:**
- Modify: `src/renderer/views/QAView.tsx`

- [ ] **Step 1: Add session types and components**

Add these AFTER the `NotBuiltSummary` component and BEFORE the `FixesSection`:

```typescript
// ── Open Sessions ──────────────────────────────────────────────────────

interface SessionCheckItem {
  label: string
  done: boolean
  checked_at: string | null
}

interface Session {
  id: string
  lane: string
  title: string
  status: string
  checklist: SessionCheckItem[]
  fixes: { label: string; severity: string; task_id: string | null }[]
  created_at: string
  updated_at: string
}

function SessionCard({ session, onToggleCheck, onDelete }: {
  session: Session
  onToggleCheck: (sessionId: string, idx: number) => void
  onDelete: (sessionId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const doneCount = session.checklist.filter(c => c.done).length
  const totalCount = session.checklist.length
  const pendingFixes = (session.fixes ?? []).filter(f => !f.task_id).length

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-surface hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted">{expanded ? '▾' : '▸'}</span>
          <span className="text-[12px] font-medium text-white">{session.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-[10px] font-mono text-muted">{doneCount}/{totalCount} checked</span>
          )}
          {pendingFixes > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
              {pendingFixes} fixes
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3">
          {totalCount > 0 && (
            <>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted font-mono">{doneCount}/{totalCount}</span>
              </div>
              <div className="space-y-1.5">
                {session.checklist.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); onToggleCheck(session.id, idx) }}
                    className="flex items-start gap-2 w-full text-left group/item"
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-px ${
                      item.done
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'border-border group-hover/item:border-muted'
                    }`}>
                      {item.done && (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-6" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[11px] leading-tight ${item.done ? 'text-muted line-through' : 'text-white/80'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {totalCount === 0 && (
            <p className="text-[10px] text-muted">No checklist items. Fixes from this session appear in the Fixes inbox below.</p>
          )}

          <div className="mt-3 pt-2 border-t border-border/50">
            {!showConfirm ? (
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfirm(true) }}
                className="text-[9px] text-muted hover:text-red-400 transition-colors"
              >
                Delete session
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">Delete this session?</span>
                <button onClick={(e) => { e.stopPropagation(); onDelete(session.id) }} className="text-[10px] font-semibold text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-400/10 transition-colors">Yes</button>
                <button onClick={(e) => { e.stopPropagation(); setShowConfirm(false) }} className="text-[10px] font-semibold text-muted hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors">No</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NewSessionInput({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 rounded-lg border border-dashed border-border text-[10px] text-muted font-semibold tracking-wider hover:border-accent/40 hover:text-accent-light transition-colors"
      >
        + New Session
      </button>
    )
  }

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value)
      setValue('')
      setOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') { setValue(''); setOpen(false) }
        }}
        placeholder="Name this session..."
        className="flex-1 text-[11px] px-3 py-1.5 rounded-md bg-dark border border-border text-white placeholder:text-muted/50 outline-none focus:border-accent/40 transition-colors"
      />
      <button onClick={handleSubmit} className="text-[10px] font-semibold text-accent-light hover:text-accent px-2 py-1.5 rounded-md hover:bg-accent/10 transition-colors">Add</button>
      <button onClick={() => { setValue(''); setOpen(false) }} className="text-[10px] text-muted hover:text-white px-1.5 py-1.5 transition-colors">✕</button>
    </div>
  )
}

function OpenSessions({ sessions, updateTracker }: {
  sessions: Session[]
  updateTracker: (updater: (draft: TrackerState) => void) => void
}) {
  const toggleCheck = (sessionId: string, idx: number) => {
    updateTracker((draft: TrackerState) => {
      const session = (draft.review_sessions ?? []).find((s: any) => s.id === sessionId)
      if (!session || idx < 0 || idx >= session.checklist.length) return
      session.checklist[idx].done = !session.checklist[idx].done
      session.checklist[idx].checked_at = session.checklist[idx].done ? new Date().toISOString() : null
      session.updated_at = new Date().toISOString()
    })
  }

  const deleteSession = (id: string) => {
    updateTracker((draft: TrackerState) => {
      draft.review_sessions = (draft.review_sessions ?? []).filter((s: any) => s.id !== id)
    })
  }

  const addSession = (title: string) => {
    if (!title.trim()) return
    const id = `review-session-${Date.now()}`
    updateTracker((draft: TrackerState) => {
      if (!draft.review_sessions) draft.review_sessions = []
      draft.review_sessions.push({
        id, lane: 'backend' as any, title: title.trim(), status: 'not_started' as any, area: title.trim(),
        checklist: [], fixes: [], priority: null as any,
        source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } as any)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-bold tracking-wider text-white/50 uppercase">Open Sessions</h2>
          <span className="text-[10px] font-mono text-muted">{sessions.length}</span>
        </div>
      </div>
      <div className="space-y-2">
        {sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            onToggleCheck={toggleCheck}
            onDelete={deleteSession}
          />
        ))}
        <NewSessionInput onSubmit={addSession} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update the QAView main component to render all three sections**

Replace the current `export function QAView()` with:

```typescript
export function QAView() {
  const { tracker, updateTracker } = useStore()
  const groups: Group[] = (tracker?.qa?.groups ?? []) as Group[]
  const sessions: Session[] = (tracker?.review_sessions ?? []) as Session[]

  const builtGroups = groups.filter(g => g.use_cases.some(uc => uc.built))

  function handleMark(useCaseId: string, status: 'pass' | 'fail', notes?: string) {
    updateTracker((draft: TrackerState) => {
      for (const group of (draft as any).qa.groups) {
        const uc = group.use_cases.find((u: UseCase) => u.id === useCaseId)
        if (uc) {
          uc.operator_status = status
          uc.operator_tested_at = new Date().toISOString()
          if (notes) uc.operator_notes = notes

          if (status === 'fail') {
            if (!draft.review_sessions) draft.review_sessions = []
            let qaSession = draft.review_sessions.find((s: any) => s.id === 'qa_failures')
            if (!qaSession) {
              qaSession = {
                id: 'qa_failures', lane: 'backend' as any, title: 'QA Failures',
                status: 'in_progress' as any, area: 'QA Verification',
                checklist: [], fixes: [], priority: 'P1' as any,
                source: 'qa_tab', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              } as any
              draft.review_sessions.push(qaSession)
            }
            if (!qaSession.fixes) qaSession.fixes = []
            qaSession.fixes.push({
              label: `QA: ${uc.name} — operator fail${notes ? ': ' + notes : ''}`,
              severity: 'major' as any,
              task_id: null,
              created_at: new Date().toISOString(),
            })
            qaSession.updated_at = new Date().toISOString()
            uc.review_fix_id = `qa_failures:fix-${qaSession.fixes.length - 1}`
          }
          break
        }
      }
    })
  }

  function handleReset(useCaseId: string) {
    updateTracker((draft: TrackerState) => {
      for (const group of (draft as any).qa.groups) {
        const uc = group.use_cases.find((u: UseCase) => u.id === useCaseId)
        if (uc) {
          uc.agent_status = 'untested'
          uc.agent_tested_at = null
          uc.agent_notes = null
          uc.operator_status = 'untested'
          uc.operator_tested_at = null
          uc.operator_notes = null
          uc.review_fix_id = null
          break
        }
      }
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border bg-dark">
        <ReadinessBar groups={groups} />
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Section 1: Use Case Verification */}
        <div className="space-y-2">
          {builtGroups.map(group => (
            <GroupCard key={group.id} group={group} onMark={handleMark} onReset={handleReset} />
          ))}
          <NotBuiltSummary groups={groups} />
        </div>

        {/* Section 2: Open Sessions */}
        <OpenSessions sessions={sessions} updateTracker={updateTracker} />

        {/* Section 3: Fixes Inbox */}
        <FixesSection
          sessions={sessions}
          milestones={tracker?.milestones ?? []}
          updateTracker={updateTracker}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/views/QAView.tsx
git commit -m "feat(qa): add Open Sessions and Fixes Inbox to merged QA view"
```

---

### Task 5: Delete ReviewView.tsx

**Files:**
- Delete: `src/renderer/views/ReviewView.tsx`

- [ ] **Step 1: Delete the file**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
rm src/renderer/views/ReviewView.tsx
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Clean build. No file imports ReviewView anymore (removed in Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/views/ReviewView.tsx
git commit -m "chore(qa): delete ReviewView.tsx — merged into QAView"
```

---

### Task 6: Make Lane Optional in MCP Tool

**Files:**
- Modify: `mcp-server/src/tools.ts`

- [ ] **Step 1: Update `create_review_session` tool definition**

Find the `create_review_session` tool definition. Change the description and make `lane` optional:

Change the description from:
```typescript
'Create a new review session in the Review tab. Agents should call this at the start of a debug session ' +
'to register what they are working on. The lane is auto-classified: "ui" for visual/layout issues, ' +
'"ux" for flow/interaction issues, "backend" for logic/data bugs.',
```

To:
```typescript
'Create a new QA session. Agents should call this to register a debug or verification session. ' +
'Sessions appear in the Open Sessions section of the QA tab.',
```

Remove `lane` from the `required` array. It should only require `['title']`. Keep `lane` in the properties but add a note that it defaults to `'backend'`:

```typescript
lane: {
  type: 'string',
  enum: ['ui', 'ux', 'backend'],
  description: 'Optional categorization. Defaults to "backend" if omitted.',
},
```

Change the `required` array from:
```typescript
required: ['lane', 'title'],
```

To:
```typescript
required: ['title'],
```

- [ ] **Step 2: Update the handler to default lane**

Find the `handleCreateReviewSession` function call in the switch statement. It currently passes `args.lane as string`. Change it to default:

```typescript
case 'create_review_session':
  return handleCreateReviewSession(
    (args.lane as string) || 'backend', args.title as string, args.area as string,
    args.priority as string | undefined, args.source as string | undefined
  )
```

- [ ] **Step 3: Verify MCP server compiles**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center/mcp-server
npx tsc
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
git add mcp-server/src/tools.ts
git commit -m "feat(qa): make lane optional in create_review_session MCP tool"
```

---

### Task 7: Final Build Verification

- [ ] **Step 1: Full build check**

```bash
cd /Users/luqman/Desktop/Projects/talkstore-command-center
npm run build
```

Expected: Clean build, zero errors.

- [ ] **Step 2: Launch and verify visually**

Start the Electron app. Click the QA tab (◎). Verify:

- ReadinessBar shows at the top with correct counts
- Use Case Verification section: 7 built groups with collapsible cards, Not Built section at bottom
- Open Sessions section: 11 surviving sessions listed as expandable cards
- Expanding a session shows its checklist with toggleable checkboxes and progress bar
- Fixes Inbox at the bottom shows all aggregated fixes with severity badges and Push buttons
- The Review tab no longer appears in the tab bar
- QA notification dot appears if any use case has fail status OR any session has unpromoted fixes
- Creating a new session via "+ New Session" works

- [ ] **Step 3: Test interaction flows**

1. Click PASS on a use case → operator status updates
2. Click FAIL on a use case → note input appears → submit → fix appears in Fixes Inbox
3. Click Push on a fix → task created on Task Board
4. Toggle a session checklist item → progress bar updates
5. Delete a session → confirmation appears → confirm → session removed
6. Create new session → input appears → submit → session card appears

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(qa): merged QA + Review tab complete — verification, sessions, and fixes in one view"
```
