#!/usr/bin/env node

/**
 * Sha8al Command Center — MCP Server
 *
 * Provides live project context and tracker updates to any Claude Code session.
 * Runs as a stdio MCP server that Claude Code spawns automatically.
 *
 * Tools:
 *   get_task_context   — Full context for a task (milestone, deps, conventions, manifesto)
 *   get_project_status — Overall progress, schedule, blocked count
 *   get_milestone_overview — Milestone details with all task statuses
 *   list_tasks         — List tasks with optional filters
 *   get_checklist_status — Submission checklist progress
 *   start_task         — Set task to in_progress
 *   complete_task      — Set task to done with summary
 *   block_task         — Set task as blocked with reason
 *   log_action         — Log an event to the audit trail
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { TOOL_DEFINITIONS, handleTool } from './tools.js'

const server = new Server(
  {
    name: 'talkstore-command-center',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}))

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  return handleTool(name, (args || {}) as Record<string, unknown>)
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Sha8al Command Center MCP server running on stdio')
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err)
  process.exit(1)
})
