#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { cpSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { REPO_ROOT, assert, readJson, runNode, tempDir } from './check-support.mjs'

function parseEnvText(content) {
  const values = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(trimmed)
    if (!match) continue
    values[match[1]] = match[2]
  }

  return values
}

function main() {
  const workspace = tempDir()
  const exampleRoot = join(REPO_ROOT, 'examples/minimal-command-center-project')
  const envPath = join(workspace, 'bootstrap.env')

  const bootstrapResult = runNode(
    [
      'scripts/bootstrap.mjs',
      '--output-env-file',
      envPath,
      '--project',
      exampleRoot,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROFILE: 'generic',
      },
      expectStatus: 0,
      label: 'bootstrap example project',
    }
  )
  assert((bootstrapResult.stdout || '').includes('Detected roadmap source:'), 'bootstrap should announce the detected roadmap source')
  assert((bootstrapResult.stdout || '').includes('feeds the swim lane and task board'), 'bootstrap should explain why roadmap.md is required for the public flow')

  assert(existsSync(envPath), 'bootstrap should create the requested env file')
  const envText = readFileSync(envPath, 'utf8')
  assert(envText.includes('COMMAND_CENTER_PROFILE=generic'), 'bootstrap should write the explicit generic consumer profile')
  assert(envText.includes(`COMMAND_CENTER_PROJECT_ROOT=${exampleRoot}`), 'bootstrap should write the example project root')
  assert(envText.includes('COMMAND_CENTER_TRACKER_FILE=command-center-tracker.json'), 'bootstrap should write the explicit tracker filename')
  assert(envText.includes('COMMAND_CENTER_TASKS_DOC=docs/roadmap.md'), 'bootstrap should write the roadmap doc path')
  assert(envText.includes('COMMAND_CENTER_MANIFESTO_DOC=docs/manifesto.md'), 'bootstrap should write the manifesto doc path')
  assert(!envText.includes('TALKSTORE_PROJECT_ROOT='), 'bootstrap should not require TalkStore-specific env on the external example path')

  const bootstrapEnv = parseEnvText(envText)
  const guardResult = runNode(
    ['scripts/tracker-guard-status.mjs'],
    {
      cwd: REPO_ROOT,
      env: bootstrapEnv,
      expectStatus: 0,
      label: 'external example tracker guard status',
    }
  )

  const guardOutput = guardResult.stdout || ''
  assert(guardOutput.includes('Consumer profile: generic'), 'guard status should resolve the generic profile from the bootstrap output')
  assert(guardOutput.includes(`Project root: ${exampleRoot}`), 'guard status should resolve the example root from the bootstrap output')
  assert(guardOutput.includes(`Tracker path: ${join(exampleRoot, 'command-center-tracker.json')}`), 'guard status should resolve the example tracker path')
  assert(guardOutput.includes('Script writes allowed: true'), 'guard status should allow writes for the external example target')

  const parseResult = spawnSync('npm', ['run', 'tracker:parse:project-tasks:dry-run'], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...bootstrapEnv },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })

  if ((parseResult.status ?? 0) !== 0) {
    throw new Error(
      'external example parser dry-run exited with ' +
      `${parseResult.status}\nstdout:\n${parseResult.stdout || '(empty)'}\n\nstderr:\n${parseResult.stderr || '(empty)'}`
    )
  }

  assert((parseResult.stdout || '').includes('[dry-run] NOT writing tracker'), 'parser dry-run should not write the tracker')
  assert((parseResult.stdout || '').includes('Parser/source pairing: generic-markdown:generic'), 'public parser alias should resolve the generic markdown parser identity')
  assert((parseResult.stdout || '').includes(`Output: ${join(exampleRoot, 'command-center-tracker.json')}`), 'parser dry-run should resolve the external tracker path')

  const copiedExampleRoot = join(workspace, 'copied-example')
  cpSync(exampleRoot, copiedExampleRoot, { recursive: true })

  const copiedEnvPath = join(workspace, 'copied-bootstrap.env')
  runNode(
    [
      'scripts/bootstrap.mjs',
      '--output-env-file',
      copiedEnvPath,
      '--project',
      copiedExampleRoot,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROFILE: 'generic',
      },
      expectStatus: 0,
      label: 'bootstrap copied example project',
    }
  )

  const copiedBootstrapEnv = parseEnvText(readFileSync(copiedEnvPath, 'utf8'))
  runNode(
    ['scripts/parse-markdown.mjs', '--consumer-profile=generic', '--profile=generic', '--tasks-source=docs/roadmap.md'],
    {
      cwd: REPO_ROOT,
      env: copiedBootstrapEnv,
      expectStatus: 0,
      label: 'write tracker for copied example project',
    }
  )

  const writtenTrackerPath = join(copiedExampleRoot, 'command-center-tracker.json')
  const writtenTracker = readJson(writtenTrackerPath)
  const complexities = new Set()
  for (const milestone of writtenTracker.milestones || []) {
    for (const task of milestone.subtasks || []) {
      complexities.add(task.complexity)
    }
  }

  assert(complexities.size > 0, 'written external example tracker should include task complexity values')
  assert(!complexities.has(undefined), 'written external example tracker should classify every task by complexity')

  console.log('external example bootstrap checks passed')
  console.log(`workspace: ${workspace}`)
  console.log(`example: ${exampleRoot}`)
}

main()
