#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { REPO_ROOT } from './check-support.mjs'

const checks = [
  { label: 'Docs completeness', script: 'scripts/check-docs-completeness.mjs' },
  { label: 'Example readiness', script: 'scripts/check-example-readiness.mjs' },
  { label: 'Public identity', script: 'scripts/check-public-identity.mjs' },
  { label: 'Profile resolution', script: 'scripts/check-profile-resolution.mjs' },
  { label: 'Parser/profile mismatch', script: 'scripts/check-parser-profile-mismatch.mjs' },
  { label: 'Backup behavior', script: 'scripts/check-backup-behavior.mjs' },
  { label: 'Bootstrap path', script: 'scripts/check-external-example-bootstrap.mjs' },
  { label: 'Bootstrap scaffold', script: 'scripts/check-bootstrap-scaffold.mjs' },
  { label: 'Public repo readiness', script: 'scripts/check-public-repo-readiness.mjs' },
]

const failures = []

function formatOutput(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return '  (no output)'
  return trimmed
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')
}

for (const check of checks) {
  const result = spawnSync(process.execPath, [check.script], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })

  if ((result.status ?? 0) === 0) {
    console.log(`[pass] ${check.label}`)
    continue
  }

  failures.push({
    label: check.label,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  })
  console.log(`[fail] ${check.label}`)
}

if (failures.length > 0) {
  console.error('')
  console.error('publish readiness checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.label}`)
    console.error(formatOutput(failure.output))
  }
  process.exit(1)
}

console.log('')
console.log('publish readiness checks passed')
