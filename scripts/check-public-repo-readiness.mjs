#!/usr/bin/env node

import { existsSync } from 'fs'
import { join } from 'path'
import { REPO_ROOT, readJson } from './check-support.mjs'

const issues = []

function requireFile(relativePath, label = relativePath) {
  const absolutePath = join(REPO_ROOT, relativePath)
  if (!existsSync(absolutePath)) {
    issues.push(`missing ${label}: ${relativePath}`)
  }
}

function main() {
  const rootPackage = readJson(join(REPO_ROOT, 'package.json'))
  const mcpPackage = readJson(join(REPO_ROOT, 'mcp-server/package.json'))

  const requiredMetadataFiles = [
    'LICENSE',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
    'SUPPORT.md',
    'CHANGELOG.md',
    'docs/troubleshooting.md',
    'docs/architecture-overview.md',
    'mcp-server/README.md',
    'mcp-server/LICENSE',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/profile_compatibility_bug.yml',
    '.github/ISSUE_TEMPLATE/documentation_issue.yml',
    '.github/pull_request_template.md',
  ]

  for (const relativePath of requiredMetadataFiles) {
    requireFile(relativePath)
  }

  const releasesDir = join(REPO_ROOT, 'docs', 'releases')
  if (!existsSync(releasesDir)) {
    issues.push('missing release notes directory: docs/releases')
  }

  if (!rootPackage.description || typeof rootPackage.description !== 'string') {
    issues.push('root package.json is missing a description')
  } else if (!/sha8al-command-center/i.test(rootPackage.description)) {
    issues.push(`root package description must lead with the public platform identity: ${rootPackage.description}`)
  }

  if (rootPackage.name !== 'sha8al-command-center') {
    issues.push(`root package name must use the public package id: ${rootPackage.name}`)
  }

  const rootKeywords = Array.isArray(rootPackage.keywords) ? rootPackage.keywords : []
  if (!rootKeywords.includes('sha8al-command-center')) {
    issues.push('root package.json must include the public platform keyword: sha8al-command-center')
  }

  if (rootPackage.private !== true) {
    issues.push('root package.json should stay private until the desktop release path is finalized')
  }

  if (!mcpPackage.description || typeof mcpPackage.description !== 'string') {
    issues.push('mcp-server/package.json is missing a description')
  } else if (!/sha8al-command-center/i.test(mcpPackage.description)) {
    issues.push(`MCP package description must lead with the public platform identity: ${mcpPackage.description}`)
  }

  if (mcpPackage.name !== 'sha8al-command-center-mcp') {
    issues.push(`mcp-server/package.json must use the public MCP package id: ${mcpPackage.name}`)
  }

  const mcpKeywords = Array.isArray(mcpPackage.keywords) ? mcpPackage.keywords : []
  if (!mcpKeywords.includes('sha8al-command-center')) {
    issues.push('mcp-server/package.json must include the public platform keyword: sha8al-command-center')
  }

  const binNames = Object.keys(mcpPackage.bin || {})
  if (binNames.length === 0) {
    issues.push('mcp-server/package.json must expose at least one CLI binary')
  } else if (!binNames.includes('sha8al-command-center')) {
    issues.push(`mcp-server/package.json must expose the public CLI alias: ${binNames.join(', ')}`)
  }

  if (!binNames.includes('talkstore')) {
    issues.push('mcp-server/package.json must keep the TalkStore compatibility CLI alias during the transition window')
  }

  if (rootPackage.license !== 'ISC') {
    issues.push(`root package.json license must stay aligned with LICENSE: ${rootPackage.license}`)
  }

  if (mcpPackage.license !== 'ISC') {
    issues.push(`mcp-server/package.json license must stay aligned with LICENSE: ${mcpPackage.license}`)
  }

  if (issues.length > 0) {
    console.error('public repo readiness check failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log('public repo readiness checks passed')
}

main()
