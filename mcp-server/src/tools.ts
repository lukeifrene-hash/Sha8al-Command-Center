/**
 * MCP Tool definitions and handlers.
 * Each tool is a function the agent can call during any Claude Code session.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getCanonicalAgent, resolveCanonicalAgentId } from './canonical-agents.js'
import {
  readTracker,
  writeTracker,
  findTask,
  autoUnblockDependents,
  TALKSTORE_ROOT,
  type TrackerState,
  type Subtask,
  type Milestone,
  type ReviewSession,
  type ReviewFix,
  type QAUseCase,
  type MilestoneLane,
  type AuditChecklistItem,
  type AuditResult,
  type ChecklistCategory,
  type ChecklistItem,
  type MilestoneVerdict,
  type MilestoneFinding,
  type MilestoneFindingSeverity,
  type MilestoneFindingCategory,
  type MilestoneAudit,
} from './tracker.js'
import {
  buildTaskContext,
  buildTaskSummary,
  buildProjectStatus,
  buildMilestoneOverview,
  buildChecklistStatus,
} from './context.js'

// ─── Auditor Workflow Constants ─────────────────────────────────────────────

/**
 * Maps milestone IDs to their execution lane. Used by request_audit and
 * submit_audit to decide whether an all-pass audit can auto-approve
 * a task (foundation + product_engines lanes) or whether it must still
 * sit in `review` for operator eyeball (merchant_facing, ship_and_operate).
 */
export const MILESTONE_LANE: Record<string, MilestoneLane> = {
  m1_purge_and_foundation_reset: 'foundation',
  m2_multi_llm_and_async_infra: 'foundation',
  m3_scoring_engine: 'product_engines',
  m4_catalog_intelligence_engine: 'product_engines',
  m5_autopilot_and_guard: 'product_engines',
  m6_attribution_pipeline: 'product_engines',
  m7_merchant_surfaces: 'merchant_facing',
  m8_ux_polish_and_marketing: 'merchant_facing',
  m9_quality_security_compliance: 'ship_and_operate',
  m10_launch_and_post_launch: 'ship_and_operate',
}

const AUTO_APPROVE_LANES: Set<MilestoneLane> = new Set(['foundation', 'product_engines'])

/**
 * Milestone → manifesto section IDs used by the Milestone Auditor bundle.
 * IDs match the section-number prefixes in MASTER-MANIFESTO.md (e.g. "2.3"
 * targets `### 2.3`, "8" targets `## 8.`). The extractor accepts any heading
 * depth so callers don't need to track whether a section is `##` or `###`.
 *
 * Some IDs (e.g. 18.10, 18.11) don't exist in the current manifesto — they
 * are listed here anyway so the map stays forward-compatible; missing
 * sections simply drop out of the returned `goal_state.sections` array.
 */
export const MILESTONE_MANIFESTO_SECTIONS: Record<string, string[]> = {
  m1_purge_and_foundation_reset: ['2.3', '18.1', '18.2'],
  m2_multi_llm_and_async_infra: ['18.4', '13', '14.1'],
  m3_scoring_engine: ['8', '9', '18.3', '18.5', '18.6', '18.7', '18.8'],
  m4_catalog_intelligence_engine: ['9', '18.10', '18.11'],
  m5_autopilot_and_guard: ['10', '12', '18.12', '18.13', '18.14'],
  m6_attribution_pipeline: ['11', '18.15', '18.16', '18.17'],
  m7_merchant_surfaces: ['7', '18.9', '18.10', '18.18', '18.19'],
  m8_ux_polish_and_marketing: ['4', '16'],
  m9_quality_security_compliance: ['14', '17', '22'],
  m10_launch_and_post_launch: ['16', '17', '24'],
}

/** Absolute path to the master manifesto (read-only, verbatim excerpts). */
const MANIFESTO_PATH = join(
  TALKSTORE_ROOT,
  'Brainstorming & Pivot',
  'MASTER-MANIFESTO.md'
)

/** Relative path recorded in the audit bundle for operator display. */
const MANIFESTO_REL_PATH = 'Brainstorming & Pivot/MASTER-MANIFESTO.md'

/**
 * 12-point audit checklist template. Returned by request_audit so the
 * auditor can fill in status + detail per item, then pass back via
 * submit_audit. Keep ID order stable — submit_audit validates against it.
 */
const CHECKLIST_TEMPLATE: AuditChecklistItem[] = [
  // Structural (4)
  { id: 's1', category: 'structural', label: 'Build + typecheck + lint exit 0', status: 'pending' },
  { id: 's2', category: 'structural', label: 'Every acceptance command from prompt block passes', status: 'pending' },
  { id: 's3', category: 'structural', label: 'Git diff scope matches task "What" field (no scope creep)', status: 'pending' },
  { id: 's4', category: 'structural', label: 'None of task "Failure modes" triggered', status: 'pending' },
  // Security (3)
  { id: 'sec1', category: 'security', label: 'No secrets in committed files', status: 'pending' },
  { id: 'sec2', category: 'security', label: 'New dependencies free of known CVEs', status: 'pending' },
  { id: 'sec3', category: 'security', label: 'No shell/SQL/GraphQL injection via string interpolation', status: 'pending' },
  // Compliance (3)
  { id: 'c1', category: 'compliance', label: 'All merchant-data queries scoped with shopId', status: 'pending' },
  { id: 'c2', category: 'compliance', label: 'Any new LLM call gated by consent check', status: 'pending' },
  { id: 'c3', category: 'compliance', label: 'No PII in logs', status: 'pending' },
  // Correctness (2)
  { id: 'cor1', category: 'correctness', label: 'Tests added/updated for new behavior', status: 'pending' },
  { id: 'cor2', category: 'correctness', label: 'Migrations reversible (if schema changed)', status: 'pending' },
]

