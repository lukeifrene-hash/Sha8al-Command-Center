/**
 * MCP Tool definitions and handlers.
 * Each tool is a function the agent can call during any Claude Code session.
 */

import {
  readTracker,
  writeTracker,
  findTask,
  type TrackerState,
  type Subtask,
  type Milestone,
} from './tracker.js'
import {
  buildTaskContext,
  buildProjectStatus,
  buildMilestoneOverview,
  buildChecklistStatus,
} from './context.js'

// ─── Tool Definitions (JSON Schema for MCP) ─────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'get_task_context',
    description:
      'Get comprehensive context for a task — includes task details, acceptance criteria, constraints, ' +
      'milestone info, sibling task statuses, upstream/downstream dependencies, project conventions (CLAUDE.md), ' +
      'and domain-relevant product context from the manifesto. Call this before starting work on any task.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID (e.g. "scaffold_auth_chat_shell_004")',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'get_project_status',
    description:
      'Get overall project status — progress, schedule, current week, blocked count, current phase. ' +
      'Useful for understanding where the project stands before starting work.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_milestone_overview',
    description:
      'Get detailed info about a milestone — all tasks with statuses, exit criteria, dependencies, progress. ' +
      'Use the milestone ID (e.g. "scaffold_auth_chat_shell").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'The milestone ID',
        },
      },
      required: ['milestone_id'],
    },
  },
  {
    name: 'list_tasks',
    description:
      'List tasks, optionally filtered by milestone, status, or domain. Returns task ID, label, status, priority, and milestone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'Filter by milestone ID (optional)',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'review', 'done', 'blocked'],
          description: 'Filter by status (optional)',
        },
        domain: {
          type: 'string',
          description: 'Filter by domain (e.g. "foundation", "storefront") (optional)',
        },
      },
    },
  },
  {
    name: 'get_checklist_status',
    description:
      'Get the submission checklist status — all categories with items, completion status, and risk levels. ' +
      'Critical for understanding what Shopify requires for app approval.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'start_task',
    description:
      'Mark a task as in_progress. Call this when you begin working on a task. ' +
      'Logs the action to the agent audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to start',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'complete_task',
    description:
      'Submit a task for operator review. Call this when you have finished all work on a task. ' +
      'The task moves to "review" status — the operator will approve it to "done" or request revisions. ' +
      'Include a brief summary of what was accomplished.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to complete',
        },
        summary: {
          type: 'string',
          description: 'Brief summary of what was done (1-3 sentences)',
        },
      },
      required: ['task_id', 'summary'],
    },
  },
  {
    name: 'block_task',
    description:
      'Mark a task as blocked with a reason. Call this when you cannot proceed due to a dependency, ' +
      'missing information, or technical blocker.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to block',
        },
        reason: {
          type: 'string',
          description: 'Why this task is blocked',
        },
      },
      required: ['task_id', 'reason'],
    },
  },
  {
    name: 'unblock_task',
    description:
      'Unblock a task that was previously blocked. Sets status back to "todo" (or "in_progress" if it was previously started). ' +
      'Clears blocked_by and blocked_reason. Use when the blocker has been resolved.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to unblock',
        },
        resolution: {
          type: 'string',
          description: 'Brief description of how the blocker was resolved',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'reset_task',
    description:
      'OPERATOR ONLY — Reset a task back to "todo" status regardless of its current state. ' +
      'Clears completion data, blocked state, and assignee. Use to restart a task from scratch.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to reset',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'approve_task',
    description:
      'OPERATOR ONLY — Approve a task that is in "review" status and move it to "done". ' +
      'Only the operator (Luqman) should call this after reviewing the agent\'s work.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to approve',
        },
        feedback: {
          type: 'string',
          description: 'Optional approval feedback or notes',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'reject_task',
    description:
      'OPERATOR ONLY — Reject a task that is in "review" status and send it back to "in_progress" with revision feedback. ' +
      'The feedback is logged to the history and will be visible to the agent when it picks the task back up.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to reject',
        },
        feedback: {
          type: 'string',
          description: 'What needs to be fixed or improved — this becomes part of the task history that agents can read',
        },
      },
      required: ['task_id', 'feedback'],
    },
  },
  {
    name: 'log_action',
    description:
      'Log an action to the agent audit trail. Use for significant events that should be tracked — ' +
      'file creation, architecture decisions, test results, external API calls, etc.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The related subtask ID',
        },
        action: {
          type: 'string',
          description: 'Short action label (e.g. "file_created", "test_passed", "api_integrated")',
        },
        description: {
          type: 'string',
          description: 'Description of what happened',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization (e.g. ["write", "test", "commit"])',
        },
      },
      required: ['task_id', 'action', 'description'],
    },
  },
  {
    name: 'update_task',
    description:
      'Update task fields: priority, assignee, execution_mode, and/or notes. ' +
      'Only provided fields are changed — omitted fields stay as-is. Logs the update to audit trail.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to update',
        },
        priority: {
          type: 'string',
          description: 'Step number within the week (e.g. "1", "2", "3") — tasks with the same step can run in parallel',
        },
        assignee: {
          type: 'string',
          description: 'New assignee name (optional, empty string to unassign)',
        },
        execution_mode: {
          type: 'string',
          enum: ['human', 'agent', 'pair'],
          description: 'New execution mode (optional)',
        },
        notes: {
          type: 'string',
          description: 'New notes for the task (optional)',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'enrich_task',
    description:
      'Write enrichment data to a task after the prepare phase. Updates prompt, acceptance criteria, ' +
      'constraints, context files, reference docs, and/or the builder_prompt file path. ' +
      'Only provided fields are updated — omitted fields stay as-is.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to enrich',
        },
        prompt: {
          type: 'string',
          description: 'Task prompt/description override (optional)',
        },
        builder_prompt: {
          type: 'string',
          description: 'Relative path to the per-task prompt file, e.g. "docs/prompts/task-009-scaffold-shopify-remix.md" (optional)',
        },
        acceptance_criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Acceptance criteria list (optional, replaces existing)',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Constraints list (optional, replaces existing)',
        },
        context_files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Context file paths (optional, replaces existing)',
        },
        reference_docs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Reference doc URLs or paths (optional, replaces existing)',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_milestone_note',
    description:
      'Add an exit criterion or key observation to a milestone. These notes appear as "Exit Criteria" ' +
      'in task context and in the SwimLane detail panel.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'The milestone ID',
        },
        note: {
          type: 'string',
          description: 'The exit criterion or observation to add',
        },
      },
      required: ['milestone_id', 'note'],
    },
  },
  {
    name: 'set_milestone_dates',
    description:
      'Set the actual start and/or actual end date on a milestone. Call with actual_start when the first task ' +
      'begins. Call with actual_end when the last task completes. Automatically recalculates drift_days.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'The milestone ID',
        },
        actual_start: {
          type: 'string',
          description: 'Actual start date in YYYY-MM-DD format (optional)',
        },
        actual_end: {
          type: 'string',
          description: 'Actual end date in YYYY-MM-DD format (optional)',
        },
      },
      required: ['milestone_id'],
    },
  },
  {
    name: 'update_drift',
    description:
      'Manually update drift_days on a milestone. Positive = behind schedule, negative = ahead, 0 = on track. ' +
      'This recalculates the project schedule_status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'The milestone ID',
        },
        drift_days: {
          type: 'number',
          description: 'Number of days of drift (positive = behind, negative = ahead)',
        },
      },
      required: ['milestone_id', 'drift_days'],
    },
  },
  {
    name: 'get_task_history',
    description:
      'Get the agent log entries (execution history) for a specific task. Shows all actions taken — ' +
      'starts, completions, blocks, file changes, and custom log entries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to get history for',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'list_agents',
    description:
      'List all registered agents with their status, permissions, last action time, and session action count. ' +
      'Shows which agents are active (action within 30 min) vs idle.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'register_agent',
    description:
      'Register a new agent in the Command Center. Use when a new Claude Code session, Codex instance, ' +
      'or other agent begins working on the project. The agent will appear in the Agent Hub.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'Unique agent ID (e.g. "claude_code_session_2", "codex_builder")',
        },
        name: {
          type: 'string',
          description: 'Display name (e.g. "Claude Code (Session 2)", "Codex Builder")',
        },
        type: {
          type: 'string',
          enum: ['orchestrator', 'sub-agent', 'human', 'external'],
          description: 'Agent type',
        },
        parent_id: {
          type: 'string',
          description: 'Parent orchestrator ID for sub-agents (optional — used for grouping in Agent Hub)',
        },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Permission list (e.g. ["read", "write"])',
        },
        color: {
          type: 'string',
          description: 'Hex color for the agent dot (optional, defaults to "#9B9BAA")',
        },
      },
      required: ['agent_id', 'name', 'type', 'permissions'],
    },
  },
  {
    name: 'get_activity_feed',
    description:
      'Get recent entries from the agent activity log — not filtered by task. ' +
      'Shows all agent actions across the project. Optionally filter by agent_id. ' +
      'Returns most recent entries first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agent_id: {
          type: 'string',
          description: 'Filter by agent ID (optional — omit for all agents)',
        },
        limit: {
          type: 'number',
          description: 'Max entries to return (default 30)',
        },
      },
    },
  },
  {
    name: 'toggle_checklist_item',
    description:
      'Toggle a submission checklist item as done or not done. The checklist tracks Shopify app review requirements. ' +
      'Use this when a requirement has been fulfilled or when marking it as incomplete.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        item_id: {
          type: 'string',
          description: 'The checklist item ID',
        },
        done: {
          type: 'boolean',
          description: 'true to mark as complete, false to mark as incomplete',
        },
      },
      required: ['item_id', 'done'],
    },
  },
]

