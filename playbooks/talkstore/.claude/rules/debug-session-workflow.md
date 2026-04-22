## Debug Session Workflow

This workflow applies when the operator starts a debugging or review session. It OVERRIDES the standard task workflow — no prepare phase, no explorer/researcher, no post-build auditor. Debug sessions are collaborative and operator-driven.

### When This Applies

Use this workflow when:
- The operator says "let's work on [session name]", "fix this [screenshot]", or similar
- The operator references a session they created in the Review tab
- The work is fixing/polishing existing features, NOT building new ones

Do NOT use this for new feature development — use the standard task workflow for that.

### Phase 1: Find the Session

The **operator creates and names sessions** in the Review tab of the command center. They look like "Chat UI Polish", "Billing Flow Walkthrough", "Onboarding scan bug", etc. You do NOT create sessions — the operator does.

At the start of a debug session:

1. **Call `list_review_sessions`** to see what sessions exist
2. **Match the operator's request** to an existing session. The operator will tell you which session to work on (e.g., "let's work on Chat UI Polish")
3. **Save the session ID** — you'll need it for the rest of the session
4. If no matching session exists, ask the operator to create one in the Review tab first, or if they prefer, offer to create one via `create_review_session`

### Phase 2: Work Loop

This is the core of a debug session — rapid, collaborative iteration:

```
Operator describes what to change → You diagnose → You fix → Record the iteration → Operator verifies → Next
```

For each piece of work completed:

1. **Diagnose** — read the relevant files, identify what needs to change. No explorer agent — you do this inline.

2. **Fix** — make the change directly.

3. **Record the iteration** — call `add_review_item` with `done: true`. Each item is a completed iteration, not a subtask. Describe what was accomplished:
   ```
   add_review_item(
     session_id: "review-ui-1712345678",
     label: "Changed chat background from #1A1A24 to gradient with animated particles",
     done: true
   )
   ```

4. **Report to operator** — briefly describe what you changed and where.

5. **Wait for operator** — they may approve, request adjustment, or describe the next thing to work on.

If the operator mentions something to fix later but not now, record it as pending:
```
add_review_item(
  session_id: "review-ui-1712345678",
  label: "Mobile responsiveness for contribution bar",
  done: false
)
```

When you come back and fix a pending item, call `check_review_item` to mark it done.

### What Gets Recorded

Each checklist item under a session represents a **completed iteration** — a piece of work you and the operator did together. Examples:

- "Changed chat background to dark gradient" ✓
- "Fixed send button color to #14B8A6" ✓
- "Added converging streams particle animation" ✓
- "Adjusted particle paths after visual QA" ✓

These are NOT subtasks to be done. They are a log of what was accomplished. The operator can see the full history of a session by expanding it in the Review tab.

### Phase 3: Build Check

After a batch of fixes (or when the operator is satisfied):

1. Run `npm run build && npm run typecheck && npm run lint`
2. If anything fails, fix it and re-run
3. Commit the batch with a descriptive message:
   ```
   fix(ui): polish chat page — button colors, spacing, input radius
   ```

### Phase 4: Session Wrap

When the operator says the session is done or moves on:
- No formal complete/approve ceremony needed
- The checklist in the Review tab IS the record of what was accomplished

### Lane-Specific Guidance

**UI sessions (visual/layout):**
- Use the visual companion (browser mockups) when the operator needs to see options
- Take Playwright screenshots after fixes for visual verification
- Reference brand palette: `#14B8A6` (accent), `#0A0A10` (dark), `#2DD4BF` (accent light), `#9BAAA6` (muted)
- Expect 2-3 revision rounds — visual polish is iterative

**UX sessions (flow/interaction):**
- Walk through the user journey step by step with the operator
- Focus on: latency, feedback indicators, navigation clarity, error messages
- The operator tests the flow live; you fix friction as they find it

**Backend sessions (logic/data):**
- Diagnose from code, logs, or operator-reported behavior
- Verify fixes with build + manual testing
- Edge cases are common — check related code paths

### Key Differences from Standard Workflow

| Aspect | Standard (Build) | Debug Session |
|--------|-----------------|---------------|
| Who creates work items | Agent (prepare phase) | Operator (Review tab) |
| Initiation | "prepare task X" | "let's work on [session name]" |
| Tracking | MCP tasks (prepare/start/complete) | Review sessions (add_item/check) |
| Agent dispatch | Explorer, Researcher, Auditor | None — you work inline |
| Operator role | Approves at end | Drives throughout |
| Interaction | Low (agent builds autonomously) | High (pair programming) |
| Commit cadence | Per task | Per session/batch |

### MCP Tools Reference

| Tool | When to Call |
|------|-------------|
| `list_review_sessions` | Start of session — find the operator's session |
| `add_review_item` | After completing a piece of work (done: true) or noting something for later (done: false) |
| `check_review_item` | When returning to fix a previously noted pending item |
| `create_review_session` | Only if the operator asks you to create one (they normally do this in the UI) |
| `delete_review_session` | Only when the operator asks to remove a session |