function getMilestoneLane(milestoneId: string): MilestoneLane {
  return MILESTONE_LANE[milestoneId] ?? 'merchant_facing'
}

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
      'Create a new QA session. Agents should call this to register a debug or verification session. ' +
      'Sessions appear in the Open Sessions section of the QA tab.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        lane: {
          type: 'string',
          enum: ['ui', 'ux', 'backend'],
          description: 'Optional categorization. Defaults to "backend" if omitted.',
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
      required: ['title'],
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
  // ─── Three-phase workflow tools (sweep / prepare / build) ─────────────────
  {
    name: 'claim_next_task',
    description:
      'Atomically claim the next eligible todo task. Filters by tier (complexity), milestone_id, and/or execution_mode. ' +
      'Only returns tasks whose depends_on are all done. Flips status to in_progress and sets assignee to agent_id. ' +
      'Sort order: parallel_priority ascending, then id. Used by the `sweep` phase to let multiple agents (Claude, Codex) ' +
      'pick up work without collisions. Returns full task context for the claimed task, or `{ task: null, reason }` if none.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tier: {
          type: 'string',
          enum: ['small', 'medium', 'large', 'architectural'],
          description: 'Filter by subtask.complexity (optional)',
        },
        milestone_id: {
          type: 'string',
          description: 'Filter tasks to this milestone (optional)',
        },
        execution_mode: {
          type: 'string',
          enum: ['human', 'agent', 'pair'],
          description: 'Filter by execution_mode (optional)',
        },
        agent_id: {
          type: 'string',
          description: 'Agent claiming the task — becomes the task assignee. Defaults to "claude_code".',
        },
      },
    },
  },
  {
    name: 'compute_waves',
    description:
      'Group a milestone\'s remaining tasks (status=todo or blocked) into parallel execution waves by parallel_priority. ' +
      'Each wave is a set of tasks that can run simultaneously once the previous wave completes. ' +
      'Returns structured data: { milestone_id, waves: [{ wave, tasks: [...] }] }.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'Milestone ID to compute waves for',
        },
        tier: {
          type: 'string',
          enum: ['small', 'medium', 'large', 'architectural'],
          description: 'Optional filter by subtask.complexity',
        },
      },
      required: ['milestone_id'],
    },
  },
  {
    name: 'bulk_prepare',
    description:
      'Return the list of non-small tasks in a milestone that still need preparation (prompt enrichment). ' +
      'Filters to status=todo|blocked, complexity in (medium|large|architectural), and prepared !== true. ' +
      'Does NOT execute preparation — it only returns the batch so the orchestrator can fan out Explorer+Researcher pairs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'Milestone ID whose tasks should be prepared',
        },
        tier: {
          type: 'string',
          enum: ['medium', 'large', 'architectural'],
          description: 'Optional filter by complexity (default: all non-small tiers)',
        },
      },
      required: ['milestone_id'],
    },
  },
  {
    name: 'check_file_collisions',
    description:
      'Inspect a batch of task prompts, extract file path tokens (e.g. app/lib/foo.ts, prisma/schema.prisma), and ' +
      'return any file referenced by 2+ tasks. Used before launching a parallel wave to avoid agents stomping each other.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of subtask IDs to inspect',
        },
      },
      required: ['task_ids'],
    },
  },
  // ─── Auditor workflow tools (auto-approve pipeline) ──────────────────────
  {
    name: 'request_audit',
    description:
      'Begin a post-build audit on a task in `review` status. Returns the full task context, milestone lane, ' +
      'auto-approve eligibility, and the 12-point audit checklist template (structural, security, compliance, correctness). ' +
      'The auditor fills in each item\'s status + detail, then calls submit_audit. Tasks in foundation or product_engines ' +
      'lanes auto-approve when all 12 checks pass; other lanes always require operator review.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID to audit (must be in review status)',
        },
        cross_model: {
          type: 'boolean',
          description: 'Whether the orchestrator requested a second, cross-model auditor. Recorded on the log entry.',
        },
        auditor_id: {
          type: 'string',
          description: 'The auditor agent ID (e.g. "claude_code", "codex", "auditor"). Defaults to "auditor".',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'submit_audit',
    description:
      'Submit the filled-in 12-point checklist for a task in review. If every item is pass/n-a AND the milestone is in ' +
      '`foundation` or `product_engines` lane, the task auto-approves (review → done, fires autoUnblockDependents). ' +
      'Otherwise the task stays in review with the audit report attached for operator eyeball.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The subtask ID being audited',
        },
        results: {
          type: 'array',
          description: 'The 12 checklist items with status filled in. Must include every template ID (s1-s4, sec1-sec3, c1-c3, cor1-cor2).',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              category: { type: 'string', enum: ['structural', 'security', 'compliance', 'correctness'] },
              label: { type: 'string' },
              status: { type: 'string', enum: ['pass', 'fail', 'n/a'] },
              detail: { type: 'string' },
            },
            required: ['id', 'status'],
          },
        },
        auditor_id: {
          type: 'string',
          description: 'The auditor agent ID (e.g. "claude_code", "codex", "auditor").',
        },
        auditor_summary: {
          type: 'string',
          description: 'Optional one-paragraph summary of the audit outcome.',
        },
      },
      required: ['task_id', 'results', 'auditor_id'],
    },
  },
  {
    name: 'get_next_actionable_tasks',
    description:
      'Return the set of tasks that are actionable right now (status=todo, not blocked), sorted by parallel_priority then id. ' +
      'Optionally filter by milestone_id and/or complexity tier. Backs the operator\'s `next` command for surfacing ready work. ' +
      'Results include a tier histogram.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'Filter to this milestone (optional)',
        },
        tier: {
          type: 'string',
          enum: ['small', 'medium', 'large', 'architectural'],
          description: 'Filter by complexity tier (optional)',
        },
        limit: {
          type: 'number',
          description: 'Max tasks to return (default 20)',
        },
      },
    },
  },
  // ─── Milestone Auditor subsystem ─────────────────────────────────────────
  {
    name: 'start_milestone_audit',
    description:
      'Begin a post-milestone audit. Validates that ALL subtasks in the milestone are done, then assembles the full ' +
      'audit-context bundle (manifesto goal-state excerpts, prior state doc, per-subtask summary with audit results, ' +
      'exit criteria, linked submission-checklist categories, and a git diff-range hint) for the orchestrator and its ' +
      'four sub-agents (coherence, security, UX, compliance). Returns an error without logging if any subtask is still ' +
      'in todo/in_progress/review/blocked. Logs start_milestone_audit on success.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: {
          type: 'string',
          description: 'The milestone ID (e.g. "m1_purge_and_foundation_reset")',
        },
      },
      required: ['milestone_id'],
    },
  },
  {
    name: 'submit_milestone_audit',
    description:
      'Record the outcome of a milestone audit. Writes a MilestoneAudit record (verdict, findings, report path, state ' +
      'doc path) onto the milestone and applies a batch of submission-checklist updates (check/uncheck). Missing ' +
      'checklist item_ids are skipped and surfaced in the response. Audit is informational only — does NOT gate ' +
      'downstream milestones. Logs submit_milestone_audit with verdict, finding counts, and checklist update counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: { type: 'string', description: 'The milestone ID being audited' },
        verdict: {
          type: 'string',
          enum: ['pass', 'pass_with_notes', 'fail'],
          description: 'Overall audit verdict',
        },
        findings: {
          type: 'array',
          description: 'Findings from the four sub-agents. May be empty on a clean pass.',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
              category: { type: 'string', enum: ['coherence', 'security', 'ux', 'compliance'] },
              description: { type: 'string' },
              evidence: { type: 'string' },
              remediation: { type: 'string' },
            },
            required: ['severity', 'category', 'description', 'evidence'],
          },
        },
        checklist_updates: {
          type: 'array',
          description: 'Batch of check/uncheck actions on submission-checklist items (by full item_id like "oauth_session_01").',
          items: {
            type: 'object',
            properties: {
              item_id: { type: 'string' },
              action: { type: 'string', enum: ['check', 'uncheck'] },
              reason: { type: 'string' },
            },
            required: ['item_id', 'action', 'reason'],
          },
        },
        report_path: {
          type: 'string',
          description: 'Relative path to the audit report markdown (e.g. "docs/audit-reports/m3-audit.md")',
        },
        state_doc_path: {
          type: 'string',
          description: 'Relative path to the "after-milestone" state doc (e.g. "docs/state/after-m3-state.md")',
        },
        audited_at: {
          type: 'string',
          description: 'ISO timestamp; defaults to now',
        },
        auditor_id: {
          type: 'string',
          description: 'Agent id recorded on the log entry. Defaults to "milestone-auditor".',
        },
      },
      required: ['milestone_id', 'verdict', 'findings', 'checklist_updates', 'report_path', 'state_doc_path'],
    },
  },
  {
    name: 'get_milestone_audit_context',
    description:
      'Return the same audit-context bundle as start_milestone_audit, but WITHOUT validating readiness and WITHOUT ' +
      'mutating state. Safe to call at any time — useful for re-entering a mid-audit session or inspecting the bundle ' +
      'without kicking off the formal audit. Does not log.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        milestone_id: { type: 'string', description: 'The milestone ID' },
      },
      required: ['milestone_id'],
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
          (args.lane as string) || 'backend', args.title as string, args.area as string,
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
      case 'claim_next_task':
        return handleClaimNextTask(
          args.tier as string | undefined,
          args.milestone_id as string | undefined,
          args.execution_mode as string | undefined,
          args.agent_id as string | undefined
        )
      case 'compute_waves':
        return handleComputeWaves(
          args.milestone_id as string,
          args.tier as string | undefined
        )
      case 'bulk_prepare':
        return handleBulkPrepare(
          args.milestone_id as string,
          args.tier as string | undefined
        )
      case 'check_file_collisions':
        return handleCheckFileCollisions(
          (args.task_ids as string[]) || []
        )
      case 'request_audit':
        return handleRequestAudit(
          args.task_id as string,
          args.cross_model as boolean | undefined,
          args.auditor_id as string | undefined
        )
      case 'submit_audit':
        return handleSubmitAudit(
          args.task_id as string,
          (args.results as AuditChecklistItem[]) || [],
          args.auditor_id as string,
          args.auditor_summary as string | undefined
        )
      case 'get_next_actionable_tasks':
        return handleGetNextActionableTasks(
          args.milestone_id as string | undefined,
          args.tier as string | undefined,
          args.limit as number | undefined
        )
      case 'start_milestone_audit':
        return handleStartMilestoneAudit(args.milestone_id as string)
      case 'submit_milestone_audit':
        return handleSubmitMilestoneAudit(
          args.milestone_id as string,
          args.verdict as MilestoneVerdict,
          (args.findings as MilestoneFinding[]) || [],
          (args.checklist_updates as Array<{ item_id: string; action: 'check' | 'uncheck'; reason: string }>) || [],
          args.report_path as string,
          args.state_doc_path as string,
          args.audited_at as string | undefined,
          args.auditor_id as string | undefined
        )
      case 'get_milestone_audit_context':
        return handleGetMilestoneAuditContext(args.milestone_id as string)
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
  const lane = getMilestoneLane(milestone.id)
  const autoApproveSmallTask = task.complexity === 'small' && AUTO_APPROVE_LANES.has(lane)
  const now = new Date().toISOString()

  task.status = autoApproveSmallTask ? 'done' : 'review'
  task.blocked_by = null
  task.blocked_reason = null

  if (autoApproveSmallTask) {
    task.done = true
    task.completed_at = now
    task.completed_by = resolvedAgentId

    state.agent_log.push({
      id: `run_${Date.now()}`,
      agent_id: resolvedAgentId,
      action: 'task_auto_approved',
      target_type: 'subtask',
      target_id: taskId,
      description: `Auto-approved on complete_task (${lane} lane, small task). ${summary}`,
      timestamp: now,
      tags: ['complete', 'auto-approved', 'done', 'mcp'],
    })
  } else {
    const runId = `run_${Date.now()}`
    state.agent_log.push({
      id: runId,
      agent_id: resolvedAgentId,
      action: 'task_submitted_for_review',
      target_type: 'subtask',
      target_id: taskId,
      description: summary,
      timestamp: now,
      tags: ['review', 'mcp'],
    })
  }

  // Calculate new milestone progress
  const done = milestone.subtasks.filter((s) => s.done).length
  const total = milestone.subtasks.length
  const extras: string[] = []

  if (autoApproveSmallTask) {
    if (done === total && !milestone.actual_end) {
      milestone.actual_end = now.split('T')[0]
      extras.push(`Milestone "${milestone.title}" fully complete — actual_end set to ${milestone.actual_end}`)
    }

    const unblockedMessages = autoUnblockDependents(state, taskId, milestone.id)
    if (unblockedMessages.length > 0) {
      extras.push(`\nAuto-unblocked ${unblockedMessages.length} task(s):`)
      extras.push(...unblockedMessages.map((message) => `  • ${message}`))
    }
  }

  touchAgent(state, resolvedAgentId)
  writeTracker(state)

  return {
    content: [{
      type: 'text' as const,
      text: autoApproveSmallTask
        ? `Task "${taskId}" auto-approved and marked as done.\n\nSummary: ${summary}\nMilestone progress: ${done}/${total}${extras.length > 0 ? '\n' + extras.join('\n') : ''}`
        : `Task "${taskId}" submitted for review.\n\nSummary: ${summary}\nMilestone progress: ${done}/${total} done\n\nThe operator will review and either approve (→ done) or request revisions (→ in_progress with feedback).`,
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
    // A non-empty builder_prompt is the canonical "prep complete" signal.
    // It's what the build phase reads to execute the task, and what bulk_prepare
    // filters on (prepared !== true). Flip the flag so /auto + /build stop
    // asking the operator to re-prepare already-prepared work.
    if (builderPrompt) {
      task.prepared = true
      changes.push('prepared → true')
    } else {
      task.prepared = false
      changes.push('prepared → false')
    }
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
    const weekEntries = state.agent_log.filter((e) => {
      return resolveCanonicalAgentId(e.agent_id) === agent.id && e.timestamp >= weekAgo
    })
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

    const agentName =
      state.agents.find((a) => a.id === resolveCanonicalAgentId(e.agent_id))?.name || e.agent_id
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
  const resolvedAgentId = resolveCanonicalAgentId(agentId)
  let agent = state.agents.find((a) => a.id === resolvedAgentId)

  if (!agent) {
    const canonicalAgent = getCanonicalAgent(resolvedAgentId)
    if (canonicalAgent) {
      agent = { ...canonicalAgent }
      state.agents.push(agent)
    }
  }

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

// Three-phase workflow handlers (sweep / prepare / build)

/**
 * Returns true if every dependency in task.depends_on is satisfied.
 * A dep is satisfied if it matches another subtask that is done, or a
 * milestone whose every subtask is done.
 */
function depsSatisfied(state: TrackerState, task: Subtask): boolean {
  const deps = task.depends_on || []
  if (deps.length === 0) return true

  for (const depId of deps) {
    const sub = findTask(state, depId)
    if (sub) {
      if (!sub.subtask.done) return false
      continue
    }

    const ms = state.milestones.find((m) => m.id === depId)
    if (ms) {
      const allDone = ms.subtasks.every((s) => s.done)
      if (!allDone) return false
      continue
    }

    // Unknown dep id — treat as unsatisfied so we don't claim a task with
    // a dangling dependency.
    return false
  }

  return true
}

function handleClaimNextTask(
  tier?: string,
  milestoneId?: string,
  executionMode?: string,
  agentId?: string
) {
  const state = readTracker()
  const resolvedAgentId = agentId || 'claude_code'

  const eligible: { task: Subtask; milestone: Milestone }[] = []

  for (const ms of state.milestones) {
    if (milestoneId && ms.id !== milestoneId) continue
    for (const task of ms.subtasks) {
      if (task.status !== 'todo') continue
      if (tier && task.complexity !== tier) continue
      if (executionMode && task.execution_mode !== executionMode) continue
      if (!depsSatisfied(state, task)) continue
      eligible.push({ task, milestone: ms })
    }
  }

  if (eligible.length === 0) {
    const filterDesc = [
      tier ? `tier=${tier}` : null,
      milestoneId ? `milestone=${milestoneId}` : null,
      executionMode ? `mode=${executionMode}` : null,
    ].filter(Boolean).join(', ') || 'none'
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          task: null,
          reason: `No eligible todo tasks match filters [${filterDesc}] with all depends_on satisfied.`,
        }, null, 2),
      }],
    }
  }

  // Deterministic sort: parallel_priority asc (undefined => Infinity), then id asc
  eligible.sort((a, b) => {
    const pa = a.task.parallel_priority ?? Number.POSITIVE_INFINITY
    const pb = b.task.parallel_priority ?? Number.POSITIVE_INFINITY
    if (pa !== pb) return pa - pb
    return a.task.id.localeCompare(b.task.id)
  })

  const chosen = eligible[0]
  const { task, milestone } = chosen

  // Atomic claim: flip to in_progress and set assignee before writing.
  task.status = 'in_progress'
  task.assignee = resolvedAgentId
  const runId = `run_${Date.now()}_${task.id}`
  task.last_run_id = runId

  // Auto-stamp milestone actual_start
  if (!milestone.actual_start) {
    milestone.actual_start = new Date().toISOString().split('T')[0]
    if (milestone.planned_start) {
      const planned = new Date(milestone.planned_start)
      const actual = new Date(milestone.actual_start)
      milestone.drift_days = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24))
    }
  }

  state.agent_log.push({
    id: runId,
    agent_id: resolvedAgentId,
    action: 'claim_next_task',
    target_type: 'subtask',
    target_id: task.id,
    description: `Claimed task "${task.label}" (tier=${task.complexity ?? 'n/a'}, priority=${task.parallel_priority ?? 'n/a'})`,
    timestamp: new Date().toISOString(),
    tags: ['claim', 'sweep', 'mcp'],
  })

  touchAgent(state, resolvedAgentId)
  writeTracker(state)

  const context = buildTaskContext(state, task, milestone)
  const payload = {
    task: {
      id: task.id,
      label: task.label,
      status: task.status,
      milestone_id: milestone.id,
      complexity: task.complexity ?? null,
      parallel_priority: task.parallel_priority ?? null,
      execution_mode: task.execution_mode,
      depends_on: task.depends_on,
      assignee: task.assignee,
    },
    context,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

function handleComputeWaves(milestoneId: string, tier?: string) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return {
      content: [{ type: 'text' as const, text: `Milestone "${milestoneId}" not found.` }],
      isError: true,
    }
  }

  const candidates = milestone.subtasks.filter((s) => {
    if (s.status !== 'todo' && s.status !== 'blocked') return false
    if (tier && s.complexity !== tier) return false
    return true
  })

  const byWave = new Map<number, Subtask[]>()
  for (const t of candidates) {
    const key = t.parallel_priority ?? 9999
    if (!byWave.has(key)) byWave.set(key, [])
    byWave.get(key)!.push(t)
  }

  const waves = [...byWave.entries()]
    .sort(([a], [b]) => a - b)
    .map(([wave, tasks]) => ({
      wave,
      tasks: tasks
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((t) => ({
          id: t.id,
          label: t.label,
          status: t.status,
          depends_on: t.depends_on,
          execution_mode: t.execution_mode,
          complexity: t.complexity ?? null,
        })),
    }))

  const payload = { milestone_id: milestoneId, waves }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

