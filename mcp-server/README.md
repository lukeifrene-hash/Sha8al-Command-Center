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
