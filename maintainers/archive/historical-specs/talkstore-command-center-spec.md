# Sha8al Command Center Historical Spec — TalkStore Compatibility Build Spec v1.0

> Historical note: this document describes the original TalkStore-first build shape. The public platform identity is now Sha8al Command Center (`sha8al-command-center`), and TalkStore is a compatibility profile.

**What this is:** The complete build specification for an Electron desktop app that serves as the project management command center for the Talkstore product. This document is the prompt. An agent reading this file should be able to build the app from scratch.

**Project location:** `/Users/luqman/Desktop/Projects/talkstore-command-center/`

**Source data files (read-only references — do NOT modify):**
- `/Users/luqman/Desktop/Projects/talkstore/docs/roadmap.md` — The 20-week build roadmap. Every milestone, sub-task, and deliverable in the command center is extracted from this file.
- `/Users/luqman/Desktop/Projects/talkstore/docs/manifesto.md` — Product architecture reference. The 3 Domains (Storefront, Product Ops, Commerce Intelligence) and the submission checklist categories come from here.
- `/Users/luqman/Desktop/Projects/talkstore/docs/submission-checklist.md` — The full 12-category, 58-item pre-submission checklist.

**Design system:**
- Dark theme (background: `#0A0A10`, surface: `#111118`, border: `#1a1a2e`)
- Talkstore Indigo palette: Accent `#585CF0`, Accent Light `#8286FF`, Muted `#9B9BAA`, White `#FFFFFF`
- Domain colors: Storefront `#22c55e`, Product Ops `#f59e0b`, Commerce Intelligence `#8286FF`, Distribution `#9B9BAA`
- Status colors: On Track `#22c55e`, Behind `#ef4444`, Ahead `#22c55e`, Blocked `#ef4444`
- Font: Inter (primary), JetBrains Mono (code/JSON displays)

---

## Architecture Overview

The Command Center is an Electron app with three views (tabs), all reading from and writing to a single shared state file.

### The Shared State File

**Path:** `/Users/luqman/Desktop/Projects/talkstore/talkstore-tracker.json`

This JSON file is the single source of truth. The Electron app reads it on launch and watches it for external changes (via `fs.watch`). Coding agents (Claude, Codex, Cursor) can also read/write this file. When any agent modifies the file, the Electron app detects the change and refreshes the UI.

### Three Views

| View | Tab Label | Purpose | Primary Question |
|------|-----------|---------|-----------------|
| **Swim Lane** | ⬡ Swim Lane | Strategic 20-week roadmap timeline | "Where are we in the big picture?" |
| **Task Board** | ⊞ Task Board | Tactical daily/weekly Kanban execution | "What do I do right now?" |
| **Agent Hub** | ⚡ Agent Hub | Agent monitoring, activity feed, shared state info | "What have my agents been doing?" |

### Data Flow

- Swim Lane milestones contain sub-tasks
- Sub-tasks populate the Task Board as Kanban cards
- Moving a card to "Done" on the Task Board auto-updates the Swim Lane milestone's progress ring
- Agent actions are logged in the activity feed (Agent Hub)
- All three views reflect the same underlying `talkstore-tracker.json` state

---

## Shared State File Schema

The `talkstore-tracker.json` file must conform to this schema. **Phase 1 must generate this file by parsing the roadmap markdown.**

