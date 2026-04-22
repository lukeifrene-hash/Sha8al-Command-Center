#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { REPO_ROOT, readJson } from './check-support.mjs'

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

function requirePackageKeywords(packageJsonPath, requiredKeywords) {
  const packageJson = readJson(join(REPO_ROOT, packageJsonPath))
  const keywords = Array.isArray(packageJson.keywords) ? packageJson.keywords : []

  for (const keyword of requiredKeywords) {
    if (!keywords.includes(keyword)) {
      issues.push(`${packageJsonPath} is missing required keyword: ${keyword}`)
    }
  }
}

function requireCompatiblePackageName(packageJsonPath, allowedNames) {
  const packageJson = readJson(join(REPO_ROOT, packageJsonPath))
  if (!allowedNames.includes(packageJson.name)) {
    issues.push(
      `${packageJsonPath} must use one of the supported transition-safe package names: ${allowedNames.join(', ')}. Found: ${packageJson.name}`
    )
  }
}

function requireCliHelp() {
  const cliEntry = join(REPO_ROOT, 'mcp-server', 'dist', 'cli.js')
  if (!existsSync(cliEntry)) {
    issues.push('missing built CLI entrypoint: mcp-server/dist/cli.js (run the MCP build before publish-readiness checks)')
    return
  }

  const result = spawnSync(process.execPath, [cliEntry, 'help'], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })

  if ((result.status ?? 0) !== 0) {
    issues.push(
      `CLI help failed with status ${result.status}: ${(result.stderr || result.stdout || '').trim() || 'no output'}`
    )
    return
  }

  const output = result.stdout || ''
  const requiredSnippets = [
    'Sha8al Command Center CLI',
    'Compatibility alias: talkstore',
    'sha8al-command-center <command> [args...]',
    'talkstore <command> [args...]   # compatibility alias',
  ]

  for (const snippet of requiredSnippets) {
    if (!output.includes(snippet)) {
      issues.push(`CLI help is missing required text: ${snippet}`)
    }
  }
}

function main() {
  requireIncludes('README.md', [
    'Sha8al Command Center',
    'sha8al-command-center',
    'TalkStore is a compatibility profile',
  ])

  requireIncludes('.env.example', [
    'sha8al-command-center',
    'COMMAND_CENTER_PROFILE=generic',
  ])

  requireIncludes('docs/public-naming.md', [
    'Sha8al Command Center',
    'sha8al-command-center',
    'talkstore',
  ])

  requireIncludes('examples/README.md', [
    'Sha8al Command Center',
    'sha8al-command-center',
  ])

  requireIncludes('examples/minimal-command-center-project/README.md', [
    'Sha8al Command Center',
    'sha8al-command-center',
    'TalkStore remains the compatibility profile',
  ])

  requireIncludes('src/renderer/index.html', [
    '<title>Sha8al Command Center</title>',
  ])

  requirePackageKeywords('package.json', [
    'sha8al-command-center',
    'talkstore-compatibility',
  ])
  requirePackageKeywords('mcp-server/package.json', [
    'sha8al-command-center',
    'talkstore-compatibility',
  ])

  requireCompatiblePackageName('package.json', [
    'sha8al-command-center',
  ])
  requireCompatiblePackageName('mcp-server/package.json', [
    'sha8al-command-center-mcp',
  ])

  requireCliHelp()

  if (issues.length > 0) {
    console.error('public identity check failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log('public identity checks passed')
}

main()
