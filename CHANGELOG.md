# Changelog

This repository is still in the public-transition window.

Release-ready notes live under [docs/releases](docs/releases/README.md). Use:
- `docs/releases/_template.md` for new release notes
- `docs/releases/YYYY-MM-DD-topic.md` for pre-release transition notes
- `docs/releases/vX.Y.Z.md` for tagged releases

Until a formal release cadence is active, treat this file as the stable index for release-note location rather than a line-by-line historical ledger.

---

### Recent Updates

- **2026-04-23**: Windows setup and launch flow refresh
  - Added Windows-first build and launch BAT files.
  - Added dynamic packaged and direct Windows launchers in the project root.
  - Fixed the build flow to rebuild `out/` before packaging.
  - Added quick install and quick launch sections in the README for Windows, Linux, and macOS.
  - Added Linux and macOS helper scripts for full build-and-run and packaged/direct launch flows.
  - Added `install.sh` as the one-command Linux setup entrypoint.
  - Added the `command_center` terminal launcher for Linux after install.
  - Updated the README Linux instructions to use `./install.sh` and `command_center`.
  - Added quick-launch helper scripts for starting the MCP server on Windows, Linux, and macOS.
  - Expanded the quickstart walkthrough with full Codex and Claude Code MCP binding steps and live Electron dashboard usage.

- **2026-04-23**: [Project Switcher & Security Updates](docs/releases/2026-04-23-project-switcher-and-security.md)
  - Patched major `npm` vulnerabilities (Vite, Picomatch).
  - Restored stable `npm install --legacy-peer-deps` functionality.
  - Fixed startup crash loops on unconfigured project roots.
  - Added new "Project Menu" dropdown to the UI (Change Project Folder, Import Roadmap).