```json
{
  "project": {
    "name": "Talkstore",
    "start_date": "2026-03-15",
    "target_submit_date": "2026-05-24",
    "current_week": 2,
    "schedule_status": "on_track",
    "overall_progress": 0.12
  },
  "milestones": [
    {
      "id": "scaffold_auth_shell",
      "title": "Scaffold + Auth + Shell",
      "domain": "foundation",
      "week": 1,
      "phase": "foundation",
      "planned_start": "2026-03-15",
      "planned_end": "2026-03-21",
      "actual_start": null,
      "actual_end": null,
      "drift_days": 0,
      "is_key_milestone": false,
      "key_milestone_label": null,
      "subtasks": [
        {
          "id": "scaffold_001",
          "label": "Shopify Remix app scaffolded from official template",
          "done": false,
          "assignee": null,
          "blocked_by": null,
          "blocked_reason": null,
          "completed_at": null,
          "completed_by": null,
          "priority": "P1",
          "notes": null
        }
      ],
      "dependencies": [],
      "notes": []
    }
  ],
  "submission_checklist": {
    "categories": [
      {
        "id": "oauth",
        "title": "OAuth + Auth",
        "risk_level": "normal",
        "target_week": 1,
        "items": [
          {
            "id": "oauth_001",
            "label": "Install always starts from a Shopify surface",
            "done": false,
            "linked_milestone": "scaffold_auth_shell",
            "completed_at": null,
            "completed_by": null
          }
        ]
      }
    ]
  },
  "agents": [
    {
      "id": "claude_chat",
      "name": "Claude (Project Chat)",
      "type": "synchronous",
      "color": "#22c55e",
      "status": "active",
      "permissions": ["read", "write"],
      "last_action_at": null,
      "session_action_count": 0
    }
  ],
  "agent_log": [
    {
      "id": "log_001",
      "agent_id": "claude_chat",
      "action": "completed_subtask",
      "target_type": "subtask",
      "target_id": "scaffold_001",
      "description": "Marked 'Shopify Remix app scaffolded' as complete",
      "timestamp": "2026-03-16T14:30:00Z",
      "tags": ["write"]
    }
  ],
  "schedule": {
    "phases": [
      {
        "id": "foundation",
        "title": "Foundation",
        "color": "#585CF0",
        "start_week": 1,
        "end_week": 2
      },
      {
        "id": "storefront",
        "title": "Storefront",
        "color": "#22c55e",
        "start_week": 3,
        "end_week": 5
      },
      {
        "id": "product_ops",
        "title": "Product Ops",
        "color": "#f59e0b",
        "start_week": 6,
        "end_week": 7
      },
      {
        "id": "launch_prep",
        "title": "Launch Prep",
        "color": "#ef4444",
        "start_week": 8,
        "end_week": 10
      },
      {
        "id": "review_buffer",
        "title": "Review Buffer",
        "color": "#9B9BAA",
        "start_week": 11,
        "end_week": 12
      },
      {
        "id": "v1_2",
        "title": "V1.2",
        "color": "#8286FF",
        "start_week": 13,
        "end_week": 16
      },
      {
        "id": "v1_5",
        "title": "V1.5",
        "color": "#585CF0",
        "start_week": 17,
        "end_week": 20
      }
    ]
  }
}
```

**Critical: The `milestones` array and `submission_checklist` object must be populated by parsing the roadmap and checklist markdown files.** Every `- [ ]` checkbox in the roadmap becomes a subtask. Every `- ⬜` item in the checklist becomes a checklist item. Do not hardcode — parse.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | Electron | Cross-platform, file system access, runs as standalone app |
| UI framework | React 18+ | Component-based, works seamlessly with Electron |
| Styling | Tailwind CSS | Utility-first, fast iteration, matches dark theme |
| State management | Zustand | Lightweight, no boilerplate, works well with file-based state |
| File watching | `chokidar` (or Node `fs.watch`) | Detect external changes to tracker.json |
| Build tool | Vite + electron-vite or electron-forge | Fast dev server, HMR support |
| Markdown parsing | `marked` or `remark` | Parse roadmap/checklist .md files into structured data |

---

## PHASE 1: Foundation (MUST complete before any other phase)

**Phase 1 is sequential. All other phases depend on it. Do not start Phase 2, 3, or 4 until Phase 1 is fully working.**

### 1.1 — Project Scaffold

Set up the Electron + React + Tailwind project.

- Initialize Electron app with React renderer (use `electron-vite` or `electron-forge` with Vite)
- Configure Tailwind with the Talkstore design system colors as custom theme values
- Install Inter and JetBrains Mono fonts
- Set up the main window: frameless or native title bar (preference: native macOS title bar for simplicity), minimum size 1200×800
- Dark theme applied globally (background `#0A0A10`)
- Hot module replacement working in dev mode

### 1.2 — Markdown Parser + State File Generator

**This is the most critical piece of Phase 1.** Build a parser that reads the three source markdown files and generates the initial `talkstore-tracker.json`.

