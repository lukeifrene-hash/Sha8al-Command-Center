#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
OUT_DIR="$ROOT_DIR/out"
ELECTRON_EXE="$ROOT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"

log() {
  printf '%s\n' "$1"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

setup_brew_path() {
  if have_cmd brew; then
    return 0
  fi

  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    return 0
  fi

  if [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
    return 0
  fi

  return 1
}

install_homebrew() {
  log "Installing Homebrew for macOS..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  setup_brew_path
}

install_node_runtime() {
  log "Installing Node.js, npm, and Git for macOS..."

  if ! setup_brew_path; then
    install_homebrew
  fi

  if ! have_cmd brew; then
    log "ERROR: Homebrew is not available after the install attempt."
    log "Install Homebrew manually, then rerun this script."
    exit 1
  fi

  brew install node git
}

ensure_node_and_npm() {
  if have_cmd node && have_cmd npm; then
    log "Node.js and npm are already available."
    return
  fi

  install_node_runtime

  if ! have_cmd node || ! have_cmd npm; then
    log "ERROR: Node.js or npm is still missing after the install attempt."
    exit 1
  fi
}

ensure_project_dependencies() {
  if [[ -f "$ROOT_DIR/node_modules/electron-vite/dist/cli.js" ]] && \
     [[ -f "$ROOT_DIR/node_modules/electron-builder/cli.js" ]] && \
     [[ -x "$ELECTRON_EXE" ]]; then
    log "Project dependencies already available."
    return
  fi

  log "Installing project dependencies..."
  npm install --legacy-peer-deps

  if [[ ! -f "$ROOT_DIR/node_modules/electron-vite/dist/cli.js" ]] || \
     [[ ! -f "$ROOT_DIR/node_modules/electron-builder/cli.js" ]] || \
     [[ ! -x "$ELECTRON_EXE" ]]; then
    log "ERROR: Project dependencies did not install correctly."
    exit 1
  fi
}

clean_outputs() {
  log "[1] Cleaning previous macOS build directories..."
  rm -rf "$RELEASE_DIR" "$OUT_DIR"
  find "$ROOT_DIR" -maxdepth 1 -type d -name 'release-rebuild-*' -exec rm -rf {} +
}

build_app() {
  log "[2] Building app..."
  node "$ROOT_DIR/node_modules/electron-vite/dist/cli.js" build
}

launch_direct() {
  if [[ ! -x "$ELECTRON_EXE" ]]; then
    log "ERROR: Electron runtime was not found at:"
    log "  $ELECTRON_EXE"
    exit 1
  fi

  if [[ ! -f "$OUT_DIR/main/index.js" ]]; then
    log "ERROR: Built app output was not found at:"
    log "  $OUT_DIR/main/index.js"
    exit 1
  fi

  log "Dynamic direct launcher: $ROOT_DIR/Launch_CC_Direct_Mac.sh"
  nohup "$ELECTRON_EXE" "$ROOT_DIR" >/dev/null 2>&1 &
}

find_packaged_mac_app() {
  local candidate

  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done < <(find "$RELEASE_DIR" -maxdepth 3 -type d -name '*.app' 2>/dev/null | sort)

  return 1
}

package_mac() {
  log "[3] Running macOS packager..."
  if node "$ROOT_DIR/node_modules/electron-builder/cli.js" --mac; then
    return 0
  fi

  log "macOS packaging failed. Falling back to direct launch from the built out/ folder..."
  launch_direct
  return 1
}

launch_packaged() {
  local app_target
  if ! app_target="$(find_packaged_mac_app)"; then
    log "No packaged macOS app was found in release output. Falling back to direct launch..."
    launch_direct
    return
  fi

  log "Dynamic packaged launcher: $ROOT_DIR/Launch_CC_Mac.sh"
  open "$app_target"
}

log "============================================"
log "Sha8al Command Center - macOS Build and Run"
log "============================================"
log
log "[0] Ensuring macOS runtime prerequisites are installed..."
ensure_node_and_npm
ensure_project_dependencies
clean_outputs
build_app
if package_mac; then
  launch_packaged
fi