function handleBulkPrepare(milestoneId: string, tier?: string) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return {
      content: [{ type: 'text' as const, text: `Milestone "${milestoneId}" not found.` }],
      isError: true,
    }
  }

  const nonSmallTiers = new Set(['medium', 'large', 'architectural'])
  const allowedTiers = tier ? new Set([tier]) : nonSmallTiers

  const tasks = milestone.subtasks
    .filter((t) => (t.status === 'todo' || t.status === 'blocked'))
    .filter((t) => t.complexity && allowedTiers.has(t.complexity))
    .filter((t) => t.prepared !== true)
    .map((t) => ({
      id: t.id,
      label: t.label,
      complexity: t.complexity ?? null,
      prompt: t.prompt,
      depends_on: t.depends_on,
      parallel_priority: t.parallel_priority ?? null,
      execution_mode: t.execution_mode,
    }))

  const payload = { milestone_id: milestoneId, tasks }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

/**
 * Extract file-path-like tokens from a string.
 * Looks for sequences that contain at least one '/' and one dot-extension,
 * plus a short list of bare filenames that commonly appear in prompts.
 */
function extractFileTokens(text: string): Set<string> {
  const tokens = new Set<string>()
  if (!text) return tokens

  // Match path-ish tokens like:
  //   app/lib/capabilities/headroom.ts
  //   prisma/schema.prisma
  //   src/renderer/views/Foo.tsx
  //   .claude/rules/something.md
  const pathRe = /(?:^|[\s`'"(<>[\]|,])((?:\.?[\w.-]+\/)+[\w.-]+\.[\w]+)/g

  let m: RegExpExecArray | null
  while ((m = pathRe.exec(text)) !== null) {
    tokens.add(m[1])
  }

  // Bare config/root files that lack a directory prefix
  const bareFiles = [
    'shopify.app.toml',
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
  ]
  for (const f of bareFiles) {
    const re = new RegExp(`(?:^|[\\s\`'"(<>\\[\\]|,])${f.replace(/[.]/g, '\\.')}(?:[\\s\`'".,;:)]|$)`)
    if (re.test(text)) tokens.add(f)
  }

  return tokens
}

function handleCheckFileCollisions(taskIds: string[]) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return {
      content: [{ type: 'text' as const, text: `task_ids must be a non-empty array.` }],
      isError: true,
    }
  }

  const state = readTracker()
  const fileToTasks = new Map<string, Set<string>>()
  const missing: string[] = []

  for (const id of taskIds) {
    const match = findTask(state, id)
    if (!match) {
      missing.push(id)
      continue
    }
    const { subtask } = match

    const promptText = subtask.prompt ?? ''
    const extraText = [
      ...(subtask.acceptance_criteria || []),
      ...(subtask.constraints || []),
      subtask.notes ?? '',
      subtask.builder_prompt ?? '',
    ].join('\n')
    const contextFiles = subtask.context_files || []

    const tokens = extractFileTokens(promptText + '\n' + extraText)
    for (const f of contextFiles) tokens.add(f)

    for (const tok of tokens) {
      if (!fileToTasks.has(tok)) fileToTasks.set(tok, new Set())
      fileToTasks.get(tok)!.add(id)
    }
  }

  const collisions = [...fileToTasks.entries()]
    .filter(([, ids]) => ids.size >= 2)
    .map(([file, ids]) => ({
      file,
      task_ids: [...ids].sort(),
    }))
    .sort((a, b) => a.file.localeCompare(b.file))

  const payload = {
    collisions,
    ...(missing.length > 0 ? { missing_task_ids: missing } : {}),
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

// ─── Auditor Workflow Handlers ──────────────────────────────────────────────

function handleRequestAudit(
  taskId: string,
  crossModel?: boolean,
  auditorId?: string
) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Task "${taskId}" not found.` }) }],
      isError: true,
    }
  }

  const { subtask, milestone } = match
  if (subtask.status !== 'review') {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Task not in review status' }) }],
      isError: true,
    }
  }

  const resolvedAuditorId = auditorId || 'auditor'
  const lane = getMilestoneLane(milestone.id)
  const autoApproveEligible = AUTO_APPROVE_LANES.has(lane)

  // Build the full task context (same shape as get_task_context) for the auditor.
  // Some legacy tasks in the tracker JSON predate the Subtask shape and may be
  // missing fields like acceptance_criteria — fall back to a minimal block in
  // that case rather than crashing the audit request.
  let promptBlock: string
  try {
    promptBlock = buildTaskContext(state, subtask, milestone)
  } catch (err) {
    promptBlock =
      `# Task: ${subtask.label}\n` +
      `- **ID:** ${subtask.id}\n` +
      `- **Status:** ${subtask.status}\n` +
      `- **Milestone:** ${milestone.title} (${milestone.id})\n\n` +
      (subtask.prompt ? `## Prompt\n${subtask.prompt}\n\n` : '') +
      `*Note: full buildTaskContext threw (${err instanceof Error ? err.message : String(err)}). ` +
      `This task predates the current Subtask shape; the auditor should rely on the raw task payload.*`
  }

  // Fresh checklist copy (never hand out the shared module-level template).
  const checklist: AuditChecklistItem[] = CHECKLIST_TEMPLATE.map((item) => ({ ...item }))

  state.agent_log.push({
    id: `log_${Date.now()}_${taskId}_request_audit`,
    agent_id: resolvedAuditorId,
    action: 'request_audit',
    target_type: 'subtask',
    target_id: taskId,
    description:
      `Audit requested for "${subtask.label}" (lane=${lane}, auto_approve_eligible=${autoApproveEligible}` +
      `${crossModel ? ', cross_model=true' : ''})`,
    timestamp: new Date().toISOString(),
    tags: ['audit', 'request', 'mcp', ...(crossModel ? ['cross-model'] : [])],
  })

  touchAgent(state, resolvedAuditorId)
  writeTracker(state)

  const payload = {
    task_id: taskId,
    task: subtask,
    prompt: promptBlock,
    acceptance_criteria: subtask.acceptance_criteria ?? [],
    milestone_id: milestone.id,
    milestone_lane: lane,
    auto_approve_eligible: autoApproveEligible,
    checklist,
    cross_model_requested: Boolean(crossModel),
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

function handleSubmitAudit(
  taskId: string,
  results: AuditChecklistItem[],
  auditorId: string,
  auditorSummary?: string
) {
  const state = readTracker()
  const match = findTask(state, taskId)
  if (!match) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Task "${taskId}" not found.` }) }],
      isError: true,
    }
  }

  const { subtask, milestone } = match
  const task = milestone.subtasks.find((s) => s.id === taskId)!

  if (task.status !== 'review') {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Task "${taskId}" is not in review (current: ${task.status}).` }) }],
      isError: true,
    }
  }

  if (!Array.isArray(results) || results.length === 0) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'results must be a non-empty array of AuditChecklistItem.' }) }],
      isError: true,
    }
  }

  // Validate: every template ID must be represented, status must be pass/fail/n/a.
  const validStatuses = new Set(['pass', 'fail', 'n/a'])
  const templateIds = new Set(CHECKLIST_TEMPLATE.map((t) => t.id))
  const resultIds = new Set(results.map((r) => r.id))

  const missingIds = [...templateIds].filter((id) => !resultIds.has(id))
  if (missingIds.length > 0) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Missing required checklist items: ${missingIds.join(', ')}` }) }],
      isError: true,
    }
  }

  for (const r of results) {
    if (!templateIds.has(r.id)) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown checklist item id: ${r.id}` }) }],
        isError: true,
      }
    }
    if (!validStatuses.has(r.status)) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Invalid status for ${r.id}: ${r.status}. Must be pass|fail|n/a.` }) }],
        isError: true,
      }
    }
  }

  // Canonicalize items: preserve template order + label/category; trust auditor's status + detail.
  const byResultId = new Map(results.map((r) => [r.id, r] as const))
  const canonicalItems: AuditChecklistItem[] = CHECKLIST_TEMPLATE.map((tmpl) => {
    const r = byResultId.get(tmpl.id)!
    return {
      id: tmpl.id,
      category: tmpl.category,
      label: tmpl.label,
      status: r.status,
      ...(r.detail !== undefined ? { detail: r.detail } : {}),
    }
  })

  const pass = canonicalItems.every((i) => i.status !== 'fail')
  const lane = getMilestoneLane(milestone.id)
  const autoApproveEligible = AUTO_APPROVE_LANES.has(lane)
  const autoApproved = pass && autoApproveEligible

  const now = new Date().toISOString()
  const auditResult: AuditResult = {
    auditor_id: auditorId,
    audited_at: now,
    pass,
    items: canonicalItems,
    ...(auditorSummary ? { summary: auditorSummary } : {}),
  }

  task.audit_results = auditResult

  const failedItems = canonicalItems.filter((i) => i.status === 'fail')
  const reasoning = autoApproved
    ? `Auto-approved: ${lane} lane + all 12 checks pass`
    : !pass
      ? `Review: ${failedItems.length} check(s) failed (${failedItems.map((i) => i.id).join(', ')})`
      : `Review: ${lane} lane requires operator review`

  const unblocked: string[] = []

  if (autoApproved) {
    // Internal approval — mirror handleApproveTask's write path so we keep
    // the same side-effects (autoUnblockDependents + actual_end stamp).
    task.status = 'done'
    task.done = true
    task.completed_at = now
    task.completed_by = auditorId

    // Auto-stamp milestone actual_end if all tasks are now done.
    const done = milestone.subtasks.filter((s) => s.done).length
    const total = milestone.subtasks.length
    if (done === total && !milestone.actual_end) {
      milestone.actual_end = now.split('T')[0]
    }

    const unblockedMessages = autoUnblockDependents(state, taskId, milestone.id)
    // Extract the bare task IDs from the human-readable messages.
    for (const msg of unblockedMessages) {
      const m = msg.match(/Task "([^"]+)"/)
      if (m) unblocked.push(m[1])
    }

    state.agent_log.push({
      id: `log_${Date.now()}_${taskId}_auto_approved`,
      agent_id: auditorId,
      action: 'task_auto_approved',
      target_type: 'subtask',
      target_id: taskId,
      description:
        `Auto-approved by auditor ${auditorId} — all 12 audit checks pass (${lane} lane)` +
        (auditorSummary ? `. ${auditorSummary}` : ''),
      timestamp: now,
      tags: ['audit', 'auto-approved', 'done', 'mcp'],
    })
  }

  // Always log submit_audit itself.
  state.agent_log.push({
    id: `log_${Date.now()}_${taskId}_submit_audit`,
    agent_id: auditorId,
    action: 'submit_audit',
    target_type: 'subtask',
    target_id: taskId,
    description: `Audit submitted — pass=${pass}, lane=${lane}, auto_approved=${autoApproved}. ${reasoning}`,
    timestamp: now,
    tags: ['audit', 'submit', pass ? 'pass' : 'fail', autoApproved ? 'auto-approved' : 'review', 'mcp'],
  })

  touchAgent(state, auditorId)
  writeTracker(state)

  const payload = {
    auto_approved: autoApproved,
    new_status: (autoApproved ? 'done' : 'review') as 'done' | 'review',
    reasoning,
    ...(autoApproved && unblocked.length > 0 ? { unblocked_tasks: unblocked } : {}),
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

function handleGetNextActionableTasks(
  milestoneId?: string,
  tier?: string,
  limit?: number
) {
  const state = readTracker()
  const resolvedLimit = typeof limit === 'number' && limit > 0 ? limit : 20

  const eligible: { task: Subtask; milestone: Milestone }[] = []
  for (const ms of state.milestones) {
    if (milestoneId && ms.id !== milestoneId) continue
    for (const task of ms.subtasks) {
      if (task.status !== 'todo') continue
      if (tier && task.complexity !== tier) continue
      if (!depsSatisfied(state, task)) continue
      eligible.push({ task, milestone: ms })
    }
  }

  eligible.sort((a, b) => {
    const pa = a.task.parallel_priority ?? Number.POSITIVE_INFINITY
    const pb = b.task.parallel_priority ?? Number.POSITIVE_INFINITY
    if (pa !== pb) return pa - pb
    return a.task.id.localeCompare(b.task.id)
  })

  const sliced = eligible.slice(0, resolvedLimit)

  const tasks = sliced.map(({ task, milestone }) => ({
    id: task.id,
    label: task.label,
    milestone_id: milestone.id,
    complexity: task.complexity ?? 'unknown',
    execution_mode: task.execution_mode,
    parallel_priority: task.parallel_priority ?? Number.POSITIVE_INFINITY,
  }))

  const groupedByTier = { small: 0, medium: 0, large: 0, architectural: 0 }
  for (const { task } of eligible) {
    const c = task.complexity
    if (c === 'small' || c === 'medium' || c === 'large' || c === 'architectural') {
      groupedByTier[c] += 1
    }
  }

  const payload = {
    tasks,
    grouped_by_tier: groupedByTier,
    total: eligible.length,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

// ─── Milestone Auditor Handlers ─────────────────────────────────────────────

/**
 * Extract the first paragraph under the first matched section. Used for the
 * `summary` field in the audit bundle — a sub-paragraph snapshot so the
 * orchestrator doesn't need to re-read the full excerpt to get the gist.
 */
function extractFirstParagraph(text: string): string {
  if (!text) return ''
  // Skip the header line, find first non-empty block.
  const lines = text.split('\n')
  const body: string[] = []
  let started = false
  for (const line of lines) {
    if (line.startsWith('#')) continue
    if (!line.trim()) {
      if (started) break
      continue
    }
    body.push(line)
    started = true
    if (body.length > 6) break // cap to keep payload small
  }
  return body.join(' ').trim()
}

/**
 * Extract one or more sections from a markdown document. A section id like
 * "8" matches `## 8.` or `### 8.` (anything with that prefix). "2.3" matches
 * `### 2.3`, `## 2.3`, `#### 2.3`, etc. A section runs until the next header
 * of equal or shallower depth.
 *
 * Returns the concatenated verbatim excerpts (header + body) for every
 * matched section in the order requested. Missing sections silently drop.
 */
