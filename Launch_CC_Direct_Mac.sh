#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_EXE="$ROOT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"

if [[ ! -x "$ELECTRON_EXE" ]]; then
  printf '%s\n' "ERROR: Electron runtime was not found at $ELECTRON_EXE."
  exit 1
fi

if [[ ! -f "$ROOT_DIR/out/main/index.js" ]]; then
  printf '%s\n' "ERROR: Built app output was not found. Run ./Build_Run_Mac.sh first."
  exit 1
fi

nohup "$ELECTRON_EXE" "$ROOT_DIR" >/dev/null 2>&1 &
