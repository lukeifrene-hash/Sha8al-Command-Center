/**
 * MCP Tool definitions and handlers.
 * Each tool is a function the agent can call during any Claude Code session.
 */

import {
  readTracker,
  writeTracker,
  findTask,
  autoUnblockDependents,
  type TrackerState,
  type Subtask,
  type Milestone,
  type ReviewSession,
  type ReviewFix,
  type QAUseCase,
} from './tracker.js'
import {
  buildTaskContext,
  buildTaskSummary,
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
    name: 'get_task_summary',
    description:
      'Get a slim task summary — ID, label, acceptance criteria, constraints, and context files only. ' +
      'Use this instead of get_task_context for post-build agents that only need to verify work against acceptance criteria. ' +
      'Saves ~6,000 tokens vs get_task_context by omitting manifesto, builder prompt, milestone context, and dependencies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID (e.g. "storefront_tae_004")',
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
      'Critical for understanding what Shopify requires for app approval. ' +
      'Defaults to showing only incomplete items to save tokens.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'incomplete'],
          description: 'Filter items: "incomplete" (default) shows only unfinished items, "all" shows everything',
        },
      },
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
        agent_id: {
          type: 'string',
          description: 'The agent starting this task (e.g. "builder"). Defaults to "claude_code".',
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
        agent_id: {
          type: 'string',
          description: 'The agent completing this task (e.g. "builder"). Defaults to "claude_code".',
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
        agent_id: {
          type: 'string',
          description: 'The agent making this log entry (e.g. "explorer", "builder", "reviewer", "security", "validator", "compliance"). Defaults to "claude_code" if not provided.',
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
  {
    name: 'create_review_session',
    description:
      'Create a new review session in the Review tab. Agents should call this at the start of a debug session ' +
      'to register what they are working on. The lane is auto-classified: "ui" for visual/layout issues, ' +
      '"ux" for flow/interaction issues, "backend" for logic/data bugs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        lane: {
          type: 'string',
          enum: ['ui', 'ux', 'backend'],
          description: 'Which debug lane: "ui" (visual/layout), "ux" (flow/interaction), "backend" (logic/data)',
        },
        title: {
          type: 'string',
          description: 'Session title, e.g. "Chat page visual polish" or "Billing flow walkthrough"',
        },
        area: {
          type: 'string',
          description: 'App area this covers, e.g. "Chat page", "Billing", "Navigation"',
        },
        priority: {
          type: 'string',
          enum: ['P1', 'P2', 'P3'],
          description: 'Priority level (mainly for backend bugs). Defaults to null for UI/UX sessions.',
        },
        source: {
          type: 'string',
          description: 'Where this session originated, e.g. "review_session_002", "operator_report", "manual"',
        },
      },
      required: ['lane', 'title', 'area'],
    },
  },
  {
    name: 'add_review_item',
    description:
      'Add a checklist item to an existing review session. Call this when you identify a specific issue to fix ' +
      'or have fixed an issue during a debug session.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The review session ID',
        },
        label: {
          type: 'string',
          description: 'Description of the fix/issue, e.g. "Fix button color to #14B8A6"',
        },
        done: {
          type: 'boolean',
          description: 'Whether this item is already done (default: false). Set to true if reporting a fix you just made.',
        },
      },
      required: ['session_id', 'label'],
    },
  },
  {
    name: 'check_review_item',
    description:
      'Mark a checklist item as done (or undone) in a review session. Call this after fixing an issue.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The review session ID',
        },
        item_index: {
          type: 'number',
          description: 'The 0-based index of the checklist item to toggle',
        },
        done: {
          type: 'boolean',
          description: 'Set to true to mark done, false to uncheck. Defaults to true.',
        },
      },
      required: ['session_id', 'item_index'],
    },
  },
  {
    name: 'list_review_sessions',
    description:
      'List all review sessions, optionally filtered by lane. Returns session IDs, titles, status, and checklist progress.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        lane: {
          type: 'string',
          enum: ['ui', 'ux', 'backend'],
          description: 'Filter by lane (optional)',
        },
      },
    },
  },
  {
    name: 'get_review_session',
    description:
      'Get full details of a review session including all checklist items with their labels, done status, and indices. ' +
      'Use this to read back what items exist in a session before resuming work or using check_review_item.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The review session ID (e.g., "review-ui-1712345678")',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'add_review_fix',
    description:
      'Log a fix discovered during a review session. Fixes are issues found during verification that need to be ' +
      'addressed by an agent on the task board. They render in a separate "Fixes" section below the verification checklist. ' +
      'Use this instead of add_review_item when the item is a problem to fix, not a test to run.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The review session ID',
        },
        label: {
          type: 'string',
          description: 'Description of the fix needed, e.g. "Quick-action chips are not contextual to actual findings"',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'major', 'minor'],
          description: 'How severe is this issue: critical (blocks functionality), major (wrong behavior), minor (polish)',
        },
      },
      required: ['session_id', 'label'],
    },
  },
  {
    name: 'promote_fixes',
    description:
      'Promote all unlinked fixes from a review session to the task board as subtasks in a milestone. ' +
      'Each fix becomes a task with status "todo". The fix gets a task_id link back to the created task. ' +
      'Already-promoted fixes (with a task_id) are skipped.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The review session ID with fixes to promote',
        },
        milestone_id: {
          type: 'string',
          description: 'The milestone ID to create tasks in (e.g. "review_polish")',
        },
      },
      required: ['session_id', 'milestone_id'],
    },
  },
  {
    name: 'delete_review_session',
    description:
      'Delete a review session from the Review tab.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'The review session ID to delete',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'create_milestone',
    description:
      'Create a new empty milestone in the SwimLane. Use this when the operator wants to add a new phase or ' +
      'grouping of tasks to the project timeline. The milestone starts with zero tasks — use add_milestone_task to populate it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Unique milestone ID in snake_case (e.g. "pre_launch_extras")',
        },
        title: {
          type: 'string',
          description: 'Human-readable title (e.g. "Pre-Launch Extras")',
        },
        domain: {
          type: 'string',
          description: 'Domain category (e.g. "product_ops", "foundation", "general")',
        },
        phase: {
          type: 'string',
          description: 'Phase identifier, can match the milestone ID (e.g. "pre_launch_extras")',
        },
        planned_start: {
          type: 'string',
          description: 'Planned start date in YYYY-MM-DD format (optional)',
        },
        planned_end: {
          type: 'string',
          description: 'Planned end date in YYYY-MM-DD format (optional)',
        },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'add_milestone_task',
    description:
      'Add a new task (subtask) to an existing milestone. Creates the task in "todo" status with all standard fields. ' +
      'Use this when the operator wants to add work items to a milestone on demand.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'The milestone ID to add the task to',
        },
        label: {
          type: 'string',
          description: 'Short description of the task',
        },
        priority: {
          type: 'string',
          description: 'Priority level: "1" (highest) to "4" (lowest). Defaults to "2".',
        },
        acceptance_criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of acceptance criteria for the task (optional)',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of constraints for the task (optional)',
        },
        depends_on: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of task IDs this task depends on (optional)',
        },
        execution_mode: {
          type: 'string',
          enum: ['human', 'agent', 'pair'],
          description: 'How this task should be executed. Defaults to "agent".',
        },
      },
      required: ['milestone_id', 'label'],
    },
  },
  {
    name: 'get_qa_status',
    description:
      'Get QA verification status for all 28 EXECUTE use cases. Returns groups with per-use-case agent/operator ' +
      'status, plus readiness summary (verified count, agent progress, operator progress). ' +
      'A use case is "verified" only when BOTH agent and operator have passed it.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'mark_qa_result',
    description:
      'Mark a QA use case as pass or fail. Requires specifying the tester ("agent" or "operator"). ' +
      'On failure, a fix is automatically created in the Review tab\'s Fixes inbox. ' +
      'Both agent AND operator must pass for a use case to be fully verified.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        use_case_id: { type: 'string', description: 'The use case ID (e.g., "enrich_missing_attributes")' },
        tester: { type: 'string', enum: ['agent', 'operator'], description: 'Who is recording this result' },
        status: { type: 'string', enum: ['pass', 'fail'], description: 'Test result' },
        notes: { type: 'string', description: 'Optional notes — failure details, observations' },
      },
      required: ['use_case_id', 'tester', 'status'],
    },
  },
  {
    name: 'reset_qa_result',
    description:
      'Reset a QA use case back to untested. Clears BOTH agent and operator status, timestamps, and notes. ' +
      'Use after a fix has been applied and the use case needs re-verification.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        use_case_id: { type: 'string', description: 'The use case ID to reset' },
      },
      required: ['use_case_id'],
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
      case 'get_task_summary':
        return handleGetTaskSummary(args.task_id as string)
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
        return handleGetChecklistStatus(args.filter as string | undefined)
      case 'start_task':
        return handleStartTask(args.task_id as string, args.agent_id as string | undefined)
      case 'complete_task':
        return handleCompleteTask(args.task_id as string, args.summary as string, args.agent_id as string | undefined)
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
          (args.tags as string[]) || [],
          args.agent_id as string | undefined
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
      case 'create_review_session':
        return handleCreateReviewSession(
          args.lane as string, args.title as string, args.area as string,
          args.priority as string | undefined, args.source as string | undefined
        )
      case 'add_review_item':
        return handleAddReviewItem(args.session_id as string, args.label as string, args.done as boolean | undefined)
      case 'check_review_item':
        return handleCheckReviewItem(args.session_id as string, args.item_index as number, args.done as boolean | undefined)
      case 'list_review_sessions':
        return handleListReviewSessions(args.lane as string | undefined)
      case 'get_review_session':
        return handleGetReviewSession(args.session_id as string)
      case 'add_review_fix':
        return handleAddReviewFix(args.session_id as string, args.label as string, args.severity as string | undefined)
      case 'promote_fixes':
        return handlePromoteFixes(args.session_id as string, args.milestone_id as string)
      case 'delete_review_session':
        return handleDeleteReviewSession(args.session_id as string)
      case 'get_qa_status':
        return handleGetQAStatus()
      case 'mark_qa_result':
        return handleMarkQAResult(
          args.use_case_id as string,
          args.tester as string,
          args.status as string,
          args.notes as string | undefined
        )
      case 'reset_qa_result':
        return handleResetQAResult(args.use_case_id as string)
      case 'create_milestone':
        return handleCreateMilestone(
          args.id as string, args.title as string,
          args.domain as string | undefined, args.phase as string | undefined,
          args.planned_start as string | undefined, args.planned_end as string | undefined
        )
      case 'add_milestone_task':
        return handleAddMilestoneTask(
          args.milestone_id as string, args.label as string,
          args.priority as string | undefined,
          args.acceptance_criteria as string[] | undefined,
          args.constraints as string[] | undefined,
          args.depends_on as string[] | undefined,
          args.execution_mode as string | undefined
        )
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

