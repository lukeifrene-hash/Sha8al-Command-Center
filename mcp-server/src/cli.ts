#!/usr/bin/env node

/**
 * Talkstore Command Center — CLI Interface
 *
 * Provides the same 17 tools as the MCP server but via shell commands.
 * Works with any agent that can execute bash (Codex, GPT, Gemini, etc.)
 *
 * Usage:
 *   talkstore <command> [args...]
 *   talkstore get-task-context <task_id>
 *   talkstore start-task <task_id>
 *   talkstore complete-task <task_id> "<summary>"
 *   talkstore list-tasks [--milestone <id>] [--status <status>] [--domain <domain>]
 *   talkstore get-project-status
 *   talkstore get-milestone-overview <milestone_id>
 *   talkstore get-checklist-status
 *   talkstore get-task-history <task_id>
 *   talkstore update-task <task_id> [--priority P1|P2|P3] [--assignee <name>] [--mode human|agent|pair] [--notes "<text>"]
 *   talkstore block-task <task_id> "<reason>"
 *   talkstore log-action <task_id> <action> "<description>" [--tags tag1,tag2]
 *   talkstore add-milestone-note <milestone_id> "<note>"
 *   talkstore set-milestone-dates <milestone_id> [--start YYYY-MM-DD] [--end YYYY-MM-DD]
 *   talkstore update-drift <milestone_id> <drift_days>
 *   talkstore list-agents
 *   talkstore register-agent <agent_id> "<name>" <type> [--permissions read,write] [--color "#hex"]
 *   talkstore get-activity-feed [--agent <agent_id>] [--limit <n>]
 */

import { handleTool } from './tools.js'

function parseArgs(args: string[]): { command: string; positional: string[]; flags: Record<string, string> } {
  const command = args[0] || 'help'
  const positional: string[] = []
  const flags: Record<string, string> = {}

  let i = 1
  while (i < args.length) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const value = args[i + 1] || ''
      flags[key] = value
      i += 2
    } else {
      positional.push(args[i])
      i++
    }
  }

  return { command, positional, flags }
}

function printHelp() {
  console.log(`Talkstore Command Center CLI

USAGE: talkstore <command> [args...]

READ COMMANDS:
  get-task-context <task_id>              Full context for a task (milestone, deps, conventions)
  get-project-status                      Overall progress, schedule, blocked count
  get-milestone-overview <milestone_id>   Milestone details with all task statuses
  list-tasks [--milestone id] [--status todo|in_progress|done|blocked] [--domain name]
  get-checklist-status                    Submission checklist progress
  get-task-history <task_id>              Agent log entries for a task
  list-agents                             All registered agents with status
  get-activity-feed [--agent id] [--limit n]  Recent activity log

WRITE COMMANDS:
  start-task <task_id>                    Set task to in_progress
  complete-task <task_id> "<summary>"     Submit task for review (not done until approved)
  block-task <task_id> "<reason>"         Mark task blocked with reason
  unblock-task <task_id> ["resolution"]     Unblock a blocked task
  approve-task <task_id> ["feedback"]     OPERATOR: approve reviewed task → done
  reject-task <task_id> "<feedback>"      OPERATOR: reject reviewed task → in_progress with revision feedback
  update-task <task_id> [--priority P1] [--assignee name] [--mode agent] [--notes "text"]
  enrich-task <task_id> [--prompt "text"] [--builder-prompt "path"] [--criteria "a|b|c"]  Enrich task fields
  log-action <task_id> <action> "<desc>" [--tags tag1,tag2]
  add-milestone-note <milestone_id> "<note>"
  set-milestone-dates <milestone_id> [--start YYYY-MM-DD] [--end YYYY-MM-DD]
  update-drift <milestone_id> <drift_days>
  register-agent <agent_id> "<name>" <type> [--permissions read,write] [--color "#hex"]
  toggle-checklist-item <item_id> <true|false>  Toggle a submission checklist item
`)
}

