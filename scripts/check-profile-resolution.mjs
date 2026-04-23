#!/usr/bin/env node

import { readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { Module } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import * as ts from 'typescript'
import { resolveParserProjectPaths, resolveProjectPaths } from './lib/project-paths.mjs'
import {
  assert,
  ensureDir,
  tempDir,
  withTempEnv,
  writeJson,
  writeText,
  REPO_ROOT,
} from './check-support.mjs'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_ROOT = resolve(dirname(__filename), '..')

function compileRuntimeConfig() {
  const sourcePath = join(REPO_ROOT, 'src/main/config.ts')
  const sourceText = readFileSync(sourcePath, 'utf8')
  const { outputText } = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  })

  const runtimeModule = new Module(sourcePath)
  runtimeModule.filename = sourcePath
  runtimeModule.paths = Module._nodeModulePaths(dirname(sourcePath))
  runtimeModule._compile(outputText, sourcePath)
  return runtimeModule.exports
}

async function loadMcpTrackerSnapshot(envOverrides, cacheKey) {
  return withTempEnv(envOverrides, async () => {
    const modulePath = join(REPO_ROOT, 'mcp-server/dist/tracker.js')
    const moduleUrl = `${pathToFileURL(modulePath).href}?${cacheKey}`
    return import(moduleUrl)
  })
}

function makeExternalProjectFixture(root) {
  ensureDir(join(root, 'docs'))
  ensureDir(join(root, 'Brainstorming & Pivot'))

  writeText(join(root, 'README.md'), '# External example\n')
  writeText(
    join(root, 'docs/roadmap.md'),
    [
      '# THE BUILD ROADMAP',
      '',
      '## WEEK 1 - Example Foundation',
      '- [ ] Bootstrap the public example',
      '',
    ].join('\n')
  )
  writeText(
    join(root, 'docs/tasks.md'),
    [
      '# THE BUILD ROADMAP',
      '',
      '## WEEK 1 - TalkStore Compatibility',
      '- [ ] Preserve the legacy task source path',
      '',
    ].join('\n')
  )
  writeText(
    join(root, 'docs/submission-checklist.md'),
    [
      '## 1. OAuth + Auth',
      '- \u2B1C Example checklist item',
      '',
    ].join('\n')
  )
  writeText(join(root, 'docs/manifesto.md'), '# Example manifesto\n')
  writeText(
    join(root, 'Brainstorming & Pivot/ROADMAP.md'),
    [
      '## M1 \u2014 Example Roadmap',
      '',
      '**Goal:** prove explicit profile resolution.',
      '',
      '- **Tasks:**',
      '- **T1.1 \u2014 Bootstrap example**',
      '  - **What:** create the external bootstrap fixture.',
      '  - **Why:** prove the public install path.',
      '  - **Acceptance:** the bootstrap check passes.',
      '  - **Dependencies:** none',
      '  - **Complexity:** small',
      '  - **Failure modes:** none',
      '',
    ].join('\n')
  )
  writeJson(join(root, 'talkstore-tracker.json'), {
    project: {
      parser_profile: 'talkstore',
      parser_id: 'talkstore-markdown',
      parser_source_pairing: 'talkstore-markdown:talkstore',
    },
  })
  writeJson(join(root, 'command-center-tracker.json'), {
    project: {
      parser_profile: 'talkstore',
      parser_id: 'talkstore-markdown',
      parser_source_pairing: 'talkstore-markdown:talkstore',
      tasks_source: 'docs/roadmap.md',
      checklist_source: 'docs/submission-checklist.md',
      manifesto_source: 'docs/manifesto.md',
      source_files: {
        tasks: 'docs/roadmap.md',
        checklist: 'docs/submission-checklist.md',
        manifesto: 'docs/manifesto.md',
      },
    },
  })
}

