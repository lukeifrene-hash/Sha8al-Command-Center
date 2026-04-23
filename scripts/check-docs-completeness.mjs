#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { REPO_ROOT } from './check-support.mjs'

const issues = []

function requireFile(relativePath, label = relativePath) {
  const absolutePath = join(REPO_ROOT, relativePath)
  if (!existsSync(absolutePath)) {
    issues.push(`missing ${label}: ${relativePath}`)
    return null
  }
  return absolutePath
}

function requireIncludes(relativePath, snippets) {
  const absolutePath = requireFile(relativePath)
  if (!absolutePath) return

  const content = readFileSync(absolutePath, 'utf8')
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      issues.push(`${relativePath} is missing required text: ${snippet}`)
    }
  }
}

function main() {
  const requiredDocs = [
    'README.md',
    '.env.example',
    'SUPPORT.md',
    'docs/public-boundary.md',
    'docs/public-naming.md',
    'docs/profile-system-design.md',
    'docs/task-workflow.md',
    'docs/three-phase-workflow.md',
    'docs/troubleshooting.md',
    'docs/architecture-overview.md',
    'playbooks/command-center/README.md',
    'maintainers/current/validation-matrix.md',
    'maintainers/current/oss-packaging-checklist.md',
    'maintainers/current/external-example-plan.md',
    'maintainers/current/cutover-checklist.md',
    'maintainers/current/naming-transition-plan.md',
    'examples/README.md',
    'examples/minimal-command-center-project/README.md',
  ]

  for (const relativePath of requiredDocs) {
    requireFile(relativePath)
  }

  requireIncludes('README.md', [
    'Sha8al Command Center',
    'sha8al-command-center',
    'TalkStore is a compatibility profile',
    'docs/roadmap.md',
    'npm run bootstrap -- --project',
    'examples/minimal-command-center-project',
    'tracker:parse:project-tasks:dry-run',
    'COMMAND_CENTER_ALLOW_TRACKER_WRITES',
    'prepare M<N> all',
  ])

  requireIncludes('.env.example', [
    'sha8al-command-center',
    'COMMAND_CENTER_PROFILE=generic',
    'COMMAND_CENTER_PROJECT_ROOT=/path/to/project',
    'tracker:parse:project-tasks:dry-run',
    'COMMAND_CENTER_ALLOW_TRACKER_WRITES=true',
  ])

  requireIncludes('SUPPORT.md', [
    'tracker:guard:status',
    'check:publish-readiness',
    'SECURITY.md',
  ])

  requireIncludes('maintainers/current/validation-matrix.md', [
    '## 3. Profile Resolution Correctness',
    '## 5. Parser / Profile Mismatch Failure Behavior',
    '## 6. Tracker Backup Behavior',
    '## 8. Publish-Readiness Verification',
  ])

  requireIncludes('maintainers/current/oss-packaging-checklist.md', [
    '## LICENSE',
    '## CONTRIBUTING.md',
    '## CODE_OF_CONDUCT.md',
    '## SECURITY.md',
    '## Minimum OSS Release Gate',
  ])

  requireIncludes('maintainers/current/external-example-plan.md', [
    'examples/minimal-command-center-project',
    'COMMAND_CENTER_PROFILE=generic',
    'write the tracker',
  ])

  requireIncludes('examples/minimal-command-center-project/README.md', [
    'Sha8al Command Center',
    'sha8al-command-center',
    'tracker:parse:project-tasks:dry-run',
    'TalkStore remains the compatibility profile',
    'should not require `TALKSTORE_PROJECT_ROOT`',
  ])

  if (issues.length > 0) {
    console.error('docs completeness check failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log('docs completeness checks passed')
}

main()