async function run() {
  const rawArgs = process.argv.slice(2)

  if (rawArgs.length === 0 || rawArgs[0] === 'help' || rawArgs[0] === '--help') {
    printHelp()
    process.exit(0)
  }

  const { command, positional, flags } = parseArgs(rawArgs)

  let toolName: string
  let toolArgs: Record<string, unknown>

  switch (command) {
    // ── Read commands ──
    case 'get-task-context':
      toolName = 'get_task_context'
      toolArgs = { task_id: positional[0] }
      break

    case 'get-project-status':
      toolName = 'get_project_status'
      toolArgs = {}
      break

    case 'get-milestone-overview':
      toolName = 'get_milestone_overview'
      toolArgs = { milestone_id: positional[0] }
      break

    case 'list-tasks':
      toolName = 'list_tasks'
      toolArgs = {
        ...(flags.milestone && { milestone_id: flags.milestone }),
        ...(flags.status && { status: flags.status }),
        ...(flags.domain && { domain: flags.domain }),
      }
      break

    case 'get-checklist-status':
      toolName = 'get_checklist_status'
      toolArgs = {}
      break

    case 'get-task-history':
      toolName = 'get_task_history'
      toolArgs = { task_id: positional[0] }
      break

    case 'list-agents':
      toolName = 'list_agents'
      toolArgs = {}
      break

    case 'get-activity-feed':
      toolName = 'get_activity_feed'
      toolArgs = {
        ...(flags.agent && { agent_id: flags.agent }),
        ...(flags.limit && { limit: parseInt(flags.limit, 10) }),
      }
      break

    // ── Write commands ──
    case 'start-task':
      toolName = 'start_task'
      toolArgs = { task_id: positional[0] }
      break

    case 'complete-task':
      toolName = 'complete_task'
      toolArgs = { task_id: positional[0], summary: positional[1] }
      break

    case 'block-task':
      toolName = 'block_task'
      toolArgs = { task_id: positional[0], reason: positional[1] }
      break

    case 'unblock-task':
      toolName = 'unblock_task'
      toolArgs = { task_id: positional[0], ...(positional[1] && { resolution: positional[1] }) }
      break

    case 'approve-task':
      toolName = 'approve_task'
      toolArgs = { task_id: positional[0], ...(positional[1] && { feedback: positional[1] }) }
      break

    case 'reject-task':
      toolName = 'reject_task'
      toolArgs = { task_id: positional[0], feedback: positional[1] }
      break

    case 'update-task':
      toolName = 'update_task'
      toolArgs = {
        task_id: positional[0],
        ...(flags.priority && { priority: flags.priority }),
        ...(flags.assignee && { assignee: flags.assignee }),
        ...(flags.mode && { execution_mode: flags.mode }),
        ...(flags.notes && { notes: flags.notes }),
      }
      break

    case 'enrich-task':
      toolName = 'enrich_task'
      toolArgs = {
        task_id: positional[0],
        ...(flags.prompt && { prompt: flags.prompt }),
        ...(flags['builder-prompt'] && { builder_prompt: flags['builder-prompt'] }),
        ...(flags.criteria && { acceptance_criteria: flags.criteria.split('|') }),
        ...(flags.constraints && { constraints: flags.constraints.split('|') }),
        ...(flags['context-files'] && { context_files: flags['context-files'].split(',') }),
        ...(flags['reference-docs'] && { reference_docs: flags['reference-docs'].split(',') }),
      }
      break

    case 'log-action':
      toolName = 'log_action'
      toolArgs = {
        task_id: positional[0],
        action: positional[1],
        description: positional[2],
        ...(flags.tags && { tags: flags.tags.split(',') }),
      }
      break

    case 'add-milestone-note':
      toolName = 'add_milestone_note'
      toolArgs = { milestone_id: positional[0], note: positional[1] }
      break

    case 'set-milestone-dates':
      toolName = 'set_milestone_dates'
      toolArgs = {
        milestone_id: positional[0],
        ...(flags.start && { actual_start: flags.start }),
        ...(flags.end && { actual_end: flags.end }),
      }
      break

    case 'update-drift':
      toolName = 'update_drift'
      toolArgs = { milestone_id: positional[0], drift_days: parseFloat(positional[1]) }
      break

    case 'register-agent':
      toolName = 'register_agent'
      toolArgs = {
        agent_id: positional[0],
        name: positional[1],
        type: positional[2],
        permissions: flags.permissions ? flags.permissions.split(',') : ['read'],
        ...(flags.color && { color: flags.color }),
      }
      break

    case 'toggle-checklist-item':
      toolName = 'toggle_checklist_item'
      toolArgs = { item_id: positional[0], done: positional[1] === 'true' }
      break

    default:
      console.error(`Unknown command: ${command}\nRun "talkstore help" for usage.`)
      process.exit(1)
  }

  const result = await handleTool(toolName, toolArgs)

  // Print output
  for (const item of result.content) {
    if (item.type === 'text') {
      if (result.isError) {
        console.error(item.text)
      } else {
        console.log(item.text)
      }
    }
  }

  process.exit(result.isError ? 1 : 0)
}

run()