function handleGetTaskSummary(taskId: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found in tracker.` }], isError: true }
  }
  const summary = buildTaskSummary(state, match.subtask, match.milestone)
  return { content: [{ type: 'text' as const, text: summary }] }
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

function handleGetChecklistStatus(filter?: string) {
  const state = readTracker()
  const status = buildChecklistStatus(state, (filter as 'all' | 'incomplete') || 'incomplete')
  return { content: [{ type: 'text' as const, text: status }] }
}

// ─── Write Handlers ─────────────────────────────────────────────────────────

function handleStartTask(taskId: string, agentId?: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const resolvedAgentId = agentId || 'claude_code'
  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!
  task.status = 'in_progress'
  task.assignee = task.assignee || resolvedAgentId

  const runId = `run_${Date.now()}`
  task.last_run_id = runId

  // Auto-stamp actual_start if this is the first task starting in this milestone
  const extras: string[] = []
  if (!milestone.actual_start) {
    milestone.actual_start = new Date().toISOString().split('T')[0]
    // Calculate drift from planned start
    if (milestone.planned_start) {
      const planned = new Date(milestone.planned_start)
      const actual = new Date(milestone.actual_start)
      milestone.drift_days = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24))
    }
    extras.push(`Milestone actual_start set to ${milestone.actual_start} (drift: ${milestone.drift_days} days)`)
  }

  state.agent_log.push({
    id: runId,
    agent_id: resolvedAgentId,
    action: 'task_started',
    target_type: 'subtask',
    target_id: taskId,
    description: `Started work on: ${subtask.label}`,
    timestamp: new Date().toISOString(),
    tags: ['start', 'mcp'],
  })

  touchAgent(state, resolvedAgentId)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Task "${taskId}" set to in_progress.\n\nMilestone: ${milestone.title}\nTask: ${subtask.label}${extras.length > 0 ? '\n' + extras.join('\n') : ''}`,
    }],
  }
}

