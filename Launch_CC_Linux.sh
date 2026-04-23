#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_TARGET=""

while IFS= read -r candidate; do
  [[ -n "$candidate" ]] || continue
  chmod +x "$candidate" 2>/dev/null || true
  APP_TARGET="$candidate"
  break
done < <(find "$ROOT_DIR/release" -maxdepth 2 \( -name '*.AppImage' -o -path '*/linux-unpacked/*' -o -name 'sha8al-command-center' -o -name 'Sha8al Command Center' \) -type f 2>/dev/null | sort)

if [[ -z "$APP_TARGET" ]]; then
  while IFS= read -r dir; do
    while IFS= read -r candidate; do
      [[ -n "$candidate" ]] || continue
      chmod +x "$candidate" 2>/dev/null || true
      APP_TARGET="$candidate"
      break 2
    done < <(find "$dir" -maxdepth 2 \( -name '*.AppImage' -o -path '*/linux-unpacked/*' -o -name 'sha8al-command-center' -o -name 'Sha8al Command Center' \) -type f 2>/dev/null | sort)
  done < <(find "$ROOT_DIR" -maxdepth 1 -type d -name 'release-rebuild-*' | sort -r)
fi

if [[ -z "$APP_TARGET" ]]; then
  printf '%s\n' "ERROR: No packaged Linux app executable was found under release output folders."
  exit 1
fi

nohup "$APP_TARGET" >/dev/null 2>&1 &