// ─── Tool Handlers ──────────────────────────────────────────────────────────

export async function handleTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'get_task_context':
        return handleGetTaskContext(args.task_id as string)
      case 'get_project_status':
        return handleGetProjectStatus()
      case 'get_milestone_overview':
        return handleGetMilestoneOverview(args.milestone_id as string)
      case 'list_tasks':
        return handleListTasks(
          args.milestone_id as string | undefined,
          args.status as string | undefined,
          args.domain as string | undefined
        )
      case 'get_checklist_status':
        return handleGetChecklistStatus()
      case 'start_task':
        return handleStartTask(args.task_id as string)
      case 'complete_task':
        return handleCompleteTask(args.task_id as string, args.summary as string)
      case 'block_task':
        return handleBlockTask(args.task_id as string, args.reason as string)
      case 'unblock_task':
        return handleUnblockTask(args.task_id as string, args.resolution as string | undefined)
      case 'reset_task':
        return handleResetTask(args.task_id as string)
      case 'approve_task':
        return handleApproveTask(args.task_id as string, args.feedback as string | undefined)
      case 'reject_task':
        return handleRejectTask(args.task_id as string, args.feedback as string)
      case 'log_action':
        return handleLogAction(
          args.task_id as string,
          args.action as string,
          args.description as string,
          (args.tags as string[]) || []
        )
      case 'update_task':
        return handleUpdateTask(
          args.task_id as string,
          args.priority as string | undefined,
          args.assignee as string | undefined,
          args.execution_mode as string | undefined,
          args.notes as string | undefined
        )
      case 'enrich_task':
        return handleEnrichTask(
          args.task_id as string,
          args.prompt as string | undefined,
          args.builder_prompt as string | undefined,
          args.acceptance_criteria as string[] | undefined,
          args.constraints as string[] | undefined,
          args.context_files as string[] | undefined,
          args.reference_docs as string[] | undefined
        )
      case 'add_milestone_note':
        return handleAddMilestoneNote(args.milestone_id as string, args.note as string)
      case 'set_milestone_dates':
        return handleSetMilestoneDates(
          args.milestone_id as string,
          args.actual_start as string | undefined,
          args.actual_end as string | undefined
        )
      case 'update_drift':
        return handleUpdateDrift(args.milestone_id as string, args.drift_days as number)
      case 'get_task_history':
        return handleGetTaskHistory(args.task_id as string)
      case 'list_agents':
        return handleListAgents()
      case 'register_agent':
        return handleRegisterAgent(
          args.agent_id as string,
          args.name as string,
          args.type as string,
          (args.permissions as string[]) || ['read'],
          args.color as string | undefined,
          args.parent_id as string | undefined
        )
      case 'get_activity_feed':
        return handleGetActivityFeed(
          args.agent_id as string | undefined,
          (args.limit as number) || 30
        )
      case 'toggle_checklist_item':
        return handleToggleChecklistItem(args.item_id as string, args.done as boolean)
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    }
  }
}