function extractManifestoSectionsById(content: string, sectionIds: string[]): {
  excerpts: string[]
  matched: string[]
} {
  const lines = content.split('\n')
  const excerpts: string[] = []
  const matched: string[] = []

  for (const id of sectionIds) {
    // Build a header-matching regex. `## 8` should match `## 8.` and `## 8 Something`
    // but NOT `## 80.` — so we anchor on either `.` or whitespace/end-of-line after
    // the prefix. For `2.3` the suffix can be `.`, whitespace, or EOL.
    const escapedId = id.replace(/\./g, '\\.')
    const headerRe = new RegExp(`^(#{2,6})\\s+${escapedId}(?=[.\\s]|$)`)

    let captureDepth: number | null = null
    const captured: string[] = []

    for (const line of lines) {
      const anyHeader = line.match(/^(#{1,6})\s/)
      if (captureDepth === null) {
        const match = line.match(headerRe)
        if (match) {
          captureDepth = match[1].length
          captured.push(line)
        }
        continue
      }
      // capturing
      if (anyHeader) {
        const depth = anyHeader[1].length
        if (depth <= captureDepth) {
          break // next section of equal or shallower depth → stop
        }
      }
      captured.push(line)
    }

    if (captured.length > 0) {
      // Trim trailing empty lines.
      while (captured.length > 1 && !captured[captured.length - 1].trim()) {
        captured.pop()
      }
      excerpts.push(captured.join('\n'))
      matched.push(id)
    }
  }

  return { excerpts, matched }
}

/**
 * Heuristic classifier — deterministic phrase match to decide whether a
 * submission-checklist item is "verifiable" (grep-able / script-able) or
 * "manual" (requires operator / counsel / visual sign-off). Conservative:
 * anything that doesn't match a verifiable phrase defaults to manual.
 */
function classifyChecklistItem(item: ChecklistItem): 'verifiable' | 'manual' {
  const text = (item.text ?? item.label ?? '').toLowerCase()
  if (!text) return 'manual'

  const manualPhrases = [
    'counsel-approved',
    'counsel ',
    'operator',
    'visually',
    'manually confirm',
    'manual confirm',
  ]
  for (const p of manualPhrases) {
    if (text.includes(p)) return 'manual'
  }

  const verifiablePhrases = [
    'scope declared',
    'scopes declared',
    'declares exactly',
    'prisma model has',
    'prisma model',
    'migration applies',
    'migration applied',
    'route registered',
    'env var declared',
    'env var ',
    'file exists',
    'toml contains',
    'toml declares',
    'package.json',
    'not requested',
    'wired',
  ]
  for (const p of verifiablePhrases) {
    if (text.includes(p)) return 'verifiable'
  }

  return 'manual'
}

/**
 * Compute the best-effort git diff range. Without spawning git, we pick a
 * conservative fallback: if the prior milestone has an `actual_end` date,
 * hint that as a ref-name heuristic (the orchestrator may or may not have
 * tagged it). Otherwise fall back to `HEAD~50`.
 */
function computeDiffRange(
  milestones: Milestone[],
  currentMilestoneId: string
): { base_ref: string; head_ref: string } {
  const index = milestones.findIndex((m) => m.id === currentMilestoneId)
  const prior = index > 0 ? milestones[index - 1] : null
  if (prior && prior.actual_end) {
    // Conventional release/milestone tag naming — orchestrator can fall back
    // if the tag doesn't resolve.
    return { base_ref: `milestone/${prior.id}`, head_ref: 'HEAD' }
  }
  return { base_ref: 'HEAD~50', head_ref: 'HEAD' }
}

/** Shared bundle builder — used by both start_milestone_audit and get_milestone_audit_context. */
function buildMilestoneAuditBundle(state: TrackerState, milestone: Milestone) {
  const lane: MilestoneLane = MILESTONE_LANE[milestone.id] ?? 'merchant_facing'

  // ── Goal state (manifesto excerpts) ──
  const sectionIds = MILESTONE_MANIFESTO_SECTIONS[milestone.id] ?? []
  let excerptsCombined = ''
  let matchedSections: string[] = []
  try {
    if (existsSync(MANIFESTO_PATH)) {
      const manifestoContent = readFileSync(MANIFESTO_PATH, 'utf-8')
      const { excerpts, matched } = extractManifestoSectionsById(
        manifestoContent,
        sectionIds
      )
      excerptsCombined = excerpts.join('\n\n---\n\n')
      matchedSections = matched
    }
  } catch {
    // Non-fatal: caller still gets the rest of the bundle.
  }

  const goalSummary = milestone.goal
    ? milestone.goal
    : extractFirstParagraph(excerptsCombined)

  // ── Prior state doc ──
  const index = state.milestones.findIndex((m) => m.id === milestone.id)
  const priorMilestone = index > 0 ? state.milestones[index - 1] : null
  // Match the convention: "after-m<N-1>-state.md". For m1 there is no prior.
  const priorNumMatch = priorMilestone ? priorMilestone.id.match(/^m(\d+)_/) : null
  const priorNum = priorNumMatch ? priorNumMatch[1] : null
  const priorRelPath = priorNum ? `docs/state/after-m${priorNum}-state.md` : ''
  const priorAbsPath = priorRelPath ? join(TALKSTORE_ROOT, priorRelPath) : ''
  let priorContents: string | null = null
  let priorExists = false
  if (priorAbsPath && existsSync(priorAbsPath)) {
    try {
      priorContents = readFileSync(priorAbsPath, 'utf-8')
      priorExists = true
    } catch {
      priorContents = null
    }
  }

  // ── Per-subtask summary ──
  const subtasksSummary = milestone.subtasks.map((t) => ({
    id: t.id,
    label: t.label,
    complexity: t.complexity ?? 'unknown',
    execution_mode: t.execution_mode,
    audit_results: t.audit_results ?? null,
    completed_at: t.completed_at,
    completed_by: t.completed_by,
  }))

  // ── Linked checklist categories ──
  const linkedCategories = state.submission_checklist.categories.filter(
    (c) => c.linked_milestone === milestone.id
  )
  const linkedChecklistCategories = linkedCategories.map((cat) => {
    const verifiable: ChecklistItem[] = []
    const manual: ChecklistItem[] = []
    for (const item of cat.items) {
      if (classifyChecklistItem(item) === 'verifiable') {
        verifiable.push(item)
      } else {
        manual.push(item)
      }
    }
    return {
      category: cat,
      items_verifiable: verifiable,
      items_manual: manual,
    }
  })

  // ── Git diff range hint ──
  const diffRange = computeDiffRange(state.milestones, milestone.id)

  return {
    milestone_id: milestone.id,
    milestone_title: milestone.title,
    milestone_lane: lane,
    goal_state: {
      source_path: MANIFESTO_REL_PATH,
      sections: matchedSections,
      // Full verbatim excerpts, joined; empty string if manifesto unreadable.
      excerpts: excerptsCombined,
      summary: goalSummary,
    },
    prior_state: {
      exists: priorExists,
      path: priorRelPath,
      contents: priorContents,
    },
    subtasks_summary: subtasksSummary,
    // Notes on the milestone double as the declared exit criteria in this tracker.
    exit_criteria: milestone.notes ?? [],
    linked_checklist_categories: linkedChecklistCategories,
    diff_range: diffRange,
  }
}

function handleStartMilestoneAudit(milestoneId: string) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Milestone "${milestoneId}" not found.` }) }],
      isError: true,
    }
  }

  // Readiness validation: every subtask must be done.
  const notDone = milestone.subtasks.filter((s) => s.status !== 'done')
  if (notDone.length > 0) {
    const byStatus: Record<string, number> = {}
    for (const t of notDone) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
    const detail = Object.entries(byStatus)
      .map(([s, n]) => `${n} in ${s}`)
      .join(', ')
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: `Milestone not ready: ${notDone.length} tasks still in ${detail}`,
          milestone_id: milestoneId,
          pending_tasks: notDone.map((t) => ({ id: t.id, status: t.status, label: t.label })),
        }),
      }],
      isError: true,
    }
  }

  const bundle = buildMilestoneAuditBundle(state, milestone)

  // Log start_milestone_audit.
  state.agent_log.push({
    id: `log_${Date.now()}_${milestoneId}_start_milestone_audit`,
    agent_id: 'milestone-auditor',
    action: 'start_milestone_audit',
    target_type: 'milestone',
    target_id: milestoneId,
    description:
      `Milestone audit started for "${milestone.title}" (${milestoneId}) — lane=${bundle.milestone_lane}, ` +
      `${milestone.subtasks.length} subtasks done, ${bundle.linked_checklist_categories.length} checklist categories linked`,
    timestamp: new Date().toISOString(),
    tags: ['milestone-audit', 'start', 'mcp'],
  })

  touchAgent(state, 'milestone-auditor')
  writeTracker(state)

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(bundle, null, 2) }],
  }
}

function handleGetMilestoneAuditContext(milestoneId: string) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Milestone "${milestoneId}" not found.` }) }],
      isError: true,
    }
  }

  const bundle = buildMilestoneAuditBundle(state, milestone)
  // Intentionally: no validation, no log, no touchAgent, no writeTracker.
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(bundle, null, 2) }],
  }
}

