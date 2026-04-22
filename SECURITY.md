# Security Policy

## Supported Versions

Security fixes are targeted at the latest supported release and the current default branch.
Older releases should be treated as unsupported unless a release note explicitly says otherwise.

## Reporting A Vulnerability

Do not report undisclosed vulnerabilities in a public GitHub issue, discussion, pull request, or commit message.

Preferred private reporting path for the public repository:

1. Use GitHub Private Vulnerability Reporting for this repository, if it is enabled.
2. If that feature is not enabled yet, contact the maintainers through the repository owner's private contact path on the hosting platform.
3. If neither path exists, stop and ask the operators to provision a private reporting channel before handling external vulnerability reports publicly.

When you report a vulnerability, include:

- affected release, commit, or branch
- affected surface, such as Electron app, MCP server, bootstrap scripts, or packaging
- active profile, such as `generic`, `talkstore`, or `aci`
- operating system and runtime details
- a clear reproduction path or proof of concept
- the expected safe behavior and the actual unsafe behavior
- whether the issue depends on TalkStore compatibility wiring
- any known mitigation or rollback option

## Sensitive Areas For This Repository

Please call out issues that involve any of the following:

- project-root discovery and filesystem path resolution
- tracker/checklist/manifesto source resolution
- implicit fallback to sibling TalkStore paths
- tracker write guards and any bypass or override behavior
- Electron preload or IPC boundaries that could expose filesystem access to the renderer
- accidental disclosure of tracker content, absolute paths, local tokens, or operator-only docs

## Disclosure Expectations

Maintainers aim to acknowledge valid reports within 5 business days.
If a report is reproducible, maintainers should communicate next steps, expected remediation scope, and whether coordinated disclosure is required.

Do not publish exploit details until:

- the maintainers confirm the issue
- a fix or mitigation is available for supported versions
- impacted users have had a reasonable chance to apply the fix

## Release Expectations

Security fixes should ship with release notes that state:

- the affected surface and profile
- the fixed version or commit range
- any required operator action
- rollback notes if the fix changes configuration, profile resolution, or tracker-path behavior

If a fix is not yet available, maintainers should publish a temporary mitigation note once disclosure is coordinated and safe.
