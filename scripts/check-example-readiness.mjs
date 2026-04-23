#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { REPO_ROOT } from './check-support.mjs'

const issues = []
const EXAMPLE_ROOT = join(REPO_ROOT, 'examples', 'minimal-command-center-project')

function requireFile(relativePath) {
  const absolutePath = join(EXAMPLE_ROOT, relativePath)
  if (!existsSync(absolutePath)) {
    issues.push(`missing example file: examples/minimal-command-center-project/${relativePath}`)
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
      issues.push(`examples/minimal-command-center-project/${relativePath} is missing required text: ${snippet}`)
    }
  }
}

function main() {
  if (!existsSync(EXAMPLE_ROOT)) {
    console.error(`example root not found: ${EXAMPLE_ROOT}`)
    process.exit(1)
  }

  requireFile('README.md')
  requireFile('docs/roadmap.md')
  requireFile('docs/submission-checklist.md')
  requireFile('docs/manifesto.md')

  requireIncludes('README.md', [
    'Sha8al Command Center',
    'sha8al-command-center',
    'public `generic` profile path first',
    'bootstrap, parser, tracker, and dashboard flow',
    'docs/roadmap.md',
    'tracker:parse:project-tasks',
    'should not require `TALKSTORE_PROJECT_ROOT`',
    'sibling TalkStore checkout',
  ])

  requireIncludes('docs/roadmap.md', [
    'WEEK 1',
    'bootstrap',
    'docs/roadmap.md',
    'Generate the tracker file from `docs/roadmap.md`',
  ])

  requireIncludes('docs/submission-checklist.md', [
    'COMMAND_CENTER_PROFILE=generic',
    'Confirm bootstrap writes config for this project root.',
    'Confirm no TalkStore repo checkout is required.',
    'Confirm backup behavior is documented.',
  ])

  requireIncludes('docs/manifesto.md', [
    'public `generic` profile path first',
    'Validate parser and profile selection before any write.',
    'Live TalkStore repo dependency',
  ])

  if (issues.length > 0) {
    console.error('example readiness check failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log('example readiness checks passed')
  console.log(`example: ${EXAMPLE_ROOT}`)
}

main()