function handleCompleteTask(taskId: string, summary: string, agentId?: string) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return { content: [{ type: 'text' as const, text: `Task "${taskId}" not found.` }], isError: true }
  }

  const resolvedAgentId = agentId || 'claude_code'
  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!
  task.status = 'review'
  task.blocked_by = null
  task.blocked_reason = null

  const runId = `run_${Date.now()}`
  state.agent_log.push({
    id: runId,
    agent_id: resolvedAgentId,
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

  touchAgent(state, resolvedAgentId)
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

  // Auto-unblock tasks whose dependencies are now satisfied
  const unblockedMessages = autoUnblockDependents(state, taskId, milestone.id)
  if (unblockedMessages.length > 0) {
    extras.push(`\nAuto-unblocked ${unblockedMessages.length} task(s):`)
    extras.push(...unblockedMessages.map((m) => `  • ${m}`))
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
  tags: string[],
  agentId?: string
) {
  const state = readTracker()

  const resolvedAgentId = agentId || 'claude_code'
  const logId = `log_${Date.now()}`
  state.agent_log.push({
    id: logId,
    agent_id: resolvedAgentId,
    action,
    target_type: 'subtask',
    target_id: taskId,
    description,
    timestamp: new Date().toISOString(),
    tags: [...tags, 'mcp'],
  })

  touchAgent(state, resolvedAgentId)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Logged: [${resolvedAgentId}/${action}] ${description}`,
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
    if (milestone.planned_start) {
      const planned = new Date(milestone.planned_start)
      const actual = new Date(actualStart)
      const diffMs = actual.getTime() - planned.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      milestone.drift_days = diffDays
      changes.push(`drift_days → ${diffDays} (auto-calculated)`)
    }
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
    if (agent.parent_id) {
      lines.push(`- **Parent:** ${agent.parent_id}`)
    }
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
  const finalId = agentId
  const now = new Date().toISOString()
  const existing = state.agents.find((a) => a.id === finalId)

  if (existing) {
    existing.name = name
    existing.type = type
    existing.parent_id = parentId
    existing.color = color || existing.color || '#9B9BAA'
    existing.permissions = permissions
    existing.last_action_at = now
    existing.status = 'active'

    state.agent_log.push({
      id: `log_${Date.now()}`,
      agent_id: finalId,
      action: 'agent_updated',
      target_type: 'agent',
      target_id: finalId,
      description: `Agent updated: ${name} (${type})${parentId ? `, parent ${parentId}` : ''}`,
      timestamp: now,
      tags: ['agent', 'update', 'mcp'],
    })

    writeTracker(state)

    return {
      content: [{
        type: 'text' as const,
        text: `Agent updated:\n  ID: ${finalId}\n  Name: ${name}\n  Type: ${type}\n  Parent: ${parentId || 'none'}\n  Permissions: ${permissions.join(', ')}`,
      }],
    }
  }

  const newAgent = {
    id: finalId,
    name,
    type,
    parent_id: parentId,
    color: color || '#9B9BAA',
    status: 'active',
    permissions,
    last_action_at: now,
    session_action_count: 0,
  }

  state.agents.push(newAgent)

  state.agent_log.push({
    id: `log_${Date.now()}`,
    agent_id: finalId,
    action: 'agent_registered',
    target_type: 'agent',
    target_id: finalId,
    description: `New agent registered: ${name} (${type})${parentId ? `, parent ${parentId}` : ''}`,
    timestamp: now,
    tags: ['agent', 'register', 'mcp'],
  })

  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Agent registered:\n  ID: ${finalId}\n  Name: ${name}\n  Type: ${type}\n  Parent: ${parentId || 'none'}\n  Permissions: ${permissions.join(', ')}`,
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

// ─── Review Session Handlers ──────────────────────────────────────────────

function handleCreateReviewSession(
  lane: string, title: string, area: string,
  priority?: string, source?: string
) {
  const state = readTracker()
  const id = `review-${lane}-${Date.now()}`
  const session: ReviewSession = {
    id,
    lane: lane as ReviewSession['lane'],
    title,
    status: 'in_progress',
    area,
    checklist: [],
    fixes: [],
    priority: (priority as ReviewSession['priority']) ?? null,
    source: source ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  state.review_sessions.push(session)
  writeTracker(state)
  return { content: [{ type: 'text' as const, text: `Created review session "${title}" (${id}) in ${lane} lane` }] }
}

function handleAddReviewItem(sessionId: string, label: string, done?: boolean) {
  const state = readTracker()
  const session = state.review_sessions.find(s => s.id === sessionId)
  if (!session) return { content: [{ type: 'text' as const, text: `Session not found: ${sessionId}` }], isError: true }
  session.checklist.push({ label, done: done ?? false, checked_at: done ? new Date().toISOString() : null })
  session.updated_at = new Date().toISOString()
  writeTracker(state)
  return { content: [{ type: 'text' as const, text: `Added "${label}" to session ${sessionId} (${done ? 'done' : 'pending'})` }] }
}

function handleCheckReviewItem(sessionId: string, itemIndex: number, done?: boolean) {
  const state = readTracker()
  const session = state.review_sessions.find(s => s.id === sessionId)
  if (!session) return { content: [{ type: 'text' as const, text: `Session not found: ${sessionId}` }], isError: true }
  if (itemIndex < 0 || itemIndex >= session.checklist.length) {
    return { content: [{ type: 'text' as const, text: `Invalid item index: ${itemIndex}` }], isError: true }
  }
  const target = done ?? true
  session.checklist[itemIndex].done = target
  session.checklist[itemIndex].checked_at = target ? new Date().toISOString() : null
  session.updated_at = new Date().toISOString()
  writeTracker(state)
  return { content: [{ type: 'text' as const, text: `Item ${itemIndex} "${session.checklist[itemIndex].label}" → ${target ? 'done' : 'undone'}` }] }
}

function handleListReviewSessions(lane?: string) {
  const state = readTracker()
  let sessions = state.review_sessions
  if (lane) sessions = sessions.filter(s => s.lane === lane)
  if (sessions.length === 0) return { content: [{ type: 'text' as const, text: 'No review sessions found.' }] }
  const lines = sessions.map(s => {
    const done = s.checklist.filter(c => c.done).length
    const total = s.checklist.length
    const fixes = (s.fixes ?? []).length
    const fixSuffix = fixes > 0 ? ` | ${fixes} fixes` : ''
    return `- [${s.lane.toUpperCase()}] ${s.id}: "${s.title}" (${s.status}) — ${done}/${total} items${fixSuffix}`
  })
  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

function handleGetReviewSession(sessionId: string) {
  const state = readTracker()
  const session = state.review_sessions.find(s => s.id === sessionId)
  if (!session) {
    return { content: [{ type: 'text' as const, text: `Review session not found: ${sessionId}` }], isError: true }
  }

  const lines: string[] = []
  lines.push(`# ${session.title}`)
  lines.push(`- **ID:** ${session.id}`)
  lines.push(`- **Lane:** ${session.lane}`)
  lines.push(`- **Status:** ${session.status}`)
  lines.push(`- **Area:** ${session.area}`)
  if (session.priority) lines.push(`- **Priority:** ${session.priority}`)
  if (session.source) lines.push(`- **Source:** ${session.source}`)
  lines.push(`- **Created:** ${session.created_at}`)
  lines.push(`- **Updated:** ${session.updated_at}`)

  const done = session.checklist.filter(c => c.done).length
  const total = session.checklist.length
  lines.push(`\n## Verification Checklist (${done}/${total})`)

  if (total === 0) {
    lines.push('No items yet.')
  } else {
    for (let i = 0; i < session.checklist.length; i++) {
      const item = session.checklist[i]
      const check = item.done ? 'x' : ' '
      lines.push(`${i}. [${check}] ${item.label}${item.checked_at ? ` (checked: ${item.checked_at})` : ''}`)
    }
  }

  const fixes = session.fixes ?? []
  if (fixes.length > 0) {
    const linkedCount = fixes.filter(f => f.task_id).length
    lines.push(`\n## Fixes Found (${fixes.length} total, ${linkedCount} promoted)`)
    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i]
      const linked = fix.task_id ? ` → task ${fix.task_id}` : ''
      lines.push(`${i}. [${fix.severity.toUpperCase()}] ${fix.label}${linked}`)
    }
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

function handleAddReviewFix(sessionId: string, label: string, severity?: string) {
  const state = readTracker()
  const session = state.review_sessions.find(s => s.id === sessionId)
  if (!session) return { content: [{ type: 'text' as const, text: `Session not found: ${sessionId}` }], isError: true }
  if (!session.fixes) session.fixes = []
  const fix: ReviewFix = {
    label,
    severity: (severity as ReviewFix['severity']) ?? 'major',
    task_id: null,
    created_at: new Date().toISOString(),
  }
  session.fixes.push(fix)
  session.updated_at = new Date().toISOString()
  writeTracker(state)
  const fixIdx = session.fixes.length - 1
  return { content: [{ type: 'text' as const, text: `Added fix #${fixIdx} [${fix.severity}] "${label}" to session ${sessionId}` }] }
}

function handlePromoteFixes(sessionId: string, milestoneId: string) {
  const state = readTracker()
  const session = state.review_sessions.find(s => s.id === sessionId)
  if (!session) return { content: [{ type: 'text' as const, text: `Session not found: ${sessionId}` }], isError: true }
  if (!session.fixes) session.fixes = []

  const milestone = state.milestones.find(m => m.id === milestoneId)
  if (!milestone) return { content: [{ type: 'text' as const, text: `Milestone not found: ${milestoneId}` }], isError: true }

  const unlinked = session.fixes.filter(f => !f.task_id)
  if (unlinked.length === 0) {
    return { content: [{ type: 'text' as const, text: `No unlinked fixes to promote in session ${sessionId}` }] }
  }

  const created: string[] = []
  const idPattern = new RegExp(`^${milestoneId}_(\\d+)$`)
  for (const fix of unlinked) {
    const existingNums = milestone.subtasks
      .map(s => s.id.match(idPattern))
      .filter(Boolean)
      .map(m => parseInt(m![1], 10))
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1
    const taskNum = String(nextNum).padStart(3, '0')
    const taskId = `${milestoneId}_${taskNum}`
    const priorityMap: Record<string, string> = { critical: 'P1', major: 'P2', minor: 'P3' }

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
      notes: `Promoted from review session "${session.title}" (${sessionId})`,
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
    })

    fix.task_id = taskId
    created.push(`${taskId}: "${fix.label}" [${fix.severity}]`)
  }

  session.updated_at = new Date().toISOString()
  writeTracker(state)

  const lines = [`Promoted ${created.length} fixes from "${session.title}" to milestone "${milestoneId}":`, ...created.map(c => `- ${c}`)]
  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

// ─── QA Handlers ──────────────────────────────────────────────────────────────

function findQAUseCase(state: TrackerState, useCaseId: string): { group: typeof state.qa.groups[number]; uc: QAUseCase } | null {
  for (const group of state.qa.groups) {
    const uc = group.use_cases.find(u => u.id === useCaseId)
    if (uc) return { group, uc }
  }
  return null
}

function handleGetQAStatus() {
  const state = readTracker()
  if (!state.qa?.groups) {
    return { content: [{ type: 'text' as const, text: 'No QA data found in tracker.' }], isError: true }
  }

  let totalUc = 0, verified = 0, agentPass = 0, operatorPass = 0, fails = 0
  const lines: string[] = ['# QA Verification Status\n']

  for (const group of state.qa.groups) {
    const groupVerified = group.use_cases.filter(u => u.agent_status === 'pass' && u.operator_status === 'pass').length
    const groupTotal = group.use_cases.length
    lines.push(`## ${group.name} (${groupVerified}/${groupTotal} verified)`)

    for (const uc of group.use_cases) {
      totalUc++
      if (uc.agent_status === 'pass' && uc.operator_status === 'pass') verified++
      if (uc.agent_status === 'pass') agentPass++
      if (uc.operator_status === 'pass') operatorPass++
      if (uc.agent_status === 'fail' || uc.operator_status === 'fail') fails++

      const agentIcon = uc.agent_status === 'pass' ? '✓' : uc.agent_status === 'fail' ? '✗' : '○'
      const opIcon = uc.operator_status === 'pass' ? '✓' : uc.operator_status === 'fail' ? '✗' : '○'
      const built = uc.built ? '' : ' [NOT BUILT]'
      lines.push(`  ${agentIcon}/${opIcon} ${uc.name}${built}`)
      if (uc.agent_notes) lines.push(`       Agent notes: ${uc.agent_notes}`)
      if (uc.operator_notes) lines.push(`       Operator notes: ${uc.operator_notes}`)
    }
    lines.push('')
  }

  lines.unshift(`**Readiness: ${verified}/${totalUc} verified** | Agent: ${agentPass}/${totalUc} | Operator: ${operatorPass}/${totalUc} | Failures: ${fails}\n`)

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
}

function handleMarkQAResult(useCaseId: string, tester: string, status: string, notes?: string) {
  const state = readTracker()
  if (!state.qa?.groups) {
    return { content: [{ type: 'text' as const, text: 'No QA data found in tracker.' }], isError: true }
  }

  const found = findQAUseCase(state, useCaseId)
  if (!found) {
    return { content: [{ type: 'text' as const, text: `Use case not found: ${useCaseId}` }], isError: true }
  }

  const { uc } = found
  const now = new Date().toISOString()

  if (tester === 'agent') {
    uc.agent_status = status as QAUseCase['agent_status']
    uc.agent_tested_at = now
    uc.agent_notes = notes ?? null
  } else {
    uc.operator_status = status as QAUseCase['operator_status']
    uc.operator_tested_at = now
    uc.operator_notes = notes ?? null
  }

  // Auto-push failure to Review Fixes inbox
  if (status === 'fail') {
    if (!state.review_sessions) state.review_sessions = []
    let qaSession = state.review_sessions.find(s => s.id === 'qa_failures')
    if (!qaSession) {
      qaSession = {
        id: 'qa_failures',
        lane: 'backend',
        title: 'QA Failures',
        status: 'in_progress',
        area: 'QA Verification',
        checklist: [],
        fixes: [],
        priority: 'P1',
        source: 'qa_tab',
        created_at: now,
        updated_at: now,
      }
      state.review_sessions.push(qaSession)
    }
    if (!qaSession.fixes) qaSession.fixes = []
    const fixLabel = `QA: ${uc.name} — ${tester} fail`
    const fix: ReviewFix = {
      label: fixLabel,
      severity: 'major',
      task_id: null,
      created_at: now,
    }
    qaSession.fixes.push(fix)
    qaSession.updated_at = now
    uc.review_fix_id = `qa_failures:fix-${qaSession.fixes.length - 1}`
  }

  writeTracker(state)

  const icon = status === 'pass' ? '✓' : '✗'
  const fixNote = status === 'fail' ? ' → Fix pushed to Review' : ''
  return { content: [{ type: 'text' as const, text: `${icon} ${tester} marked "${uc.name}" as ${status.toUpperCase()}${fixNote}` }] }
}

function handleResetQAResult(useCaseId: string) {
  const state = readTracker()
  if (!state.qa?.groups) {
    return { content: [{ type: 'text' as const, text: 'No QA data found in tracker.' }], isError: true }
  }

  const found = findQAUseCase(state, useCaseId)
  if (!found) {
    return { content: [{ type: 'text' as const, text: `Use case not found: ${useCaseId}` }], isError: true }
  }

  const { uc } = found
  uc.agent_status = 'untested'
  uc.agent_tested_at = null
  uc.agent_notes = null
  uc.operator_status = 'untested'
  uc.operator_tested_at = null
  uc.operator_notes = null
  uc.review_fix_id = null

  writeTracker(state)
  return { content: [{ type: 'text' as const, text: `Reset "${uc.name}" — both agent and operator must re-verify` }] }
}

function handleDeleteReviewSession(sessionId: string) {
  const state = readTracker()
  const idx = state.review_sessions.findIndex(s => s.id === sessionId)
  if (idx === -1) return { content: [{ type: 'text' as const, text: `Session not found: ${sessionId}` }], isError: true }
  const removed = state.review_sessions.splice(idx, 1)[0]
  writeTracker(state)
  return { content: [{ type: 'text' as const, text: `Deleted session "${removed.title}" (${sessionId})` }] }
}

// ─── Milestone & Task Creation Handlers ──────────────────────────────────

function handleCreateMilestone(
  id: string, title: string,
  domain?: string, phase?: string,
  plannedStart?: string, plannedEnd?: string
) {
  const state = readTracker()

  if (state.milestones.find(m => m.id === id)) {
    return { content: [{ type: 'text' as const, text: `Milestone "${id}" already exists.` }], isError: true }
  }

  const milestone: Milestone = {
    id,
    title,
    domain: domain ?? 'general',
    week: 0,
    phase: phase ?? id,
    planned_start: plannedStart ?? null,
    planned_end: plannedEnd ?? null,
    actual_start: null,
    actual_end: null,
    drift_days: 0,
    is_key_milestone: false,
    key_milestone_label: null,
    subtasks: [],
    notes: [],
    dependencies: [],
  }

  state.milestones.push(milestone)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Created milestone "${title}" (${id}) with 0 tasks. Use add_milestone_task to populate it.`,
    }],
  }
}

function handleAddMilestoneTask(
  milestoneId: string, label: string,
  priority?: string,
  acceptanceCriteria?: string[],
  constraints?: string[],
  dependsOn?: string[],
  executionMode?: string
) {
  const state = readTracker()
  const milestone = state.milestones.find(m => m.id === milestoneId)
  if (!milestone) {
    return { content: [{ type: 'text' as const, text: `Milestone not found: ${milestoneId}` }], isError: true }
  }

  const taskNum = String(milestone.subtasks.length + 1).padStart(3, '0')
  const taskId = `${milestoneId}_${taskNum}`

  const task: Subtask = {
    id: taskId,
    label,
    status: 'todo',
    done: false,
    assignee: null,
    blocked_by: null,
    blocked_reason: null,
    completed_at: null,
    completed_by: null,
    priority: priority ?? '2',
    notes: null,
    prompt: null,
    context_files: [],
    reference_docs: [],
    acceptance_criteria: acceptanceCriteria ?? [],
    constraints: constraints ?? [],
    agent_target: null,
    execution_mode: (executionMode as Subtask['execution_mode']) ?? 'agent',
    last_run_id: null,
    depends_on: dependsOn ?? [],
    builder_prompt: null,
    pipeline: null,
  }

  milestone.subtasks.push(task)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: `Added task "${label}" (${taskId}) to milestone "${milestone.title}". Total tasks: ${milestone.subtasks.length}.`,
    }],
  }
}
