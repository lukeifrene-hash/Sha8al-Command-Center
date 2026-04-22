# Sha8al Command Center OSS Packaging Checklist

This checklist defines the public OSS packaging requirements for Sha8al Command Center (`sha8al-command-center`).

It is implementation-ready planning only.
Nothing in this document should trigger packaging changes by itself.

## Current Gap Snapshot

As of Phase 2 planning:
- there is no visible `.github/` metadata layer in the repo
- there is now a minimal `examples/minimal-command-center-project/` scaffold, but it still needs to stay aligned with the public onboarding docs
- the current README is platform-shifted but not yet a full OSS onboarding document
- TalkStore compatibility still appears in package metadata and CLI naming

## README Requirements

The public README must include:
- platform identity first: `sha8al-command-center`
- one-sentence description of what the platform is
- explicit statement that TalkStore is a compatibility profile
- install steps for app and MCP package
- bootstrap steps for a fresh external project
- profile selection explanation
- supported tracker/doc defaults
- compatibility section for TalkStore users
- troubleshooting links
- architecture doc links

## LICENSE

Required:
- add a root `LICENSE`
- ensure package metadata matches the license text
- document any future relicense as an explicit operator decision

Current implementation note:
- Phase 4 aligns the repository to the existing `ISC` package metadata.
- If the project changes licenses later, that is a separate cutover task.

## CONTRIBUTING.md

Required sections:
- local setup
- repo structure
- how to run app and MCP builds
- how to test profile-resolution changes safely
- docs standards
- compatibility rules for TalkStore

## CODE_OF_CONDUCT.md

Required:
- add a standard OSS code-of-conduct document
- link it from README and contributing docs

## SECURITY.md

Required sections:
- how to report vulnerabilities
- what counts as sensitive tracker/path handling
- release and disclosure expectations
- whether private security contact exists

## Issue Templates

Required templates:
- bug report
- feature request
- profile compatibility bug
- documentation issue

Recommended file targets:
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/profile_compatibility_bug.md`
- `.github/ISSUE_TEMPLATE/documentation_issue.md`

Required fields:
- platform version
- target profile
- OS/runtime environment
- expected vs actual behavior
- whether TalkStore compatibility is involved

## PR Template

Required fields:
- change summary
- affected surfaces: runtime, MCP, scripts, docs, packaging
- profiles affected
- migration impact
- validation performed
- rollback considerations

Recommended file target:
- `.github/pull_request_template.md`

## Release Notes Structure

Each release should include:
- headline summary
- breaking changes
- compatibility changes
- new public install or packaging changes
- TalkStore-specific notes
- rollback notes if applicable

Recommended authoring location:
- `docs/releases/<version>.md`

## Example Project Requirements

The public repo should ship one minimal external example project.

Required properties:
- no dependency on the live TalkStore repo
- demonstrates bootstrap, parser, tracker, and dashboard workflow
- small enough to understand quickly
- documented in a dedicated example plan
- checked in under `examples/minimal-command-center-project/`

See [External Example Plan](external-example-plan.md).

## Installation And Bootstrap Docs

Required docs:
- clean clone install
- root app build
- MCP build
- fresh external project bootstrap
- profile selection guide
- compatibility bootstrap for TalkStore users

## Troubleshooting Docs

Required troubleshooting coverage:
- profile resolution mismatch
- tracker file not found
- missing tasks/checklist/manifesto docs
- parser/profile mismatch failure
- backup behavior expectations
- TalkStore compatibility path confusion

## Architecture Docs

Required docs:
- platform boundary
- profile system design
- naming transition plan
- validation matrix
- external example plan
- runtime/MCP/config resolution overview

## Packaging Safety Requirements

- publish flows must not require a sibling TalkStore checkout
- publish flows must not write to a live TalkStore tracker
- install docs must not instruct users to modify TalkStore wiring for a generic install
- compatibility aliases must be clearly labeled and bounded

## Minimum OSS Release Gate

Before public release execution:
- README is public-install-ready
- LICENSE exists
- CONTRIBUTING exists
- CODE_OF_CONDUCT exists
- SECURITY exists
- issue templates exist
- PR template exists
- example project exists
- installation, troubleshooting, and architecture docs exist
- release notes template exists
