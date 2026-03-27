# Talkstore Task Audit Prompt

**Instructions:** Copy everything below the line into Claude, GPT, Gemini, and Perplexity. Attach the two files mentioned. Collect all four outputs, then synthesize.

---

## PROMPT START

I'm building a Shopify embedded app called Talkstore. I have two documents attached:

1. **manifesto.md** — The product vision, architecture, principles, and scope boundaries. This is the constitution. Every task must trace back to something in this document.
2. **roadmap.md** — The current execution plan with ~165 checkbox tasks organized into milestones across a 20-week timeline.

The roadmap was written in a single session and has never been validated against the manifesto. I need you to audit the roadmap's tasks and produce a **canonical task list** that I will use as the definitive source of truth going forward.

### What I need you to do:

**PART 1 — AUDIT (analyze before changing anything)**

Go through every task in the roadmap and answer these questions:

1. **Missing tasks:** What does the manifesto require that has no corresponding task in the roadmap? Be specific — cite the manifesto section.
2. **Unnecessary tasks:** Which tasks don't serve the manifesto's goals, are out of scope (see manifesto Section 17), or are busywork that doesn't move the product forward?
3. **Redundant/duplicate tasks:** Which tasks overlap or say the same thing in different words?
4. **Too vague to be actionable:** Which tasks are unclear enough that a developer (or AI coding agent) couldn't execute them without asking clarifying questions? A good task should be completable in a focused work session.
5. **Should be split:** Which tasks are actually 2-3 tasks bundled together?
6. **Should be merged:** Which separate tasks are so tightly coupled they should be a single task?

**PART 2 — REVISED TASK LIST**

Produce a complete, revised task list with this exact structure:

```markdown
## PHASE [N]: [PHASE NAME] (Weeks [X]-[Y])

### WEEK [N] — [Milestone Name]
**Domain:** [foundation | storefront | product_ops | commerce_intel | launch_prep | post_launch]
**Goal:** [One sentence describing the exit criteria for this milestone]

- [ ] [Task description — specific, actionable, completable in one work session]
- [ ] [Task description]
- [ ] ...
```

### Rules for writing tasks:

- Every task must be **specific enough that a developer or AI agent can execute it without asking clarifying questions**
- Every task must trace back to something in the manifesto (product requirement, principle, workflow, or scope item)
- Tasks should be **completable in a single focused work session** (2-4 hours). If it's bigger, split it.
- Don't include tasks for things that are out of scope per manifesto Section 17
- Don't include meta-tasks like "plan X" or "research Y" unless research is genuinely required before building
- Don't duplicate the submission checklist — that's a separate compliance document, not build tasks
- Keep the milestone/week structure from the roadmap (Weeks 1-20), but you can rename milestones or restructure which tasks fall under which week if the current grouping doesn't make sense
- Preserve the timeline structure: Weeks 1-2 Foundation, Weeks 3-5 Storefront, Weeks 6-7 Product Ops, Weeks 8-10 Launch Prep, Weeks 11-12 Review Buffer, Weeks 13-16 V1.2, Weeks 17-20 V1.5

**PART 3 — SUMMARY**

After the revised task list, provide:

1. **Total task count** (original vs. revised)
2. **Tasks added** (list with manifesto section reference)
3. **Tasks removed** (list with reason)
4. **Tasks rewritten** (list with before/after)
5. **Structural changes** (any tasks moved between milestones, and why)
6. **Risk flags** — anything in the manifesto that seems underspecified or contradictory that could cause problems during execution

### Important context:

- This is a **solo founder** build with AI-assisted development (Claude Code, Cursor, etc.)
- The Shopify submission checklist is handled separately — don't merge compliance items into build tasks
- The "Parallel Track" section (waitlist, distribution, video) is marketing work that Luqman handles himself — include these tasks but don't over-specify them
- The app uses: Shopify Remix, Vercel AI SDK, Anthropic Claude, PostgreSQL (Supabase), Railway hosting
- The three domains are: Storefront (theme generation/modification), Product Ops (data enrichment/collections), Commerce Intelligence (read-only analytics)
- The billing model is: Free (3 tasks) → PAYG ($5/task) → Growth ($79/mo) → Pro ($149/mo)

## PROMPT END
