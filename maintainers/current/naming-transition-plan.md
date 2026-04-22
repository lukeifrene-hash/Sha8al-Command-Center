# Sha8al Command Center Naming Transition Plan

This document defines the remaining naming cleanup from the legacy TalkStore Command Center identity to Sha8al Command Center (`sha8al-command-center`).

This remains implementation-ready planning for the remaining compatibility-sensitive cutover work.

## Goal

Move the public identity of the repo to:
- platform name: `sha8al-command-center`

While preserving:
- TalkStore as a compatibility profile
- existing TalkStore runtime wiring during the compatibility window
- existing TalkStore CLI alias during the compatibility window

## Naming Layers

The transition must separate these naming layers:

`platform identity`
- the public product and repo identity

`consumer profile identity`
- project-specific compatibility naming such as TalkStore

`runtime/package identity`
- package names, binary names, app names, and descriptions

The current problem is that these layers are still collapsed together under TalkStore naming.

## Target End State

Public identity:
- repo-facing name: `sha8al-command-center`
- root package name: `sha8al-command-center`
- MCP package name: `sha8al-command-center-mcp`
- primary public CLI name: `sha8al-command-center`

Compatibility identity:
- TalkStore remains a documented compatibility profile
- `talkstore` remains a compatibility CLI alias during the transition window

## Repo Naming Strategy

### Before cutover day

- docs lead with `sha8al-command-center`
- package metadata can safely use the public names before filesystem or runtime wiring changes
- TalkStore wording is labeled as compatibility language only

### On cutover day

- rename repository-facing references if required by release strategy
- update package metadata and repository links together
- publish compatibility notes in the same release

## Package Naming Strategy

### Root app package

Current:
- `sha8al-command-center`

Target:
- `sha8al-command-center`

Transition rule:
- package-id cutover is safe once public docs, examples, and validation are in place
- keep the root app package `private` until the desktop distribution story is ready

### MCP package

Current:
- `sha8al-command-center-mcp`

Target:
- `sha8al-command-center-mcp`

Transition rule:
- package-id cutover is safe while the `talkstore` CLI alias remains in place
- keep the live TalkStore `.mcp.json` launch path unchanged during the compatibility window

## CLI Naming Strategy

### Primary public CLI

Target:
- `sha8al-command-center`

Purpose:
- public OSS install path
- generic external project setup
- platform-facing documentation

### Compatibility CLI alias

Keep:
- `talkstore`

Rules:
- remains available during the compatibility window
- documented as a compatibility alias
- must not be removed until public CLI adoption and rollback guidance are ready

## Compatibility Window Policy

During the compatibility window:
- public docs lead with `sha8al-command-center`
- package metadata may already use the public names
- `talkstore` remains an alias, not the primary identity
- TalkStore runtime wiring remains unchanged

The compatibility window ends only when:
- public package names are live
- public CLI is live
- fresh external install validation passes
- TalkStore compatibility has an explicit rollback path

## Rename Order

### Stage 1: documentation-first

Safe, additive, no cutover:
- public docs lead with `sha8al-command-center`
- TalkStore wording is relabeled as compatibility only
- new naming plan is published

### Stage 2: additive public aliases

Safe, additive, before cutover:
- add public CLI alias
- add public package descriptions and docs
- preserve old package and CLI names

### Stage 3: cutover-ready package metadata

Requires coordinated implementation:
- rename package names
- update package descriptions
- update release docs and install instructions
- keep compatibility aliases active

### Stage 4: post-cutover cleanup

Only after the compatibility window:
- retire legacy naming from primary docs
- optionally remove deprecated aliases on a later schedule

## What Must Not Be Renamed Yet

Until cutover day:
- root `package.json` `name`
- `mcp-server/package.json` `name`
- `mcp-server/package.json` `bin.talkstore`
- runtime-facing TalkStore compatibility wiring
- live TalkStore `.mcp.json` expectations

## Required Release Notes For Cutover

The eventual cutover release must explain:
- new public names
- unchanged TalkStore compatibility path
- alias support window
- how to keep existing TalkStore setups working
- when deprecations are expected to be enforced

## Required Phase 3 Decisions

Phase 3 must settle:
- whether the public CLI name and package rename land in the same release
- whether both binaries are shipped from one MCP package or two
- whether filesystem repo rename is required for OSS publication or can lag package renames
- how long the `talkstore` alias remains supported