function handleSubmitMilestoneAudit(
  milestoneId: string,
  verdict: MilestoneVerdict,
  findings: MilestoneFinding[],
  checklistUpdates: Array<{ item_id: string; action: 'check' | 'uncheck'; reason: string }>,
  reportPath: string,
  stateDocPath: string,
  auditedAt?: string,
  auditorIdArg?: string
) {
  const state = readTracker()
  const milestone = state.milestones.find((m) => m.id === milestoneId)
  if (!milestone) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Milestone "${milestoneId}" not found.` }) }],
      isError: true,
    }
  }

  if (!['pass', 'pass_with_notes', 'fail'].includes(verdict)) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: `Invalid verdict "${verdict}". Must be pass|pass_with_notes|fail.` }) }],
      isError: true,
    }
  }

  if (!reportPath || !stateDocPath) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'report_path and state_doc_path are required.' }) }],
      isError: true,
    }
  }

  // Validate findings shape + severity/category enums.
  const validSeverity = new Set<MilestoneFindingSeverity>(['critical', 'major', 'minor'])
  const validCategory = new Set<MilestoneFindingCategory>(['coherence', 'security', 'ux', 'compliance'])
  const normalizedFindings: MilestoneFinding[] = []
  for (const f of findings ?? []) {
    if (!validSeverity.has(f.severity)) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Invalid finding severity "${f.severity}".` }) }],
        isError: true,
      }
    }
    if (!validCategory.has(f.category)) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Invalid finding category "${f.category}".` }) }],
        isError: true,
      }
    }
    if (!f.description || !f.evidence) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Each finding requires non-empty description and evidence.' }) }],
        isError: true,
      }
    }
    normalizedFindings.push({
      severity: f.severity,
      category: f.category,
      description: f.description,
      evidence: f.evidence,
      ...(f.remediation ? { remediation: f.remediation } : {}),
    })
  }

  // Tally severities.
  const findingsCount = { critical: 0, major: 0, minor: 0 }
  for (const f of normalizedFindings) findingsCount[f.severity] += 1

  // Apply checklist updates.
  const auditorId = auditorIdArg || 'milestone-auditor'
  const now = auditedAt || new Date().toISOString()

  let checked = 0
  let unchecked = 0
  const skipped: string[] = []

  for (const upd of checklistUpdates ?? []) {
    if (!upd.item_id || !upd.action) {
      skipped.push(upd.item_id ?? '<missing-id>')
      continue
    }
    let foundItem: ChecklistItem | null = null
    let foundCategory: ChecklistCategory | null = null
    for (const cat of state.submission_checklist.categories) {
      const item = cat.items.find((i) => i.id === upd.item_id)
      if (item) {
        foundItem = item
        foundCategory = cat
        break
      }
    }
    if (!foundItem || !foundCategory) {
      skipped.push(upd.item_id)
      continue
    }
    const shouldBeDone = upd.action === 'check'
    foundItem.done = shouldBeDone
    foundItem.completed_at = shouldBeDone ? now : null
    foundItem.completed_by = shouldBeDone ? auditorId : null
    if (shouldBeDone) checked += 1
    else unchecked += 1

    state.agent_log.push({
      id: `log_${Date.now()}_${upd.item_id}_milestone_audit`,
      agent_id: auditorId,
      action: shouldBeDone ? 'checklist_item_completed' : 'checklist_item_unchecked',
      target_type: 'checklist',
      target_id: upd.item_id,
      description:
        `${shouldBeDone ? 'Checked' : 'Unchecked'} via milestone audit (${milestoneId}): ${upd.reason}`,
      timestamp: now,
      tags: ['checklist', 'milestone-audit', shouldBeDone ? 'complete' : 'revert', 'mcp'],
    })
  }

  // Write the MilestoneAudit record onto the milestone.
  const auditRecord: MilestoneAudit = {
    verdict,
    findings: normalizedFindings,
    audited_at: now,
    report_path: reportPath,
    state_doc_path: stateDocPath,
    checklist_items_updated: checked + unchecked,
  }
  milestone.audit = auditRecord

  // Log the audit submission.
  state.agent_log.push({
    id: `log_${Date.now()}_${milestoneId}_submit_milestone_audit`,
    agent_id: auditorId,
    action: 'submit_milestone_audit',
    target_type: 'milestone',
    target_id: milestoneId,
    description:
      `Milestone audit submitted — verdict=${verdict}, findings=${normalizedFindings.length} ` +
      `(critical=${findingsCount.critical}, major=${findingsCount.major}, minor=${findingsCount.minor}), ` +
      `checklist_updates=${checked + unchecked} (skipped=${skipped.length})`,
    timestamp: now,
    tags: ['milestone-audit', 'submit', verdict, 'mcp'],
  })

  touchAgent(state, auditorId)
  writeTracker(state)

  const payload = {
    success: true,
    milestone_id: milestoneId,
    verdict,
    findings_count: findingsCount,
    checklist_items_checked: checked,
    checklist_items_unchecked: unchecked,
    skipped_updates: skipped,
    report_path: reportPath,
    state_doc_path: stateDocPath,
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}
