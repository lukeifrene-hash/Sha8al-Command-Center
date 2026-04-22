# QA + Review Tab Merge — Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Location:** Talkstore Command Center (Electron app)

## Problem

The command center has two overlapping tabs: QA (structured use-case verification with dual agent/operator testing) and Review (freeform debug sessions with checklist items and a fixes inbox). Both feed into the same `review_sessions` data model. Both track testing and surface bugs. 7 of 18 review sessions are dead or fully covered by QA use cases. The three-lane layout (UI/UX/Backend) adds visual overhead without enforcing different workflows.

## Solution

Merge both tabs into a single **QA tab** (◎). Three vertical sections: Use Case Verification (structured, 28 use cases), Open Sessions (freeform, for everything else), and Fixes Inbox (aggregated pipeline to the task board). Delete ReviewView.tsx. Port its working components into QAView.tsx.

---

## Data Changes

### Delete 7 Dead Sessions

Remove these from `review_sessions` in the tracker:

| Session | ID | Reason |
|---------|-----|--------|
| DCI Scoring Verification | `review-backend-1775940982125` | Dead — 0/7, 0 fixes, covered by QA |
| GEO Scoring Verification | `review-backend-1775940982147` | Dead — 0/5, 0 fixes, covered by QA |
| Description Rewrites Verification | `review-backend-1775940983126` | Dead — 0/5, 0 fixes, covered by QA |
| Collections Verification | `review-backend-1775940984066` | Dead — 0/4, 0 fixes, covered by QA |
| Conversation Flow Verification | `review-ux-1775940987422` | Complete — 13/13, 0 fixes |
| Classifier & Token Budget Fixes | `review-backend-1775951038614` | All 6 fixes promoted, 0 checklist |
| Homepage — Post-Polaris Polish | `review-ui-1776001114837` | Full duplicate of Post-Polaris Migration |

Hard delete — no archive. Promoted fixes already exist as tasks on the Task Board.

### Keep 11 Sessions as Open Sessions

All remaining sessions keep their existing data structure. The `lane` field stays in the data (no migration) but the UI stops using it for column layout.

### No Schema Changes

`review_sessions` and `qa` stay as separate top-level keys in `talkstore-tracker.json`. The merge is purely a UI change — one view renders both data sources.

---

## Tab Bar Changes

### Remove
- `'review'` from `TabId` union in `store.ts`
- Review tab entry from `TABS` array in `TabBar.tsx`
- Review route from `App.tsx`
- `ReviewView.tsx` import from `App.tsx`

### Modify
- QA tab notification dot: fire if any QA use case has `fail` status OR any review session has unpromoted fixes (fixes where `task_id` is null)

---

## QA Tab Layout (Top to Bottom)

### 1. ReadinessBar (unchanged)

```
QA Verification                              4/18 verified  ████░░░░░░░░░░░  22%
                                             Agent: 12/18 · Operator: 6/18
```

### 2. Use Case Verification (unchanged)

11 collapsible groups, 28 use cases, dual agent/operator status indicators, PASS/FAIL/Reset buttons, Copy Prompt, auto-push failures to Fixes Inbox. No changes from the current QAView implementation.

### 3. Open Sessions

Section header with session count. Flat list of expandable session cards (no column layout, no lanes).

**Collapsed session:**
```
▸ Billing & Task Consumption Verification       2/6 checked   3 fixes pending
```

**Expanded session:**
```
▾ Billing & Task Consumption Verification       2/6 checked   3 fixes pending

  ✓ Free tier 3-task limit enforced
  ✓ Upgrade prompt appears after exhaustion
  ○ appSubscriptionCreate redirects to confirmationUrl
  ○ Usage charge recorded via appUsageRecordCreate
  ○ Cap-approaching webhook triggers notification
  ○ Plan change handled gracefully

  [+ New checklist item]
```

Each session card supports:
- Expand/collapse toggle
- Checklist with toggleable checkboxes
- Progress count (done/total)
- Pending fix count badge (if session has unpromoted fixes)
- Delete button (with confirmation)