// ─── Read-Only Handlers ─────────────────────────────────────────────────────

function handleGetTaskContext(taskId: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found in tracker.` }], isError: true }
  }
  const context = buildTaskContext(state, match.subtask, match.milestone)
  return { content: [{ type: 'text' as const, text: context }] }
}

function handleGetProjectStatus() {
  const state = readTracker()
  const status = buildProjectStatus(state)
  return { content: [{ type: 'text' as const, text: status }] }
}

function handleGetMilestoneOverview(milestoneId: string) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return { content: [{ type: 'text' as const, text: `Milestone "${milestoneId}" not found.` }], isError: true }
  }
  const overview = buildMilestoneOverview(milestone, state)
  return { content: [{ type: 'text' as const, text: overview }] }
}

function handleListTasks(
  milestoneId?: string,
  status?: string,
  domain?: string
) {
  const state = readTracker()
  const lines: string[] = []

  for (const m of state.milestones) {
    if (milestoneId && m.id !== milestoneId) continue
    if (domain && m.domain !== domain) continue

    const tasks = status
      ? m.subtasks.filter((s) => s.status === status)
      : m.subtasks

    if (tasks.length === 0) continue

    lines.push(`\n## ${m.title} (${m.domain}, Week ${m.week})`)
    for (const s of tasks) {
      const icon = s.done ? '✅' : s.status === 'in_progress' ? '🔄' : s.status === 'blocked' ? '🚫' : '⬜'
      lines.push(`  ${icon} [${s.priority}] \`${s.id}\` — ${s.label}`)
    }
  }

  if (lines.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No tasks match the given filters.' }] }
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

function handleGetChecklistStatus() {
  const state = readTracker()
  const status = buildChecklistStatus(state)
  return { content: [{ type: 'text' as const, text: status }] }
}

// ─── Write Handlers ─────────────────────────────────────────────────────────

function handleStartTask(taskId: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!
  task.status = 'in_progress'
  task.assignee = task.assignee || 'claude_code'

  const runId = `run_${Date.now()}`
  task.last_run_id = runId

  // Auto-stamp actual_start if this is the first task starting in this milestone
  const extras: string[] = []
  if (!milestone.actual_start) {
    milestone.actual_start = new Date().toISOString().split('T')[0]
    // Calculate drift from planned start
    const planned = new Date(milestone.planned_start)
    const actual = new Date(milestone.actual_start)
    milestone.drift_days = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24))
    extras.push(`Milestone actual_start set to ${milestone.actual_start} (drift: ${milestone.drift_days} days)`)
  }

  state.agent_log.push({
    id: runId,
    agent_id: 'claude_code',
    action: 'task_started',
    target_type: 'subtask',
    target_id: taskId,
    description: `Started work on: ${subtask.label}`,
    timestamp: new Date().toISOString(),
    tags: ['start', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" set to in_progress.\n\nMilestone: ${milestone.title}\nTask: ${subtask.label}${extras.length > 0 ? '\n' + extras.join('\n') : ''}`,
    }],
  }
}

