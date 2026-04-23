#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$ROOT_DIR/mcp-server"
DIST_FILE="$MCP_DIR/dist/index.js"
export COMMAND_CENTER_PROJECT_ROOT="$ROOT_DIR"
export COMMAND_CENTER_PROFILE="generic"

log() {
  printf '%s\n' "$1"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

log "=========================================="
log "Sha8al Command Center - MCP Server Launch"
log "=========================================="
log

if ! have_cmd node; then
  log "ERROR: Node.js was not found in PATH."
  log "Install Node.js first, then rerun ./Launch_MCP_Linux.sh."
  exit 1
fi

if [[ ! -d "$MCP_DIR/node_modules" ]]; then
  log "Installing MCP server dependencies..."
  (
    cd "$MCP_DIR"
    npm install
  )
fi

if [[ ! -f "$DIST_FILE" ]]; then
  log "Building MCP server..."
  (
    cd "$MCP_DIR"
    npm run build
  )
fi

log "Starting MCP server on stdio..."
log "Keep this terminal open while your MCP client is connected."
log "Using project root: $COMMAND_CENTER_PROJECT_ROOT"
log
cd "$MCP_DIR"
node "$DIST_FILE"
