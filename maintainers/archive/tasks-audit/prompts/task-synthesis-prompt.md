# Talkstore Task Synthesis Prompt

**Instructions:** Upload the manifesto + all three audit files into one LLM (Claude recommended for context window). Copy everything below the line.

---

## PROMPT START

I'm building a Shopify app called Talkstore. I ran a task audit across three LLMs (Claude, GPT, and Gemini) to validate my roadmap against my product manifesto. I now have three separate opinions on what the canonical task list should look like.

**Attached files:**
1. **manifesto.md** — The product constitution. This is the ultimate authority.
2. **claude-audit.md** — Claude's revised task list and audit
3. **gpt-audit.md** — GPT's revised task list and audit
4. **gemini-audit.md** — Gemini's revised task list and audit

Your job is NOT to pick a winner. Your job is to **synthesize** these three opinions into one canonical task list by finding consensus and surfacing conflicts for me to resolve.

### STEP 1 — CONSENSUS ANALYSIS

For every task across all three audits, categorize it:

**AGREED (3/3):** All three LLMs included this task (possibly worded differently). These go directly into the final list. Use the best wording from the three.

**MAJORITY (2/3):** Two LLMs included this task, one didn't. These go into the final list unless the dissenting LLM gave a compelling reason to exclude it. Note which LLM dissented and why.

**CONTESTED (1/3):** Only one LLM included this task. List these separately with the rationale that LLM gave. I'll decide on each one.

**UNANIMOUSLY CUT:** All three LLMs agreed to remove a task from the original roadmap. List these with their shared reasoning.

### STEP 2 — CONFLICT RESOLUTION TABLE

For any task where the three LLMs disagreed on **scope, wording, or placement** (which week/milestone it belongs in), create a table:

```
| Task Topic | Claude's Position | GPT's Position | Gemini's Position | Recommendation |
```

Your recommendation should favor:
- The position that best aligns with the manifesto
- The more specific/actionable wording
- The more logical milestone placement given dependencies

### STEP 3 — PRODUCE THE CANONICAL TASK LIST

Output the final synthesized task list using this exact format:

```markdown
## PHASE [N]: [PHASE NAME] (Weeks [X]-[Y])

### WEEK [N] — [Milestone Name]
**Domain:** [foundation | storefront | product_ops | commerce_intel | launch_prep | post_launch]
**Goal:** [One sentence — the exit criteria for this milestone]

- [ ] [Task description]
- [ ] [Task description]
```

Rules:
- Use the timeline structure: Weeks 1-2 Foundation, 3-5 Storefront, 6-7 Product Ops, 8-10 Launch Prep, 11-12 Review Buffer, 13-16 V1.2, 17-20 V1.5
- Every task must be specific enough for a developer or AI agent to execute without asking questions
- Every task must trace to the manifesto
- Tasks should be completable in a single focused session (2-4 hours)
- Do NOT include submission checklist items — those are managed separately
- Marketing/distribution tasks can stay but keep them light

### STEP 4 — DECISION ITEMS FOR ME

List every contested item or unresolved conflict as a numbered decision I need to make. Format:

```
DECISION 1: [Topic]
- Option A: [description] (supported by: [which LLMs])
- Option B: [description] (supported by: [which LLMs])
- Stakes: [what happens if I pick wrong — is this high or low consequence?]
```

### STEP 5 — FINAL SUMMARY

Provide:
1. Original task count (from roadmap): ~165
2. Agreed tasks (3/3): [count]
3. Majority tasks (2/3): [count]
4. Contested tasks (1/3): [count]
5. Unanimously cut: [count]
6. Final task count (before my decisions on contested items): [count]
7. Decisions I need to make: [count]
8. Risk flags all three LLMs agreed on (if any)

## PROMPT END