function handleCompleteTask(taskId: string, summary: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!
  task.status = 'review'
  task.blocked_by = null
  task.blocked_reason = null

  const runId = `run_${Date.now()}`
  state.agent_log.push({
    id: runId,
    agent_id: 'claude_code',
    action: 'task_submitted_for_review',
    target_type: 'subtask',
    target_id: taskId,
    description: summary,
    timestamp: new Date().toISOString(),
    tags: ['review', 'mcp'],
  })

  // Calculate new milestone progress
  const done = milestone.subtasks.filter((s) => s.done).length
  const total = milestone.subtasks.length

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" submitted for review.\n\nSummary: ${summary}\nMilestone progress: ${done}/${total} done\n\nThe operator will review and either approve (→ done) or request revisions (→ in_progress with feedback).`,
    }],
  }
}

function handleBlockTask(taskId: string, reason: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!
  task.status = 'blocked'
  task.blocked_reason = reason
  task.blocked_by = 'claude_code'

  const runId = `run_${Date.now()}`
  state.agent_log.push({
    id: runId,
    agent_id: 'claude_code',
    action: 'task_blocked',
    target_type: 'subtask',
    target_id: taskId,
    description: `Blocked: ${reason}`,
    timestamp: new Date().toISOString(),
    tags: ['blocked', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" marked as blocked.\n\nReason: ${reason}`,
    }],
  }
}

