#!/usr/bin/env node

/**
 * Sha8al Command Center — CLI Interface
 *
 * Provides the same 17 tools as the MCP server but via shell commands.
 * Works with any agent that can execute bash (Codex, GPT, Gemini, etc.)
 * Public alias: sha8al-command-center
 * Compatibility alias: talkstore
 *
 * Usage:
 *   sha8al-command-center <command> [args...]
 *   talkstore <command> [args...]   # compatibility alias
 */

import { readFileSync } from 'fs'
import { basename } from 'path'

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

function resolveCliName() {
  const invoked = basename(process.argv[1] || '').replace(/\.[^.]+$/, '')
  if (invoked === 'talkstore' || invoked === 'sha8al-command-center') return invoked
  return 'sha8al-command-center'
}

function printHelp() {
  const cliName = resolveCliName()

  console.log(`Sha8al Command Center CLI (sha8al-command-center)
Compatibility alias: talkstore

USAGE:
  ${cliName} <command> [args...]
  sha8al-command-center <command> [args...]
  talkstore <command> [args...]   # compatibility alias

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
  reset-task <task_id>                    OPERATOR: reset any task back to todo
  approve-task <task_id> ["feedback"]     OPERATOR: approve reviewed task → done
  reject-task <task_id> "<feedback>"      OPERATOR: reject reviewed task → in_progress with revision feedback
  update-task <task_id> [--priority P1] [--assignee name] [--mode agent] [--notes "text"]
  enrich-task <task_id> [--prompt "text"] [--builder-prompt "path"] [--criteria "a|b|c"]  Enrich task fields
  log-action <task_id> <action> "<desc>" [--tags tag1,tag2]
  add-milestone-note <milestone_id> "<note>"
  set-milestone-dates <milestone_id> [--start YYYY-MM-DD] [--end YYYY-MM-DD]
  update-drift <milestone_id> <drift_days>
  register-agent <agent_id> "<name>" <type> [--permissions read,write] [--color "#hex"] [--parent <agent_id>]
  toggle-checklist-item <item_id> <true|false>  Toggle a submission checklist item

THREE-PHASE WORKFLOW (sweep / prepare / build):
  claim-next-task [--tier small|medium|large|architectural] [--milestone id] [--mode agent|pair|human] [--agent <agent_id>]
      Atomically claim the next eligible todo task (status=todo, deps satisfied).
      Sort: parallel_priority ascending, then id. Sets status=in_progress + assignee.
  compute-waves <milestone_id> [--tier small|...]
      Group a milestone's remaining tasks into parallel execution waves by parallel_priority.
  bulk-prepare <milestone_id> [--tier medium|large|architectural]
      Return non-small tasks still needing prepare-phase enrichment (prepared !== true).
  check-file-collisions <id1> [<id2> ...]
      Inspect prompts of N tasks, return any file referenced by 2+ tasks.

AUDITOR WORKFLOW (auto-approve pipeline):
  request-audit <task_id> [--cross-model true|false] [--auditor <id>]
      Begin an audit on a task in review status. Returns context + 12-point checklist template +
      milestone lane + auto_approve_eligible flag.
  submit-audit <task_id> --results <json_path|@->  --auditor <id> [--summary "<text>"]
      Submit the filled-in checklist. --results accepts a path to a JSON file containing the
      AuditChecklistItem[] array, or "@-" to read the array from stdin. Auto-approves when
      pass=true AND lane is foundation or product_engines.
  get-next-actionable-tasks [--milestone <id>] [--tier small|medium|large|architectural] [--limit <n>]
      Return todo tasks ready to run, sorted by parallel_priority then id. Includes tier histogram.

MILESTONE AUDITOR (post-milestone audit bundle + submission):
  start-milestone-audit <milestone_id>
      Validate that all subtasks are done, then return the full audit-context bundle
      (manifesto excerpts, prior state doc, subtask summaries, exit criteria, linked
      checklist categories, diff-range hint). Errors out if milestone isn't ready.
  get-milestone-audit-context <milestone_id>
      Same bundle as start-milestone-audit, but without readiness validation or state
      mutation. Safe to call any time — useful for re-entry / inspection.
  submit-milestone-audit <milestone_id> --payload <json_path|@-> [--auditor <id>]
      Record the audit outcome. --payload accepts a JSON file (or "@-" for stdin)
      with keys: verdict, findings[], checklist_updates[], report_path, state_doc_path,
      optional audited_at.
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
      toolArgs = { task_id: positional[0], ...(flags.agent && { agent_id: flags.agent }) }
      break

    case 'complete-task':
      toolName = 'complete_task'
      toolArgs = { task_id: positional[0], summary: positional[1], ...(flags.agent && { agent_id: flags.agent }) }
      break

    case 'block-task':
      toolName = 'block_task'
      toolArgs = { task_id: positional[0], reason: positional[1] }
      break

    case 'unblock-task':
      toolName = 'unblock_task'
      toolArgs = { task_id: positional[0], ...(positional[1] && { resolution: positional[1] }) }
      break

    case 'reset-task':
      toolName = 'reset_task'
      toolArgs = { task_id: positional[0] }
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
        ...(flags.agent && { agent_id: flags.agent }),
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
        ...(flags.parent && { parent_id: flags.parent }),
      }
      break

    case 'toggle-checklist-item':
      toolName = 'toggle_checklist_item'
      toolArgs = { item_id: positional[0], done: positional[1] === 'true' }
      break

    // ── Three-phase workflow commands ──
    case 'claim-next-task':
      toolName = 'claim_next_task'
      toolArgs = {
        ...(flags.tier && { tier: flags.tier }),
        ...(flags.milestone && { milestone_id: flags.milestone }),
        ...(flags.mode && { execution_mode: flags.mode }),
        ...(flags.agent && { agent_id: flags.agent }),
      }
      break

    case 'compute-waves':
      toolName = 'compute_waves'
      toolArgs = {
        milestone_id: positional[0],
        ...(flags.tier && { tier: flags.tier }),
      }
      break

    case 'bulk-prepare':
      toolName = 'bulk_prepare'
      toolArgs = {
        milestone_id: positional[0],
        ...(flags.tier && { tier: flags.tier }),
      }
      break

    case 'check-file-collisions':
      toolName = 'check_file_collisions'
      toolArgs = { task_ids: positional }
      break

    // ── Auditor workflow commands ──
    case 'request-audit':
      toolName = 'request_audit'
      toolArgs = {
        task_id: positional[0],
        ...(flags['cross-model'] && { cross_model: flags['cross-model'] === 'true' }),
        ...(flags.auditor && { auditor_id: flags.auditor }),
      }
      break

    case 'submit-audit': {
      toolName = 'submit_audit'
      let results: unknown = []
      const resultsFlag = flags.results
      if (resultsFlag) {
        let raw: string
        if (resultsFlag === '@-') {
          raw = readFileSync(0, 'utf-8')
        } else {
          raw = readFileSync(resultsFlag, 'utf-8')
        }
        try {
          results = JSON.parse(raw)
        } catch (err) {
          console.error(`Failed to parse --results JSON: ${err instanceof Error ? err.message : String(err)}`)
          process.exit(1)
        }
      }
      toolArgs = {
        task_id: positional[0],
        results,
        auditor_id: flags.auditor || 'auditor',
        ...(flags.summary && { auditor_summary: flags.summary }),
      }
      break
    }

    case 'get-next-actionable-tasks':
      toolName = 'get_next_actionable_tasks'
      toolArgs = {
        ...(flags.milestone && { milestone_id: flags.milestone }),
        ...(flags.tier && { tier: flags.tier }),
        ...(flags.limit && { limit: parseInt(flags.limit, 10) }),
      }
      break

    // ── Milestone Auditor commands ──
    case 'start-milestone-audit':
      toolName = 'start_milestone_audit'
      toolArgs = { milestone_id: positional[0] }
      break

    case 'get-milestone-audit-context':
      toolName = 'get_milestone_audit_context'
      toolArgs = { milestone_id: positional[0] }
      break

    case 'submit-milestone-audit': {
      toolName = 'submit_milestone_audit'
      const payloadFlag = flags.payload
      if (!payloadFlag) {
        console.error('submit-milestone-audit requires --payload <json_path|@->')
        process.exit(1)
      }
      let raw: string
      try {
        if (payloadFlag === '@-') {
          raw = readFileSync(0, 'utf-8')
        } else {
          raw = readFileSync(payloadFlag, 'utf-8')
        }
      } catch (err) {
        console.error(`Failed to read --payload: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(raw)
      } catch (err) {
        console.error(`Failed to parse --payload JSON: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
      toolArgs = {
        milestone_id: positional[0],
        verdict: parsed.verdict,
        findings: parsed.findings ?? [],
        checklist_updates: parsed.checklist_updates ?? [],
        report_path: parsed.report_path,
        state_doc_path: parsed.state_doc_path,
        ...(parsed.audited_at ? { audited_at: parsed.audited_at } : {}),
        ...(flags.auditor ? { auditor_id: flags.auditor } : {}),
      }
      break
    }

    default:
      console.error(`Unknown command: ${command}\nRun "sha8al-command-center help" or "talkstore help" for usage.`)
      process.exit(1)
  }

  const { handleTool } = await import('./tools.js')
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