**New Session input** at the bottom of the section — simplified, no lane picker:
```
[+ New Session]  →  input: "Name this session..."  [Add]
```

Sessions created from the UI default to `lane: 'backend'` (the field must exist for data compatibility, but the UI doesn't display or use it).

### 4. Fixes Inbox (ported from ReviewView)

Aggregated fixes from ALL sources:
- QA use case failures (auto-pushed from `mark_qa_result`)
- Session fixes (logged via `add_review_fix`)

Sorted by severity: critical → major → minor.

Each fix row shows:
- Severity badge (CRITICAL / MAJOR / MINOR)
- Fix label
- Source indicator (session title it came from)
- Either: "Push" button (pending) or task ID link (promoted) or "DONE" (task completed)

The `promoteFix` function creates a task in the `debug_review` milestone on the Task Board — same behavior as current ReviewView.

---

## Component Architecture

All components in one file: `src/renderer/views/QAView.tsx`

### Keep from current QAView (unchanged)
- `ReadinessBar` — readiness score + progress bar
- `GroupCard` — collapsible use case group with dual status dots
- `UseCaseRow` — individual use case with PASS/FAIL/Reset/Copy Prompt
- `StatusDots` — compact colored dot row
- `NotBuiltSummary` — grayed-out not-built use cases

### Port from ReviewView (simplified)
- `FixesSection` — the entire fixes inbox component. Port as-is, it's self-contained. The only change: remove `laneColor` decoration from fix rows (no lanes in the UI).
- `SessionCard` — unified card replacing both SessionCard and BugCard. Shows: title, status badge, checklist with toggles, progress bar, pending fix count, delete with confirmation. Drop the separate BugCard entirely.
- `NewSessionInput` — inline input for creating sessions. Remove lane parameter. Default `lane: 'backend'` in the data for compatibility.

### Drop entirely
- `DebugLane` — three-column layout component
- `BugCard` — merged into SessionCard
- `StatBox` — replaced by ReadinessBar
- Lane color system (blue/purple/orange)
- Three-lane filtering logic

---

## MCP Tool Changes

### Modify: `create_review_session`
Make `lane` parameter optional. Default to `'backend'`. The field stays in the data schema for backwards compatibility. Tool description updated to remove lane-specific guidance.

### No other tool changes
All other review and QA tools (`add_review_item`, `check_review_item`, `add_review_fix`, `promote_fixes`, `list_review_sessions`, `get_review_session`, `delete_review_session`, `get_qa_status`, `mark_qa_result`, `reset_qa_result`) continue to work unchanged.

---

## Files to Create/Modify/Delete

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/views/QAView.tsx` | Modify | Add Open Sessions section + FixesSection. Replace current simple view with merged view. |
| `src/renderer/views/ReviewView.tsx` | Delete | Entire file removed |
| `src/renderer/App.tsx` | Modify | Remove ReviewView import and route |
| `src/renderer/store.ts` | Modify | Remove `'review'` from TabId |
| `src/renderer/components/TabBar.tsx` | Modify | Remove review tab entry, update QA notification dot to include session fixes |
| `mcp-server/src/tools.ts` | Modify | Make `lane` optional in `create_review_session` |
| Tracker JSON (one-time) | Script | Delete 7 dead sessions |

---

## Design Palette (unchanged)

- Pass: `#1D9E75` (green)
- Fail / Critical: `#ef4444` (red)
- Warning / Major: `#f59e0b` (amber)
- Untested / Minor: `#888780` (gray)
- Accent: `#14B8A6` (teal)
- Surface: `#0F1315`
- Border: `#1A2B28`
- Dark: `#0A0A10`

## Out of Scope

- Migrating session data into QA use cases (sessions remain as freeform, QA use cases remain as structured — they're complementary, not competing)
- Adding a "Run" button that sends prompts to the diagnostic endpoint from the UI (future)
- Session status management in the UI (in_progress/done toggles — not needed for the merge)
- Test history or run logs per use case (future)
