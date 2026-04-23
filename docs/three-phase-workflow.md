# Three-Phase Task Workflow

This document describes the current milestone-driven autonomous flow used by Sha8al Command Center. The workflow is organized around milestones, waves, tiers, preparation, build, and audit. It replaces the older task-by-task model that centered the operator around single-task state transitions.

## Overview

The modern flow is built around these commands:

- `next`
- `sweep`
- `prepare`
- `build`
- `auto`
- `audit`

These commands operate on a dependency graph, not on isolated tasks. The tracker records task state, dependencies, lane, and audit status; the commands are the operator surface for moving that graph forward.
For the public `generic` profile, those task tiers start with automatic sizing from `docs/roadmap.md`.

## Phase 1: Surface And Drain Ready Work

This phase answers one question: what can move right now?

Commands:

- `next`
- `sweep M<N> <tier>`

What happens:

1. `next` shows the currently unblocked work, grouped by tier.
2. `sweep` walks the current wave for a specific milestone tier.
3. Same-wave tasks are parallelized when file-collision checks allow it.
4. Completed work moves into `review`, and approvals can unblock the next wave.

This phase is the normal entry point for `small` work.

## Phase 2: Prepare And Build Higher-Tier Work

This phase handles work that needs explicit context before implementation.

Commands:

- `prepare M<N> <tier>`
- `prepare M<N> all`
- `prepare T<id>`
- `build M<N> <tier>`
- `build T<id>`

What happens:

1. `prepare` enriches the work with Explorer and Researcher findings.
2. The canonical builder prompt is written to `docs/prompts/M<N>/<task_id>.md`.
3. `build` executes prepared work from that enriched brief.
4. Non-small tasks always go through the task auditor after build.

This phase is the normal path for:

- `medium`
- `large`
- `architectural`

`prepare M<N> all` is the convenience wrapper for preparing every non-small task in a milestone while keeping medium tasks batch-oriented and large or architectural tasks deeper and lower-concurrency.

## Phase 3: Autonomous Drain And Milestone Audit

This phase is where the system keeps moving until it hits a natural checkpoint, then verifies the milestone as a whole.

Commands:

- `auto M<N>`
- `audit M<N>`
- `approve T<id>`
- `audit T<id> --cross`

What happens:

1. `auto` composes the logic of `next`, `sweep`, and `build`.
2. It keeps walking waves until there is no more safe progress to make.
3. `audit M<N>` runs the milestone-level specialist audit pass once the milestone is ready.
4. Rare overrides remain available for manual approval or a cross-model second opinion.

## Command Roles

| Command | Role in the flow | Primary stop condition |
| --- | --- | --- |
| `next` | Show the current actionable queue | None; read-only |
| `sweep` | Drain one milestone tier wave by wave | No more unblocked work of that tier |
| `prepare` | Enrich medium and larger work before implementation, including milestone-wide `all` prep | Prepare completed for the target scope |
| `build` | Execute prepared work and trigger audit | Build or audit failure, or batch completion |
| `auto` | Continue milestone execution until a natural checkpoint | Human/pair task, unprepared higher-tier task, review stop, audit failure, no unblocked work, or task cap |
| `audit` | Run milestone-level audit after execution is done | Milestone not ready or audit completion |

## Wave And Tier Semantics

The workflow depends on two core ideas:

### Waves

A wave is the set of tasks that become actionable together once dependencies are cleared.

Rules:

- a later wave cannot execute until the earlier wave is resolved
- approvals and auto-unblock expose the next wave
- same-wave tasks can run in parallel when collision checks permit

### Tiers

Tiers determine how work is handled:

- `small`: direct execution through `sweep`
- `medium`: must be prepared, then built
- `large`: must be prepared, then built with deeper context
- `architectural`: same as large, but with the widest scope and highest need for careful review

## Auditor Behavior

The task auditor runs after every non-small build.

It checks:

- build, typecheck, lint, and acceptance commands
- scope and failure-mode correctness
- secrets, dependencies, and injection safety
- merchant-data scoping and consent requirements
- logging hygiene, tests, and migration reversibility

Small tasks skip the auditor. Their acceptance commands are the audit gate.

## Auto-Approval Rules

When the task auditor passes all checks:

- `foundation` and `product_engines` lanes can auto-approve into `done`
- `merchant_facing` and `ship_and_operate` lanes stay in `review` for operator eyeballing

When any audit check fails:

- the task stays in `review`
- the audit report becomes the stop reason

## Natural Stop Conditions

The system is designed to stop at meaningful checkpoints rather than forcing progress.

Typical stop conditions:

- no unblocked tasks remain
- the next task is `pair` or `human`
- a medium or larger task is unblocked but not prepared
- a task fails build or audit
- a task lands in `review` without auto-approval
- an `auto` run reaches its `--max-tasks` cap

These are not workflow bugs. They are the normal checkpoints that hand control back to the operator.

## Recommended Usage Pattern

| Situation | Command |
| --- | --- |
| Need the current queue | `next` |
| Ready `small` work exists | `sweep M<N> small` |
| `medium` work is next and unprepared | `prepare M<N> medium` |
| You want every non-small task prepared together | `prepare M<N> all` |
| One `large` or `architectural` task is next | `prepare T<id>` |
| Prepared work is waiting | `build ...` |
| You want autonomous multi-wave progress | `auto M<N>` |
| Milestone is done and needs broad review | `audit M<N>` |

## Manual Overrides

Two overrides remain intentionally rare:

- `approve T<id>` for manual `review → done`
- `audit T<id> --cross` for a cross-model second-opinion task audit