Parser requirements:
- Read `/Users/luqman/Desktop/Projects/talkstore/docs/roadmap.md` and extract:
  - Every week section (WEEK 1 through WEEK 20)
  - Every milestone (the bold deliverable headers under each week)
  - Every `- [ ]` checkbox item as a subtask under its parent milestone
  - The phase groupings (Foundation = Weeks 1-2, Storefront = Weeks 3-5, etc.)
  - Key milestones: "E2E Flow" (Week 4, Revenue #1), "Enrichment" (Week 6, Revenue #2), "Insight→Action" (Week 8), "App Store Submit" (Week 10)
  - Exit criteria text for each week (stored in milestone notes)
- Read `/Users/luqman/Desktop/Projects/talkstore/docs/submission-checklist.md` and extract:
  - All 12 numbered categories (1. OAuth, 2. Session/Security, etc.)
  - Every `- ⬜` item as a checklist item under its category
  - Special handling: Category 8 (Theme Interaction) flagged as `risk_level: "critical"`
  - The "Pre-Submission Final Checks" section as a separate category
- Assign `target_week` to each checklist category based on when items should realistically be addressed (OAuth → Week 1, Billing → Week 9, Listing → Week 10, etc.)
- Generate `talkstore-tracker.json` with the full schema above
- Write the file to `/Users/luqman/Desktop/Projects/talkstore/talkstore-tracker.json`

The parser should also be callable as a rebuild/refresh command — if the roadmap or checklist changes, re-running the parser regenerates the state file (preserving completion status of already-done items).

### 1.3 — App Shell + Tab Navigation

Build the persistent app chrome that wraps all three views.

- Tab bar at the top: three tabs (⬡ Swim Lane, ⊞ Task Board, ⚡ Agent Hub)
- Active tab has a filled background with its accent color, inactive tabs are muted
- Global status bar in the tab row showing:
  - Current week + phase name (e.g., "WEEK 2 · Foundation")
  - Overall progress bar (percentage of total subtasks completed)
  - Schedule status chip ("ON TRACK" green / "BEHIND" red / "AHEAD" green)
  - Agent sync indicator (green dot + "synced" when file watcher is active)
- Tab switching renders the corresponding view component
- State is loaded from `talkstore-tracker.json` into Zustand store on app launch
- File watcher initialized on launch, updates Zustand store when external changes detected

### 1.4 — State Management Layer

- Zustand store initialized from `talkstore-tracker.json`
- Every state mutation writes back to the JSON file (debounced, 500ms)
- File watcher detects external writes and refreshes the store (with conflict avoidance: skip refresh if the app just wrote)
- Derived state computed:
  - `current_week` calculated from `project.start_date` and today's date
  - `overall_progress` = total done subtasks / total subtasks
  - `schedule_status` derived from milestone drift values
  - Per-milestone progress = done subtasks / total subtasks for that milestone
  - Per-checklist-category progress = done items / total items for that category

**Phase 1 exit criteria:** App launches, loads state from parsed tracker.json, shows tab bar with correct current week and progress, tabs switch between empty view placeholders, file watcher is active.

---

## PHASE 2: Swim Lane View (can begin after Phase 1)

### 2.1 — Timeline Grid

- Horizontal scrollable timeline with week columns (W1 through W20)
- Phase background spans (colored translucent rectangles behind week groups)
- Vertical "NOW" marker line positioned at the current week, calculated from `project.start_date`
- Week headers at the top

### 2.2 — Domain Swim Lanes

Four horizontal lanes, each labeled on the left with the domain name rotated vertically:
- **Storefront** (green `#22c55e`)
- **Product Ops** (amber `#f59e0b`)
- **Commerce Intelligence** (blue `#8286FF`)
- **Distribution** (muted `#9B9BAA`)

Each lane has a subtle border and tinted background matching its domain color.

Milestones from the tracker are placed as circular nodes on their respective lanes, positioned at their week column. Each node shows:
- Progress ring: an SVG circle with `stroke-dasharray` proportional to subtask completion (e.g., 6/11 = ~55% of the circumference filled)
- Center text: `done/total` count (e.g., "6/11")
- Label below the node: milestone title (truncated if long)
- Key milestones: slightly larger node with a glow effect and a "★ Revenue #1" or similar label

Nodes connected by horizontal lines within a lane.

### 2.3 — Schedule Drift Visualization

Each milestone node has two possible positions:
- **Planned position:** fixed at the milestone's `planned_start` week column
- **Actual position:** shifted left (ahead) or right (behind) based on `drift_days`

When drift exists:
- A ghost circle (dashed outline, low opacity) stays at the planned position
- The actual node shifts to the adjusted position
- A colored bar connects them: green bar if ahead, red bar if behind
- A small badge below the node shows drift (e.g., "3 DAYS ▸" in red or "1 DAY ◂" in green)

When no drift: only the actual node is shown (planned and actual overlap).

### 2.4 — Submission Checklist Lane

A fifth lane below Distribution, dedicated to the submission checklist:
- Continuous bar spanning Week 1 through Week 10 (with label "BUILD COMPLIANCE FROM WEEK 1")
- 12 category blocks arranged in a grid (3 rows × ~5 columns, or responsive)
- Each block shows: category name, mini progress bar, done/total count, and a colored dot indicating target week
- Category 8 (Theme Interaction) highlighted with red border and "⚠ #1 REVIEW RISK" label
- "Pre-Submission Final Checks" block styled distinctly at the end
- Clicking a category block opens the milestone detail panel (Phase 2.5) showing that category's items

### 2.5 — Milestone Detail Panel

Clicking any milestone node or checklist category opens a slide-out panel on the right side (approximately 500px wide):
- Panel header: domain tag + week + milestone title + description
- Progress bar: done/total with percentage
- Schedule section: planned start/end dates (editable date pickers), actual start/end, status chip, drift display
- **Sub-tasks checklist:** each subtask as a checkbox row. Clicking the checkbox toggles `done` and writes to state. Show assignee badge if set, blocker indicator if blocked.
- **Dependencies section:** lists milestones that must complete before this one, each showing its own progress count
- **Schedule adjustment:** date pickers for start/end. Changing dates triggers a ripple effect — all downstream milestones shift by the same delta. Show a "Ripple Effect" info box listing affected milestones before saving.
- **Notes section:** free text area for blockers, decisions, context. Stored in milestone `notes` array.
- Close button to dismiss panel

### 2.6 — Major Milestone Markers

Diamond-shaped markers at the bottom of the timeline for:
- **App Store Submit** (Week 10) — red, prominent
- **V1.2 Ship** (Week 16) — blue
- **V1.5 Ship** (Week 20) — indigo

Vertical dashed lines extending up from each diamond through all lanes.

---

## PHASE 3: Task Board View (can begin after Phase 1)

### 3.1 — Context Bar

Top bar showing which milestone's tasks are currently displayed:
- Active milestone node (progress ring + done/total), title, domain, week
- "Next Up" preview showing the next milestone in sequence
- Milestone selector: dropdown or navigation arrows to switch between milestones

### 3.2 — Filter Bar

Below context bar:
- Filter pills: All (default), My Tasks, Agent Tasks, Blocked
- Filters work by checking `assignee` and `blocked_by` fields on subtasks

### 3.3 — Kanban Columns

Four columns:
- **TO DO** (header bar: muted gray) — subtasks where `done: false` and not in progress or blocked
- **IN PROGRESS** (header bar: indigo `#585CF0`) — subtasks currently being worked on (needs a `status` field on subtasks: "todo" | "in_progress" | "done" | "blocked")
- **DONE** (header bar: green `#22c55e`) — subtasks where `done: true`
- **BLOCKED** (header bar: red `#ef4444`) — subtasks where `blocked_by` is not null

**Update the schema:** Add a `status` field to each subtask: `"todo" | "in_progress" | "done" | "blocked"`. The `done` boolean remains as a convenience but `status` is the primary field for the task board.

### 3.4 — Task Cards

Each card shows:
- **Domain tag:** colored pill (Storefront green, Product Ops amber, etc.) determined by the parent milestone's domain
- **Priority badge:** P1 (red), P2 (amber), P3 (muted) — top right corner
- **Title:** subtask label text (the main content)
- **Description/hint:** secondary text if the subtask label is long, show first line as title and remainder as description
- **Blocker bar:** if blocked, a red bar at the bottom showing `blocked_reason`
- **Assignee badge:** pill showing assignee name (e.g., "Luqman", "Claude ⚡") — bottom right
- **Time tracking (optional, V2):** elapsed time indicator for in-progress cards
- Active left-border glow (indigo) for in-progress cards
- Agent badge: if assigned to an agent, show a pulsing dot icon

Cards should be **draggable** between columns. Dragging a card from TO DO to IN PROGRESS updates its `status`. Dragging to DONE sets `done: true` and `status: "done"`. All changes write back to tracker.json.

### 3.5 — Card Detail Modal

Clicking a card opens a modal with:
- Full subtask label
- Status selector (dropdown)
- Assignee selector (dropdown of registered agents + "Luqman")
- Priority selector
- Blocker toggle: checkbox to mark as blocked + text field for reason
- Dependency display: which other subtasks this one depends on
- Notes field
- Parent milestone link (click to switch to Swim Lane and open that milestone's panel)
- Save and close

### 3.6 — Submission Checklist Integration

Submission checklist items that are linked to the current milestone (via `linked_milestone`) should appear as a separate section below the Kanban columns, or as a collapsible drawer:
- Title: "Submission Checklist Items for This Milestone"
- Simple checkbox list of relevant items
- Each checked item writes to the `submission_checklist` in the tracker

---

## PHASE 4: Agent Hub View (can begin after Phase 1)

### 4.1 — Connected Agents Panel (Left Column)

Top section showing registered agents:
- Each agent as a card: colored status dot (active/idle), name, last action timestamp, session action count, permission badges (READ, WRITE)
- Status: "ACTIVE" (green) if the agent has written to tracker.json in the last 30 minutes, "IDLE" otherwise
- "Connect New Agent" button at the bottom (opens a form to add agent `id`, `name`, `color`, `permissions`)
- Agent cards should be collapsible groups to support future hierarchy (e.g., OpenClaw orchestrator with child agents nested underneath)

### 4.2 — Shared State File Info

Below agents panel:
- File path display
- File size, last modified timestamp, watcher status (active/inactive)
- Content counts: milestones, subtasks, checklist items, log entries
- Schema integrity check indicator (valid/invalid)

### 4.3 — Context Injection Preview

Below state file info:
- Read-only display showing auto-generated context summary that agents can consume at session start
- Format: plain text showing current week, active milestone, remaining tasks, blocked items, schedule status
- "Copy to Clipboard" button
- "Edit Template" button (opens a text editor for customizing the context template — stored as a `context_template` string in the tracker)

### 4.4 — Today's Summary

Bottom of left column:
- Three stat boxes: tasks completed today, in progress, blocked
- Contribution breakdown by agent (colored dots + counts)

### 4.5 — Activity Feed (Right Column)

Chronological log of all actions from `agent_log`:
- Grouped by day ("TODAY", "YESTERDAY", older dates)
- Each entry: agent color dot, agent name (bold, in agent color), action description, target reference, tags (pills: "WRITE ✓", "CHECKLIST", "COMMIT", "SCHEDULE", "ALERT", "NOTE"), timestamp (right-aligned)
- System alerts (drift detected, blockers exceeding threshold) styled with red border
- Filter tabs at top: All, then one tab per registered agent, plus Manual and System
- Search bar to filter by keyword
- "Load more" at the bottom for older entries

### 4.6 — Agent Performance Stats

Bottom of right column:
- Stat boxes showing each agent's action count for the current week
- Total actions, checklist items completed, alerts triggered

---

## PHASE 5: Polish + Quality of Life (after Phases 2, 3, 4)

### 5.1 — Keyboard Shortcuts
- `Cmd+1` / `Cmd+2` / `Cmd+3` to switch tabs
- `Cmd+F` to search within current view
- `Escape` to close any open panel or modal
- `Space` to toggle selected subtask checkbox (when Swim Lane detail panel is open)

### 5.2 — Ripple Effect Engine
- When a milestone's dates are adjusted, calculate the delta and shift all downstream milestones by the same amount
- Show a confirmation dialog listing all affected milestones before applying
- Update `drift_days` on all affected milestones

### 5.3 — Notifications
- In-app toast notifications for:
  - External tracker.json changes detected (agent wrote to file)
  - Milestone completed (all subtasks done)
  - Drift threshold exceeded (any milestone >3 days behind)
  - Submission checklist category fully completed

### 5.4 — Data Persistence Safety
- Backup tracker.json before every write (keep last 10 backups in a `.backups/` directory)
- On corrupt JSON detection (parse failure), restore from latest backup and notify user
- Never lose data

### 5.5 — Export/Print
- Export Swim Lane view as PNG (for sharing on streams/social)
- Export progress report as markdown (for weekly updates)

---

## Milestone-to-Domain Mapping Reference

Use this mapping when assigning milestones to swim lanes. Extracted from the roadmap:

| Milestone | Domain | Week | Key? |
|-----------|--------|------|------|
| Scaffold + Auth + Shell | foundation | 1 | No |
| Tool Router + API Connections | foundation | 2 | No |
| Section Generation Engine | storefront | 3 | No |
| Theme Duplication + Install + Preview | storefront | 4 | Yes — "Revenue #1" |
| Section Modification + Settings Detection | storefront | 5 | No |
| Product Scanning + Scoring + Enrichment | product_ops | 6 | Yes — "Revenue #2" |
| Collections + Rollback + Edge Cases | product_ops | 7 | No |
| Commerce Intelligence Domain | commerce_intel | 8 | Yes — "Insight→Action" |
| Billing + Onboarding Scan | launch_prep | 9 | No |
| Polish + App Store Submission | launch_prep | 10 | Yes — "APP STORE SUBMIT" |
| Review Buffer — Beta Testing | review_buffer | 11-12 | No |
| Live Feedback + Fixes | v1_2 | 13-14 | No |
| V1.2 Feature Additions | v1_2 | 15-16 | Yes — "V1.2 Ship" |
| Proactive Insights Engine | v1_5 | 17-18 | No |
| Advanced Features + Sidekick Extension | v1_5 | 19-20 | Yes — "V1.5 Ship" |

Distribution milestones (Landing Page, Video Teaser, Beta Recruitment) go in the Distribution lane and are pulled from the "PARALLEL TRACK" section of the roadmap.

---

## Checklist Category-to-Week Mapping Reference

| Category | ID | Target Week | Risk Level |
|----------|-----|-------------|------------|
| 1. OAuth + Auth | oauth | 1 | normal |
| 2. Session + Security | session_security | 1 | normal |
| 3. Privacy + GDPR | privacy_gdpr | 9 | normal |
| 4. Billing | billing | 9 | normal |
| 5. UI/UX + Polaris | ui_ux_polaris | 1 | normal |
| 6. Performance | performance | 5 | normal |
| 7. API + Scopes | api_scopes | 2 | normal |
| 8. Theme Interaction | theme_interaction | 4 | **critical** |
| 9. Listing + Brand | listing_brand | 10 | normal |
| 10. Webhooks + Lifecycle | webhooks_lifecycle | 10 | normal |
| 11. App Bridge | app_bridge | 1 | normal |
| 12. Safety + Support | safety_support | 1-10 | normal |
| Pre-Submission Final Checks | pre_submit | 10 | normal |

---

## Phase Dependency Graph

```
PHASE 1 (Foundation) ← MUST complete first
    │
    ├── PHASE 2 (Swim Lane)     ─── can run in parallel ───┐
    ├── PHASE 3 (Task Board)    ─── can run in parallel ───┤
    └── PHASE 4 (Agent Hub)     ─── can run in parallel ───┘
                                                            │
                                                      PHASE 5 (Polish)
                                                    after 2 + 3 + 4 done
```

Phases 2, 3, and 4 share no component dependencies. They all read from the same Zustand store (built in Phase 1) and render into their own tab view. An agent can be assigned to each phase independently after Phase 1 ships.

---

## Agent Instructions for Working With This Spec

When you are an agent building from this spec:

1. **Read the source markdown files first.** Parse them before writing any code. The roadmap and checklist contain the actual data.
2. **Phase 1 is blocking.** Do not skip it. The tracker.json file and the state management layer are the foundation everything else depends on.
3. **Write to the tracker.json file** when you complete a subtask from this build spec. Log your action in the `agent_log` array so the command center itself tracks its own build progress.
4. **Do not modify the source markdown files.** They are read-only references. The tracker.json is the mutable state.
5. **Test with real data.** The parser should produce a tracker with approximately 18 milestones and 128 subtasks. If you get significantly fewer, the parser is missing sections.
6. **Respect the design system.** Dark theme, Talkstore colors, Inter font. The app should feel like it belongs alongside the Talkstore product itself.

---

## Future Integrations (Not in Scope for V1)

These are documented for context only. Do not build them now.

- **OpenClaw integration:** Connect OpenClaw agent hierarchy to the Agent Hub. OpenClaw orchestrator + child agents (Content, Community, Distribution) nested under a collapsible group. Approvals queue for agent-generated content awaiting human review.
- **Git integration:** Auto-detect commits that match subtask labels and mark them complete.
- **Sifr0 stream overlay:** Export current milestone status as an OBS overlay for live streams.
- **Mobile companion:** Read-only progress view accessible from phone.

---

*This document is the original build spec for the TalkStore compatibility version of Sha8al Command Center. The source data lives in the roadmap and manifesto markdown files. The output is an Electron app that every agent on the project can read, write, and orient from.*

**Build it. Ship it. Track everything.**
