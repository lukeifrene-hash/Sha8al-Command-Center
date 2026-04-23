#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { assert, readJson, runNode, tempDir } from './check-support.mjs'
import { REPO_ROOT } from './check-support.mjs'

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
  const emptyProjectRoot = join(workspace, 'empty-project')
  const envPath = join(workspace, 'bootstrap.env')

  const bootstrapResult = runNode(
    [
      'scripts/bootstrap.mjs',
      '--output-env-file',
      envPath,
      '--project',
      emptyProjectRoot,
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROFILE: 'generic',
      },
      expectStatus: 0,
      label: 'bootstrap empty project scaffold',
    }
  )

  const bootstrapOutput = bootstrapResult.stdout || ''
  assert(bootstrapOutput.includes('Scaffolded starter docs for the public generic flow:'), 'bootstrap should scaffold starter docs for an empty project')
  assert(existsSync(join(emptyProjectRoot, 'docs/roadmap.md')), 'bootstrap should create docs/roadmap.md')
  assert(existsSync(join(emptyProjectRoot, 'docs/manifesto.md')), 'bootstrap should create docs/manifesto.md')

  const envText = readFileSync(envPath, 'utf8')
  const bootstrapEnv = parseEnvText(envText)
  assert(envText.includes('COMMAND_CENTER_TASKS_DOC=docs/roadmap.md'), 'bootstrap should point the public task source at docs/roadmap.md')
  assert(!envText.includes('COMMAND_CENTER_CHECKLIST_DOC='), 'bootstrap should not require a checklist doc for the public generic path')

  runNode(
    ['scripts/tracker-guard-status.mjs'],
    {
      cwd: REPO_ROOT,
      env: bootstrapEnv,
      expectStatus: 0,
      label: 'guard status on scaffolded empty project',
    }
  )

  const dryRun = runNode(
    ['scripts/parse-markdown.mjs', '--consumer-profile=generic', '--profile=generic', '--tasks-source=docs/roadmap.md', '--dry-run'],
    {
      cwd: REPO_ROOT,
      env: bootstrapEnv,
      expectStatus: 0,
      label: 'parser dry-run on scaffolded empty project',
    }
  )
  assert((dryRun.stdout || '').includes('[dry-run] NOT writing tracker'), 'scaffolded empty project should support parser dry-run')

  runNode(
    ['scripts/parse-markdown.mjs', '--consumer-profile=generic', '--profile=generic', '--tasks-source=docs/roadmap.md'],
    {
      cwd: REPO_ROOT,
      env: bootstrapEnv,
      expectStatus: 0,
      label: 'write tracker on scaffolded empty project',
    }
  )

  const trackerPath = join(emptyProjectRoot, 'command-center-tracker.json')
  assert(existsSync(trackerPath), 'parser should write the tracker for the scaffolded empty project')
  const tracker = readJson(trackerPath)
  assert((tracker.milestones || []).length > 0, 'scaffolded empty project tracker should include milestones')

  const complexities = new Set()
  for (const milestone of tracker.milestones || []) {
    for (const task of milestone.subtasks || []) {
      complexities.add(task.complexity)
    }
  }

  assert(complexities.size > 0, 'scaffolded empty project tracker should classify task complexity')
  assert(!complexities.has(undefined), 'every scaffolded task should have a complexity value')

  console.log('bootstrap scaffold checks passed')
  console.log(`workspace: ${workspace}`)
}

main()
