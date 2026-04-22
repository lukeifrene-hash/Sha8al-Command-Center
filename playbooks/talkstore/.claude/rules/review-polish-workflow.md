## Review & Polish Workflow (DEPRECATED)

> **This workflow is superseded by `debug-session-workflow.md`.** Use the Debug Session Workflow for all review and polish work. It uses the Review tab in the command center instead of the task board.

### Legacy Reference (review_polish milestone only)

This workflow previously overrode the standard task workflow for tasks inside the `review_polish` milestone.

### Phase 1: Triage (operator reports an issue)

The operator describes an issue via text and/or screenshots. The orchestrator:

1. Classify the issue as one of:
   - **UI** — visual/layout (wrong color, misaligned, broken responsive, missing element)
   - **UX** — flow/interaction (confusing, missing feedback, wrong navigation, unclear copy)
   - **Backend** — logic/data (wrong data, failed request, incorrect behavior)
2. Create a task in the `review_polish` milestone via MCP with:
   - Title: concise description of the issue
   - Classification tag in the notes field (e.g., `[UI]`, `[UX]`, `[Backend]`)
   - Priority based on severity
3. Confirm the task definition with the operator before proceeding

### Phase 2: Prepare (Diagnostician — single agent)

No explorer. No researcher. The orchestrator acts as the diagnostician:

1. Read the relevant source files (component, route, CSS, handler — whatever applies)
2. Identify the root cause or narrow it to 1-2 candidates
3. Write `docs/prompts/<task_id>.md` with:
   - **Issue**: what's wrong (reference the operator's screenshot/description)
   - **Classification**: UI / UX / Backend
   - **Root cause**: which file(s) and line(s)
   - **Fix spec**:
     - For UI: exact CSS/component changes, brand palette values (`#14B8A6`, `#0A0A10`, etc.), spacing in px/rem, Polaris tokens. Include an ASCII/SVG mockup of the expected result when layout changes are involved.
     - For UX: current flow vs expected flow, which components to modify, what feedback to add
     - For Backend: the bug trace, the fix, edge cases to handle
   - **Files to modify**: explicit list
   - **Acceptance criteria**: how to verify the fix is correct
4. Call `enrich_task` with `builder_prompt` pointing to the prompt file
5. Task stays in `todo`

### Phase 3: Build

When the operator says `start task X`:

1. Call `start_task(task_id)`
2. Implement the fix from the prompt
3. Run `npm run build && npm run typecheck && npm run lint`
4. If validation fails, fix and rerun until clean

### Phase 4: Post-build (lightweight)

No security agent. No compliance agent. No post-build auditor.

1. **Build check**: `build + typecheck + lint` must pass (already done in Phase 3)
2. **Visual verification** (UI/UX tasks only): take a Playwright screenshot of the affected page/component and present it to the operator in the conversation
3. **Spec check** (all tasks): verify the acceptance criteria from the prompt are met — grep for expected values, confirm file changes match the spec

### Phase 5: Operator review

1. Call `complete_task(task_id, summary)`
2. The operator reviews:
   - For UI: looks at the Playwright screenshot. Either approves or gives specific feedback ("spacing is still off", "color is wrong")
   - For UX/Backend: tests the flow or confirms the fix
3. Revision feedback triggers `reject_task` -> fix -> `complete_task` (same as standard workflow)
4. **1-2 revision rounds are expected for UI tasks** — this is normal, not a failure

### Playwright Screenshot Protocol

For UI and UX tasks, after the builder finishes:

1. Navigate to the affected page using `mcp__playwright__browser_navigate`
2. Wait for the page to settle using `mcp__playwright__browser_wait_for`
3. Take a screenshot using `mcp__playwright__browser_take_screenshot`
4. Present the screenshot to the operator
5. If the operator requests a different viewport or state, take additional screenshots

### Key Differences from Standard Workflow

| Aspect | Standard | Review & Polish |
|--------|----------|-----------------|
| Prepare agents | Explorer + Researcher | Orchestrator only (diagnostician) |
| Prompt style | Full feature spec | Scoped fix + visual mockup |
| Post-build | Post-Build Auditor | Build check + Playwright screenshot |
| Revision expectation | 1 round | 1-2 rounds (UI is iterative) |
| Security/compliance | Full audit | Skipped (scoped fixes, not new features) |
