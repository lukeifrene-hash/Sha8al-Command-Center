#!/usr/bin/env bash
set -euo pipefail

SOURCE_PATH="${BASH_SOURCE[0]}"
while [[ -h "$SOURCE_PATH" ]]; do
  SOURCE_DIR="$(cd -P "$(dirname "$SOURCE_PATH")" && pwd)"
  LINK_TARGET="$(readlink "$SOURCE_PATH")"
  if [[ "$LINK_TARGET" != /* ]]; then
    SOURCE_PATH="$SOURCE_DIR/$LINK_TARGET"
  else
    SOURCE_PATH="$LINK_TARGET"
  fi
done

ROOT_DIR="$(cd -P "$(dirname "$SOURCE_PATH")" && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
OUT_DIR="$ROOT_DIR/out"
ELECTRON_EXE="$ROOT_DIR/node_modules/electron/dist/electron"
LOCAL_BIN_DIR="$HOME/.local/bin"
COMMAND_LINK="$LOCAL_BIN_DIR/command_center"

log() {
  printf '%s\n' "$1"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_as_root() {
  if have_cmd sudo; then
    sudo "$@"
  else
    "$@"
  fi
}

ensure_line_in_file() {
  local file_path="$1"
  local line_text="$2"

  mkdir -p "$(dirname "$file_path")"
  touch "$file_path"

  if ! grep -Fqx "$line_text" "$file_path" 2>/dev/null; then
    printf '\n%s\n' "$line_text" >>"$file_path"
  fi
}

install_node_runtime() {
  log "Installing Node.js and npm for Linux..."

  if have_cmd apt-get; then
    run_as_root apt-get update
    run_as_root apt-get install -y nodejs npm git
    return
  fi

  if have_cmd dnf; then
    run_as_root dnf install -y nodejs npm git
    return
  fi

  if have_cmd yum; then
    run_as_root yum install -y nodejs npm git
    return
  fi

  if have_cmd pacman; then
    run_as_root pacman -Sy --noconfirm nodejs npm git
    return
  fi

  if have_cmd zypper; then
    run_as_root zypper --non-interactive install nodejs npm git
    return
  fi

  log "ERROR: No supported Linux package manager was found."
  log "Install Node.js first, then rerun ./install.sh."
  exit 1
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
  log "[1] Cleaning previous Linux build directories..."
  rm -rf "$RELEASE_DIR" "$OUT_DIR"
  find "$ROOT_DIR" -maxdepth 1 -type d -name 'release-rebuild-*' -exec rm -rf {} +
}

build_app() {
  log "[2] Building app..."
  node "$ROOT_DIR/node_modules/electron-vite/dist/cli.js" build

  if [[ ! -f "$OUT_DIR/main/index.js" ]]; then
    log "ERROR: Built app output was not found at:"
    log "  $OUT_DIR/main/index.js"
    exit 1
  fi
}

package_linux() {
  log "[3] Running Linux packager..."
  if node "$ROOT_DIR/node_modules/electron-builder/cli.js" --linux; then
    log "Linux packaging completed."
    return 0
  fi

  log "Linux packaging failed. The terminal command will use the direct Electron launch fallback."
  return 1
}

install_command_launcher() {
  log "[4] Installing the command_center terminal launcher..."
  mkdir -p "$LOCAL_BIN_DIR"
  chmod +x "$ROOT_DIR/command_center"
  ln -sfn "$ROOT_DIR/command_center" "$COMMAND_LINK"

  if [[ ":$PATH:" != *":$LOCAL_BIN_DIR:"* ]]; then
    local path_export='export PATH="$HOME/.local/bin:$PATH"'
    ensure_line_in_file "$HOME/.profile" "$path_export"
    ensure_line_in_file "$HOME/.bashrc" "$path_export"
    if [[ -f "$HOME/.zshrc" || "${SHELL:-}" == *"zsh" ]]; then
      ensure_line_in_file "$HOME/.zshrc" "$path_export"
    fi
    log "Added $LOCAL_BIN_DIR to your shell startup files."
    log "Open a new terminal or run: export PATH=\"$HOME/.local/bin:\$PATH\""
  fi
}

launch_installed_command() {
  log "[5] Launching Sha8al Command Center..."
  "$ROOT_DIR/command_center"
}

log "==========================================="
log "Sha8al Command Center - Linux Install"
log "==========================================="
log
log "[0] Ensuring Linux runtime prerequisites are installed..."
ensure_node_and_npm
ensure_project_dependencies
clean_outputs
build_app
package_linux || true
install_command_launcher
launch_installed_command
log
log "Install complete."
log "You can now run the app later with:"
log "  command_center"
