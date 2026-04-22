#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..', '..')
const COMMAND_CENTER_ROOT = __dirname
const MIRROR_ROOT = join(COMMAND_CENTER_ROOT, 'playbooks', 'talkstore')
const SOURCE_ROOT = resolve(
  process.env.TALKSTORE_PLAYBOOK_SOURCE_ROOT || join(COMMAND_CENTER_ROOT, '..', 'talkstore')
)

const MIRROR_GROUPS = [
  {
    label: 'top-level docs',
    sourceDir: SOURCE_ROOT,
    mirrorDir: MIRROR_ROOT,
    files: ['AGENTS.md', 'CLAUDE.md', 'COMMAND-CENTER-GUIDE.md'],
  },
  {
    label: 'commands',
    sourceDir: join(SOURCE_ROOT, '.claude', 'commands'),
    mirrorDir: join(MIRROR_ROOT, '.claude', 'commands'),
  },
  {
    label: 'rules',
    sourceDir: join(SOURCE_ROOT, '.claude', 'rules'),
    mirrorDir: join(MIRROR_ROOT, '.claude', 'rules'),
  },
  {
    label: 'agents',
    sourceDir: join(SOURCE_ROOT, '.claude', 'agents'),
    mirrorDir: join(MIRROR_ROOT, '.claude', 'agents'),
  },
]

function normalizeContent(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()
}

function compareGroup(group) {
  const sourceFiles = group.files ? [...group.files] : listMarkdownFiles(group.sourceDir)
  const mirrorFiles = group.files ? [...group.files] : listMarkdownFiles(group.mirrorDir)

  const missingFromMirror = sourceFiles.filter((file) => !mirrorFiles.includes(file))
  const extraInMirror = mirrorFiles.filter((file) => !sourceFiles.includes(file))
  const contentDiffs = []

  for (const file of sourceFiles) {
    if (!mirrorFiles.includes(file)) continue
    const sourcePath = join(group.sourceDir, file)
    const mirrorPath = join(group.mirrorDir, file)
    if (!existsSync(sourcePath) || !existsSync(mirrorPath)) {
      contentDiffs.push({
        file,
        reason: 'missing counterpart',
      })
      continue
    }
    if (normalizeContent(sourcePath) !== normalizeContent(mirrorPath)) {
      contentDiffs.push({
        file,
        reason: 'content differs',
      })
    }
  }

  return {
    label: group.label,
    missingFromMirror,
    extraInMirror,
    contentDiffs,
  }
}

if (!existsSync(SOURCE_ROOT)) {
  console.error(`Source repo not found: ${SOURCE_ROOT}`)
  console.error(
    'Set TALKSTORE_PLAYBOOK_SOURCE_ROOT=/absolute/path/to/talkstore to compare against a live TalkStore checkout.'
  )
  process.exit(1)
}

if (!existsSync(MIRROR_ROOT)) {
  console.error(`Mirror not found: ${MIRROR_ROOT}`)
  process.exit(1)
}

const results = MIRROR_GROUPS.map(compareGroup)
const issues = results.filter(
  (group) =>
    group.missingFromMirror.length > 0 ||
    group.extraInMirror.length > 0 ||
    group.contentDiffs.length > 0
)

console.log(`Source: ${relative(COMMAND_CENTER_ROOT, SOURCE_ROOT) || '.'}`)
console.log(`Mirror: ${relative(COMMAND_CENTER_ROOT, MIRROR_ROOT) || '.'}`)
console.log('')

if (issues.length === 0) {
  console.log('Playbook mirror is in sync.')
  process.exit(0)
}

console.log('Playbook mirror drift detected:')
for (const group of issues) {
  console.log(`- ${group.label}`)
  for (const file of group.missingFromMirror) {
    console.log(`  missing in mirror: ${file}`)
  }
  for (const file of group.extraInMirror) {
    console.log(`  extra in mirror: ${file}`)
  }
  for (const diff of group.contentDiffs) {
    console.log(`  differs: ${diff.file} (${diff.reason})`)
  }
}

process.exit(1)
