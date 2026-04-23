# Sha8al Command Center MCP Server

This package contains the MCP server and CLI for Sha8al Command Center (`sha8al-command-center`).

## Current Status

- Public platform name: `sha8al-command-center`
- Compatibility profile: TalkStore
- Compatibility CLI alias: `talkstore`
- Public CLI alias: `sha8al-command-center`
- Package name: `sha8al-command-center-mcp`

## Build

```bash
npm install
npm run build
```

## Quick Launch

From the repo root, you can use one of these helper launchers:

- Windows: [Launch_MCP_Windows.bat](/C:/Users/dell/Desktop/dev/Sha8al-Command-Center/Launch_MCP_Windows.bat)
- Linux: `./Launch_MCP_Linux.sh`
- macOS: `./Launch_MCP_Mac.sh`

Each launcher installs `mcp-server` dependencies if needed, builds `dist/` if missing, and then starts the stdio server in the current terminal.
They also set `COMMAND_CENTER_PROJECT_ROOT` to the repo root and `COMMAND_CENTER_PROFILE=generic` for this project.

Important:
- this is a stdio MCP server, not a desktop window
- keep the terminal open while your MCP client is connected

## CLI

After building, you can inspect the local CLI help with:

```bash
node dist/cli.js help
```

When the package is linked or installed, both of these aliases resolve to the same CLI:

```bash
sha8al-command-center help
talkstore help
```

## Compatibility Notes

- The live TalkStore MCP wiring is intentionally left unchanged in Phase 4.
- The public alias is additive only.
- Removing the `talkstore` alias is a later cutover step, not part of this phase.