function handleUnblockTask(taskId: string, resolution?: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!

  if (task.status !== 'blocked') {
    return {
      content: [{ type: 'text' as const, text: `Task "${taskId}" is not blocked (current status: ${task.status}).` }],
      isError: true,
    }
  }

  const previousReason = task.blocked_reason
  task.status = task.last_run_id ? 'in_progress' : 'todo'
  task.blocked_by = null
  task.blocked_reason = null

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'task_unblocked',
    target_type: 'subtask',
    target_id: taskId,
    description: resolution
      ? `Unblocked: ${resolution} (was: ${previousReason})`
      : `Unblocked (was: ${previousReason})`,
    timestamp: new Date().toISOString(),
    tags: ['unblocked', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" unblocked → ${task.status}.\n\nPrevious blocker: ${previousReason}${resolution ? '\nResolution: ' + resolution : ''}`,
    }],
  }
}

function handleApproveTask(taskId: string, feedback?: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!

  if (task.status !== 'review') {
    return {
      content: [{ type: 'text' as const, text: `Task "${taskId}" is not in review (current status: ${task.status}). Only tasks in "review" can be approved.` }],
      isError: true,
    }
  }

  task.status = 'done'
  task.done = true
  task.completed_at = new Date().toISOString()
  task.completed_by = 'Luqman'

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'luqman',
    action: 'task_approved',
    target_type: 'subtask',
    target_id: taskId,
    description: feedback || 'Approved — task meets requirements.',
    timestamp: new Date().toISOString(),
    tags: ['approved', 'review', 'operator'],
  })

  // Auto-stamp actual_end if all tasks in this milestone are done
  const done = milestone.subtasks.filter((s) => s.done).length
  const total = milestone.subtasks.length
  const extras: string[] = []
  if (done === total && !milestone.actual_end) {
    milestone.actual_end = new Date().toISOString().split('T')[0]
    extras.push(`Milestone "${milestone.title}" fully complete — actual_end set to ${milestone.actual_end}`)
  }

  touchAgent(state, 'luqman')
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" approved and marked as done.\n\nMilestone progress: ${done}/${total}${extras.length > 0 ? '\n' + extras.join('\n') : ''}`,
    }],
  }
}

function handleRejectTask(taskId: string, feedback: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!

  if (task.status !== 'review') {
    return {
      content: [{ type: 'text' as const, text: `Task "${taskId}" is not in review (current status: ${task.status}). Only tasks in "review" can be rejected.` }],
      isError: true,
    }
  }

  task.status = 'in_progress'

  // Count revisions for this task
  const priorRevisions = state.agent_log.filter(
    (e) => e.target_id === taskId && e.action === 'revision_requested'
  ).length
  const revisionNumber = priorRevisions + 1

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'luqman',
    action: 'revision_requested',
    target_type: 'subtask',
    target_id: taskId,
    description: `Revision #${revisionNumber}: ${feedback}`,
    timestamp: new Date().toISOString(),
    tags: ['revision', 'review', 'operator', `rev-${revisionNumber}`],
  })

  touchAgent(state, 'luqman')
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" sent back for revision (#${revisionNumber}).\n\nFeedback: ${feedback}\n\nThe task is now in_progress. The agent will see this feedback in the task history.`,
    }],
  }
}

function handleLogAction(
  taskId: string,
  action: string,
  description: string,
  tags: string[]
) {
  const state = readTracker()

  const logId = `log_${Date.now()}`
  state.agent_log.push({
    id: logId,
    agent_id: 'claude_code',
    action,
    target_type: 'subtask',
    target_id: taskId,
    description,
    timestamp: new Date().toISOString(),
    tags: [...tags, 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Logged: [${action}] ${description}`,
    }],
  }
}

// ─── New Handlers ───────────────────────────────────────────────────────────

function handleUpdateTask(
  taskId: string,
  priority?: string,
  assignee?: string,
  executionMode?: string,
  notes?: string
) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const task = match.milestone.subtasks.find((s) => s.id === taskId)!
  const changes: string[] = []

  if (priority !== undefined && ['P1', 'P2', 'P3'].includes(priority)) {
    task.priority = priority as 'P1' | 'P2' | 'P3'
    changes.push(`priority → ${priority}`)
  }
  if (assignee !== undefined) {
    task.assignee = assignee || null
    changes.push(`assignee → ${assignee || 'unassigned'}`)
  }
  if (executionMode !== undefined && ['human', 'agent', 'pair'].includes(executionMode)) {
    task.execution_mode = executionMode as 'human' | 'agent' | 'pair'
    changes.push(`execution_mode → ${executionMode}`)
  }
  if (notes !== undefined) {
    task.notes = notes || null
    changes.push(`notes updated`)
  }

  if (changes.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No valid fields to update.' }], isError: true }
  }

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'task_updated',
    target_type: 'subtask',
    target_id: taskId,
    description: `Updated: ${changes.join(', ')}`,
    timestamp: new Date().toISOString(),
    tags: ['update', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" updated:\n${changes.map((c) => `  - ${c}`).join('\n')}`,
    }],
  }
}