async function main() {
  const workspace = tempDir()
  const externalProject = join(workspace, 'external-example')
  const siblingTalkstore = join(workspace, 'talkstore')
  ensureDir(externalProject)
  ensureDir(siblingTalkstore)
  makeExternalProjectFixture(externalProject)

  const explicitEnv = {
    COMMAND_CENTER_PROFILE: 'generic',
    COMMAND_CENTER_PROJECT_ROOT: externalProject,
    TALKSTORE_PROJECT_ROOT: siblingTalkstore,
    COMMAND_CENTER_TRACKER_FILE: 'command-center-tracker.json',
    COMMAND_CENTER_TASKS_DOC: 'docs/roadmap.md',
    COMMAND_CENTER_MANIFESTO_DOC: 'docs/manifesto.md',
  }

  const runtimeConfig = await withTempEnv(explicitEnv, async () => compileRuntimeConfig())
  const mcpTracker = await loadMcpTrackerSnapshot(explicitEnv, 'explicit')
  const explicitProjectPaths = await withTempEnv(explicitEnv, async () => resolveProjectPaths())
  const genericPaths = await withTempEnv(explicitEnv, async () =>
    resolveParserProjectPaths({
      parserId: 'generic-markdown',
      argv: [
        '--profile=generic',
        '--tasks-source=docs/roadmap.md',
        '--manifesto-source=docs/manifesto.md',
      ],
    })
  )
  const aciPaths = await withTempEnv(
    {
      ...explicitEnv,
      COMMAND_CENTER_TRACKER_FILE: 'talkstore-tracker.json',
    },
    async () =>
      resolveParserProjectPaths({
        parserId: 'aci-roadmap',
        argv: [
          '--profile=aci',
          '--aci-roadmap-source=Brainstorming & Pivot/ROADMAP.md',
        ],
      })
  )

  assert(runtimeConfig.PROFILE_ID === 'generic', 'runtime should honor explicit COMMAND_CENTER_PROFILE=generic')
  assert(runtimeConfig.PROJECT_ROOT === externalProject, 'runtime should resolve the explicit project root')
  assert(runtimeConfig.TRACKER_FILE === 'command-center-tracker.json', 'runtime should honor the explicit tracker filename')
  assert(runtimeConfig.TRACKER_PATH === join(externalProject, 'command-center-tracker.json'), 'runtime should build the tracker path from the explicit root and tracker file')
  assert(runtimeConfig.DOCS_PATHS.roadmap === join(externalProject, 'docs/roadmap.md'), 'runtime should resolve the roadmap doc override')
  assert(mcpTracker.PROFILE_ID === 'generic', 'MCP tracker should honor explicit COMMAND_CENTER_PROFILE=generic')
  assert(mcpTracker.PROJECT_ROOT === externalProject, 'MCP tracker should resolve the explicit project root')
  assert(mcpTracker.TRACKER_FILE === 'command-center-tracker.json', 'MCP tracker should honor the explicit tracker filename')
  assert(mcpTracker.TRACKER_PATH === join(externalProject, 'command-center-tracker.json'), 'MCP tracker should build the tracker path from the explicit root and tracker file')
  assert(mcpTracker.DOCS_PATHS.manifesto === join(externalProject, 'docs/manifesto.md'), 'MCP tracker should resolve the manifesto override')

  assert(explicitProjectPaths.profileName === 'generic', 'script resolution should honor explicit COMMAND_CENTER_PROFILE=generic')
  assert(explicitProjectPaths.projectRoot === externalProject, 'script resolution should resolve the explicit project root')
  assert(explicitProjectPaths.trackerFile === 'command-center-tracker.json', 'script resolution should honor the explicit tracker filename')

  assert(genericPaths.consumerProfile === 'generic', 'parser should inherit the explicit generic consumer profile')
  assert(genericPaths.projectRoot === externalProject, 'parser should resolve the explicit project root')
  assert(genericPaths.trackerFile === 'command-center-tracker.json', 'parser should honor the explicit tracker filename')
  assert(genericPaths.parserProfile === 'generic', 'parser should resolve the generic parser profile for the public path')
  assert(genericPaths.tasksPath === join(externalProject, 'docs/roadmap.md'), 'parser should resolve the roadmap doc override')
  assert(genericPaths.checklistPath === join(externalProject, 'docs/submission-checklist.md'), 'parser should still expose the conventional checklist path when present')
  assert(genericPaths.manifestoPath === join(externalProject, 'docs/manifesto.md'), 'parser should resolve the manifesto override')

  assert(aciPaths.projectRoot === externalProject, 'ACI parser should resolve the explicit project root')
  assert(aciPaths.trackerFile === 'talkstore-tracker.json', 'ACI parser should keep the explicit legacy tracker filename when configured')
  assert(aciPaths.aciRoadmapPath === join(externalProject, 'Brainstorming & Pivot/ROADMAP.md'), 'ACI parser should resolve the roadmap override')

  const legacyEnv = {
    TALKSTORE_PROJECT_ROOT: externalProject,
  }

  const legacyRuntime = await withTempEnv(legacyEnv, async () => compileRuntimeConfig())
  const legacyMcp = await loadMcpTrackerSnapshot(legacyEnv, 'legacy')
  const legacyProjectPaths = await withTempEnv(legacyEnv, async () => resolveProjectPaths())
  const legacyTalkstore = await withTempEnv(legacyEnv, async () =>
    resolveParserProjectPaths({
      parserId: 'talkstore-markdown',
      argv: [
        '--profile=talkstore',
        '--tasks-source=docs/tasks.md',
        '--checklist-source=docs/submission-checklist.md',
      ],
    })
  )

  assert(legacyRuntime.PROFILE_ID === 'talkstore', 'legacy runtime should still resolve the talkstore compatibility profile')
  assert(legacyRuntime.PROJECT_ROOT === externalProject, 'legacy project root should still resolve from TALKSTORE_PROJECT_ROOT')
  assert(legacyRuntime.TRACKER_FILE === 'talkstore-tracker.json', 'legacy tracker filename should prefer the TalkStore tracker when present')
  assert(legacyMcp.PROFILE_ID === 'talkstore', 'legacy MCP should still resolve the talkstore compatibility profile')
  assert(legacyMcp.PROJECT_ROOT === externalProject, 'legacy MCP project root should still resolve from TALKSTORE_PROJECT_ROOT')
  assert(legacyMcp.TRACKER_FILE === 'talkstore-tracker.json', 'legacy MCP tracker filename should prefer the TalkStore tracker when present')
  assert(legacyProjectPaths.profileName === 'talkstore', 'legacy script resolution should still resolve the talkstore compatibility profile')
  assert(legacyTalkstore.consumerProfile === 'talkstore', 'legacy parser should still inherit the talkstore compatibility profile')
  assert(legacyTalkstore.projectRoot === externalProject, 'legacy parser project root should still resolve from TALKSTORE_PROJECT_ROOT')
  assert(legacyTalkstore.trackerFile === 'talkstore-tracker.json', 'legacy parser tracker filename should prefer the TalkStore tracker when present')

  console.log('profile resolution checks passed')
  console.log(`workspace: ${workspace}`)
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
