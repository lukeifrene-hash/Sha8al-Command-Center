# 📦 Multi-Platform Packaging & Docker Guide

This document defines the process for building and distributing the native Desktop applications and the Headless Docker CLI for AI integration.

## 1. Native Desktop Installers (Electron)

We use `electron-builder` to automatically generate install setups and single "portable" executables for multiple operating systems from the source code.

> **Pre-requisite:** Before building installers, you must compile the application.
> ```bash
> npm run build
> ```

### Building for Windows
To generate the `.exe` Setup installer and a portable (no-install) `.exe` featuring our custom Command Center icon:
```bash
npm run dist:win
```
*Outputs will be created in the newly generated `release/` folder.*

On Windows PowerShell, `npm run dist:win` can fail before packaging starts if the local execution policy blocks `npm.ps1`. In that case, use:

```powershell
npm.cmd run dist:win
```

For repeat local package-and-launch cycles on Windows, prefer the repo helper:

```bat
build-and-run.bat
```

That helper closes any running unpacked app instance before rebuilding, which avoids the common `release\win-unpacked\resources\app.asar` lock failure that can happen when you rebuild immediately after launching the packaged app.

### Building for macOS
To generate the universal `.dmg` disk image and `.zip` for macOS:
```bash
npm run dist:mac
```
*(Note: To properly build a `.dmg` you usually need to run this command from a Mac device due to Apple's SDK restrictions).*

### Building for Linux
To generate a portable `.AppImage` and a `.deb` package:
```bash
npm run dist:linux
```

## 2. Headless MCP Server / CLI (Docker)

If you are automating the application or setting up an external AI agent to monitor and orchestrate the timeline automatically (without human visual GUI interaction), we provide a dedicated headless Docker container.

This completely bypasses the Electron frontend and launches directly into the `mcp-server/dist/cli.js` tooling environment.

### Building the image locally
```bash
docker build -t sha8al-cmd-center:latest .
```

### Running an AI Agent Task
You must map your target project directory (wherever your `.command-center-tracker.json` file lives) into the `/workspace` folder inside the container.

```bash
docker run --rm \
  -v "C:/Path/To/Your/Local/Project:/workspace" \
  sha8al-cmd-center:latest \
  --project /workspace \
  talkstore sweep M1 small
```
*The command center will automatically point its `COMMAND_CENTER_PROJECT_ROOT` to the mounted volume and execute the timeline command.*