function handleEnrichTask(
  taskId: string,
  prompt?: string,
  builderPrompt?: string,
  acceptanceCriteria?: string[],
  constraints?: string[],
  contextFiles?: string[],
  referenceDocs?: string[]
) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const task = match.milestone.subtasks.find((s) => s.id === taskId)!
  const changes: string[] = []

  if (prompt !== undefined) {
    task.prompt = prompt || null
    changes.push('prompt')
  }
  if (builderPrompt !== undefined) {
    task.builder_prompt = builderPrompt || null
    changes.push(`builder_prompt → ${builderPrompt}`)
  }
  if (acceptanceCriteria !== undefined) {
    task.acceptance_criteria = acceptanceCriteria
    changes.push(`acceptance_criteria (${acceptanceCriteria.length})`)
  }
  if (constraints !== undefined) {
    task.constraints = constraints
    changes.push(`constraints (${constraints.length})`)
  }
  if (contextFiles !== undefined) {
    task.context_files = contextFiles
    changes.push(`context_files (${contextFiles.length})`)
  }
  if (referenceDocs !== undefined) {
    task.reference_docs = referenceDocs
    changes.push(`reference_docs (${referenceDocs.length})`)
  }

  if (changes.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No fields provided to update.' }], isError: true }
  }

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'task_enriched',
    target_type: 'subtask',
    target_id: taskId,
    description: `Enriched: ${changes.join(', ')}`,
    timestamp: new Date().toISOString(),
    tags: ['enrichment', 'prepare', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" enriched:\n${changes.map((c) => `  - ${c}`).join('\n')}`,
    }],
  }
}

function handleAddMilestoneNote(milestoneId: string, note: string) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return { content: [{ type: 'text' as const, text: `Milestone "${milestoneId}" not found.` }], isError: true }
  }

  milestone.notes.push(note)

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'milestone_note_added',
    target_type: 'milestone',
    target_id: milestoneId,
    description: `Added exit criterion: ${note}`,
    timestamp: new Date().toISOString(),
    tags: ['note', 'milestone', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Added note to "${milestone.title}":\n  "${note}"\n\nTotal exit criteria: ${milestone.notes.length}`,
    }],
  }
}

function handleSetMilestoneDates(
  milestoneId: string,
  actualStart?: string,
  actualEnd?: string
) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return { content: [{ type: 'text' as const, text: `Milestone "${milestoneId}" not found.` }], isError: true }
  }

  const changes: string[] = []

  if (actualStart !== undefined) {
    milestone.actual_start = actualStart
    changes.push(`actual_start → ${actualStart}`)

    // Auto-calculate drift from planned_start
    const planned = new Date(milestone.planned_start)
    const actual = new Date(actualStart)
    const diffMs = actual.getTime() - planned.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    milestone.drift_days = diffDays
    changes.push(`drift_days → ${diffDays} (auto-calculated)`)
  }

  if (actualEnd !== undefined) {
    milestone.actual_end = actualEnd
    changes.push(`actual_end → ${actualEnd}`)
  }

  if (changes.length === 0) {
    return { content: [{ type: 'text' as const, text: 'Provide actual_start and/or actual_end.' }], isError: true }
  }

  // Recalculate project schedule_status
  const drifts = state.milestones.map((m) => m.drift_days)
  const maxBehind = Math.max(0, ...drifts)
  const maxAhead = Math.min(0, ...drifts)
  if (maxBehind > 3) state.project.schedule_status = 'behind'
  else if (maxAhead < -3) state.project.schedule_status = 'ahead'
  else state.project.schedule_status = 'on_track'

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'milestone_dates_set',
    target_type: 'milestone',
    target_id: milestoneId,
    description: changes.join(', '),
    timestamp: new Date().toISOString(),
    tags: ['dates', 'milestone', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Milestone "${milestone.title}" dates updated:\n${changes.map((c) => `  - ${c}`).join('\n')}\n\nSchedule status: ${state.project.schedule_status}`,
    }],
  }
}

