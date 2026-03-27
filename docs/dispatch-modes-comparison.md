# Dispatch Modes Comparison

Three ways to execute tasks from the Command Center, each with different tradeoffs between control, context, and automation.

## Overview

| | **Raw Claude Session** | **Run in Warp** | **Pipeline Mode** |
|---|---|---|---|
| **What it is** | You type `claude "prompt"` in your terminal | Command Center assembles a context-rich prompt, opens a Warp tab, you paste and run | Command Center runs Explorer > Planner > Builder headlessly, fully automated |
| **Prompt** | Whatever you type | 3-layer assembled prompt: CLAUDE.md + manifesto + milestone context + task + reporting protocol | Same 3-layer prompt per step, agent-profile-filtered (explorer gets different context than builder) |
| **Context injected** | Only CLAUDE.md (auto-loaded by CLI) | CLAUDE.md + manifesto sections + milestone status + sibling tasks + dependencies + exit criteria | Same as Warp, plus prior step output injected into each subsequent step |
| **Model** | Whatever you have set | Profile-based (Opus for all) | Profile-based (Opus for all) |
| **Tools** | All tools available | Restricted by agent type (explorer: read-only + web, builder: write + test) | Same restrictions per step |
| **Interaction** | Fully interactive — you can talk to Claude mid-task, redirect, ask questions | Interactive — agent runs in Warp terminal, you can watch and intervene mid-execution | Headless — no intervention, you see streaming output but can't redirect mid-step |
| **Tracker updates** | None — Claude doesn't know about the tracker | Agent updates tracker itself via reporting protocol (sets status, completed_by, etc.) | Pipeline runner updates tracker between steps — agent doesn't touch it |
| **Information retention** | Full — one session explores + plans + builds with complete memory | Full — single session with complete memory of everything it reads | Lossy — explorer's full investigation is compressed into text output, planner only sees that summary, builder only sees the plan |
| **Steps** | Claude decides its own workflow | Single dispatch — one agent type (explorer, planner, or builder) does one job | 3 sequential steps, each specialized |
| **Automation** | Manual — you type the prompt, you watch it run | Semi-manual — Command Center assembles prompt, you paste Cmd+V and hit Enter | Fully automated — one click, walk away |
| **Audit trail** | None | Logged to agent_log with dispatch timestamp, profile, char count | Logged per step with timing, output, errors |
| **Milestone awareness** | None — doesn't know about siblings, dependencies, schedule | Full — prompt includes sibling task status, upstream progress, drift | Full — same context per step |
| **Scale (157 tasks)** | 157 manual prompts you have to write yourself | 157 clicks + 157 pastes, but prompts are auto-assembled | 157 clicks, fully hands-off |
| **Can you intervene?** | Yes, fully | Yes — you're in the terminal watching it | Only cancel — can't redirect mid-step |
| **Best for** | One-off tasks, exploration, debugging, anything where you want to steer | Tasks where you want assembled context plus the ability to watch and intervene | Batch execution, complex tasks that benefit from structured investigate-then-plan-then-build |

## The Key Tradeoff

|  | Control | Context | Automation |
|---|---|---|---|
| **Raw session** | Full | Minimal | None |
| **Run in Warp** | Full | Full | Semi |
| **Pipeline** | None | Full + chained | Full |

## When to Use Each

### Raw Claude Session
- One-off tasks not in the tracker
- Debugging or exploration where you need to steer in real time
- Simple tasks where milestone context adds no value
- When you want to ask follow-up questions mid-task

### Run in Warp
- High-stakes tasks where you want rich context AND the ability to intervene
- Tasks where you want to watch the agent work and course-correct
- When you want the reporting protocol (agent updates tracker status itself)
- Single-step work: dispatch just an explorer to investigate, or just a builder to implement

### Pipeline Mode
- Batch execution across many tasks
- Complex tasks that benefit from structured investigate > plan > build
- When you trust the workflow and don't need to intervene
- When you want full audit trails with per-step timing and outputs
- Tasks with dependencies and sibling coordination where milestone context matters