function handleUpdateDrift(milestoneId: string, driftDays: number) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return { content: [{ type: 'text' as const, text: `Milestone "${milestoneId}" not found.` }], isError: true }
  }

  const oldDrift = milestone.drift_days
  milestone.drift_days = driftDays

  // Recalculate project schedule_status
  const drifts = state.milestones.map((m) => m.drift_days)
  const maxBehind = Math.max(0, ...drifts)
  const maxAhead = Math.min(0, ...drifts)
  if (maxBehind > 3) state.project.schedule_status = 'behind'
  else if (maxAhead < -3) state.project.schedule_status = 'ahead'
  else state.project.schedule_status = 'on_track'

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: 'drift_updated',
    target_type: 'milestone',
    target_id: milestoneId,
    description: `Drift changed: ${oldDrift} → ${driftDays} days`,
    timestamp: new Date().toISOString(),
    tags: ['drift', 'milestone', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Milestone "${milestone.title}" drift: ${oldDrift} → ${driftDays} days\nSchedule status: ${state.project.schedule_status}`,
    }],
  }
}

function handleGetTaskHistory(taskId: string) {
  const state = readTracker()

  const entries = state.agent_log.filter((e) => e.target_id === taskId)

  if (entries.length === 0) {
    return { content: [{ type: 'text' as const, text: `No history found for task "${taskId}".` }] }
  }

  const lines: string[] = [`# History for ${taskId} (${entries.length} entries)\n`]

  for (const e of entries) {
    lines.push(`**${e.action}** — ${e.description}`)
    lines.push(`  Agent: ${e.agent_id} | ${e.timestamp}${e.tags.length > 0 ? ' | Tags: ' + e.tags.join(', ') : ''}`)
    lines.push('')
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

// ─── Agent Hub Handlers ─────────────────────────────────────────────────────

function handleListAgents() {
  const state = readTracker()
  const now = Date.now()
  const ACTIVE_WINDOW_MS = 30 * 60 * 1000 // 30 minutes

  const lines: string[] = ['# Connected Agents\n']

  for (const agent of state.agents) {
    const lastAction = agent.last_action_at ? new Date(agent.last_action_at).getTime() : 0
    const isActive = (now - lastAction) < ACTIVE_WINDOW_MS
    const status = isActive ? '🟢 ACTIVE' : '⚪ IDLE'

    lines.push(`## ${agent.name} (\`${agent.id}\`)`)
    lines.push(`- **Type:** ${agent.type}`)
    lines.push(`- **Status:** ${status}`)
    lines.push(`- **Permissions:** ${agent.permissions.join(', ') || 'none'}`)
    lines.push(`- **Last action:** ${agent.last_action_at || 'never'}`)
    lines.push(`- **Session actions:** ${agent.session_action_count}`)
    lines.push('')
  }

  // Weekly stats per agent
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  lines.push('# Weekly Stats\n')
  for (const agent of state.agents) {
    const weekEntries = state.agent_log.filter(
      (e) => e.agent_id === agent.id && e.timestamp >= weekAgo
    )
    if (weekEntries.length === 0) continue
    const checklistCount = weekEntries.filter((e) => e.tags.includes('CHECKLIST') || e.tags.includes('checklist')).length
    const alertCount = weekEntries.filter((e) => e.tags.includes('ALERT') || e.tags.includes('alert')).length
    lines.push(`**${agent.name}:** ${weekEntries.length} actions, ${checklistCount} checklist, ${alertCount} alerts`)
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

function handleRegisterAgent(
  agentId: string,
  name: string,
  type: string,
  permissions: string[],
  color?: string,
  parentId?: string
) {
  const state = readTracker()

  // Check if agent already exists
  const existing = state.agents.find((a) => a.id === agentId)
  if (existing) {
    return {
      content: [{
        type: 'text' as const,
        text: `Agent "${agentId}" already exists as "${existing.name}" (${existing.type}).`,
      }],
      isError: true,
    }
  }

  // For sub-agents, prepend parent ID if not already included
  const finalId = (type === 'sub-agent' && parentId && !agentId.startsWith(parentId))
    ? `${parentId}_${agentId}`
    : agentId

  const newAgent = {
    id: finalId,
    name,
    type,
    color: color || '#9B9BAA',
    status: 'active',
    permissions,
    last_action_at: new Date().toISOString(),
    session_action_count: 0,
  }

  state.agents.push(newAgent)

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: finalId,
    action: 'agent_registered',
    target_type: 'agent',
    target_id: finalId,
    description: `New agent registered: ${name} (${type})`,
    timestamp: new Date().toISOString(),
    tags: ['agent', 'register', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Agent registered:\n  ID: ${finalId}\n  Name: ${name}\n  Type: ${type}\n  Permissions: ${permissions.join(', ')}`,
    }],
  }
}

function handleGetActivityFeed(agentId?: string, limit: number = 30) {
  const state = readTracker()

  let entries = [...state.agent_log].reverse() // Most recent first
  if (agentId) {
    entries = entries.filter((e) => e.agent_id === agentId)
  }
  entries = entries.slice(0, limit)

  if (entries.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: agentId
          ? `No activity found for agent "${agentId}".`
          : 'No activity in the log.',
      }],
    }
  }

  const lines: string[] = [
    `# Activity Feed${agentId ? ` — ${agentId}` : ''} (${entries.length} entries)\n`,
  ]

  let lastDay = ''
  for (const e of entries) {
    const day = e.timestamp.split('T')[0]
    if (day !== lastDay) {
      lines.push(`\n--- ${day} ---\n`)
      lastDay = day
    }

    const agentName = state.agents.find((a) => a.id === e.agent_id)?.name || e.agent_id
    const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    lines.push(`**${time}** [${agentName}] **${e.action}** — ${e.description}`)
    if (e.target_id) lines.push(`  Target: \`${e.target_id}\``)
    if (e.tags.length > 0) lines.push(`  Tags: ${e.tags.join(', ')}`)
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

// ─── Agent Auto-Update Helper ───────────────────────────────────────────────

/**
 * Updates the agent's last_action_at and session_action_count.
 * Called by write tools to keep the Agent Hub's Connected Agents panel current.
 */
function touchAgent(state: TrackerState, agentId: string = 'claude_code'): void {
  const agent = state.agents.find((a) => a.id === agentId)
  if (agent) {
    agent.last_action_at = new Date().toISOString()
    agent.session_action_count += 1
    agent.status = 'active'
  }
}

// ─── Prepare Task Handler ───────────────────────────────────────────────────

// ─── Checklist Handler ─────────────────────────────────────────────────────

function handleToggleChecklistItem(itemId: string, done: boolean) {
  const state = readTracker()

  let foundItem: import('./tracker.js').ChecklistItem | null = null
  let categoryTitle = ''

  for (const cat of state.submission_checklist.categories) {
    const item = cat.items.find((i) => i.id === itemId)
    if (item) {
      foundItem = item
      categoryTitle = cat.title
      break
    }
  }

  if (!foundItem) {
    return { content: [{ type: 'text' as const, text: `Checklist item "${itemId}" not found.` }], isError: true }
  }

  foundItem.done = done
  foundItem.completed_at = done ? new Date().toISOString() : null
  foundItem.completed_by = done ? 'claude_code' : null

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'claude_code',
    action: done ? 'checklist_item_completed' : 'checklist_item_unchecked',
    target_type: 'checklist',
    target_id: itemId,
    description: `${done ? 'Completed' : 'Unchecked'}: ${foundItem.label} (${categoryTitle})`,
    timestamp: new Date().toISOString(),
    tags: ['checklist', done ? 'complete' : 'revert', 'mcp'],
  })

  touchAgent(state)
  writeTracker(state)

  const cat = state.submission_checklist.categories.find((c) => c.items.some((i) => i.id === itemId))!
  const catDone = cat.items.filter((i) => i.done).length
  const catTotal = cat.items.length

  return {
    content: [{
      type: 'text' as const,
      text: `Checklist item "${itemId}" ${done ? 'completed' : 'unchecked'}.\n\nItem: ${foundItem.label}\nCategory: ${categoryTitle} (${catDone}/${catTotal})`,
    }],
  }
}

function handleResetTask(taskId: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!
  const previousStatus = task.status

  task.status = 'todo'
  task.done = false
  task.assignee = null
  task.blocked_by = null
  task.blocked_reason = null
  task.completed_at = null
  task.completed_by = null
  task.last_run_id = null

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: 'luqman',
    action: 'task_reset',
    target_type: 'subtask',
    target_id: taskId,
    description: `Task reset to todo (was: ${previousStatus})`,
    timestamp: new Date().toISOString(),
    tags: ['reset', 'operator'],
  })

  touchAgent(state, 'luqman')
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" reset to todo (was: ${previousStatus}).`,
    }],
  }
}
