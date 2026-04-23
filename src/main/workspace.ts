import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

import { parseAndGenerate } from './parser'

const COMMAND_CENTER_ROOT = resolve(__dirname, '../..')
const WORKSPACE_CONFIG_PATH = join(COMMAND_CENTER_ROOT, '.command-center-workspace.json')

export interface WorkspaceConfig {
  projectRoot: string
  profile: 'generic'
  trackerFile?: string
  roadmapPath?: string
  manifestoPath?: string
}

export interface WorkspaceStatus {
  configured: boolean
  source: 'workspace-config' | 'env' | null
  profile: 'generic' | 'talkstore' | null
  projectRoot: string | null
  trackerPath: string | null
  trackerExists: boolean
  roadmapPath: string | null
  roadmapExists: boolean
  manifestoPath: string | null
  manifestoExists: boolean
}

function starterRoadmapContent() {
  return `# THE BUILD ROADMAP

### WEEK 1 — Bootstrap the project
- [ ] Review and replace these starter roadmap tasks with your real milestone plan
- [ ] Dry-run the parser before the first tracker write
- [ ] Generate the tracker from \`docs/roadmap.md\`

### WEEK 2 — First execution pass
- [ ] Open the swim lane and task board against the generated tracker
- [ ] Prepare prompts for the non-small work
- [ ] Start the first build wave
`
}

function starterManifestoContent() {
  return `# Project Manifesto

This project uses Sha8al Command Center as a local tracker-driven workflow.

## Principles

- Keep \`docs/roadmap.md\` as the task source of truth.
- Keep the tracker local and file-based.
- Dry-run before every tracker write.
- Expand the roadmap before real build work begins.
`
}

function resolveConfigPaths(config: WorkspaceConfig): WorkspaceStatus {
  const projectRoot = resolve(config.projectRoot)
  const trackerPath = join(projectRoot, config.trackerFile || 'command-center-tracker.json')
  const roadmapPath = join(projectRoot, config.roadmapPath || 'docs/roadmap.md')
  const manifestoPath = join(projectRoot, config.manifestoPath || 'docs/manifesto.md')

  return {
    configured: true,
    source: 'workspace-config',
    profile: config.profile,
    projectRoot,
    trackerPath,
    trackerExists: existsSync(trackerPath),
    roadmapPath,
    roadmapExists: existsSync(roadmapPath),
    manifestoPath,
    manifestoExists: existsSync(manifestoPath),
  }
}

export function loadWorkspaceConfig(): WorkspaceConfig | null {
  if (!existsSync(WORKSPACE_CONFIG_PATH)) return null

  try {
    const parsed = JSON.parse(readFileSync(WORKSPACE_CONFIG_PATH, 'utf-8'))
    if (!parsed || typeof parsed !== 'object' || typeof parsed.projectRoot !== 'string') {
      return null
    }

    return {
      projectRoot: parsed.projectRoot,
      profile: 'generic',
      trackerFile: typeof parsed.trackerFile === 'string' ? parsed.trackerFile : undefined,
      roadmapPath: typeof parsed.roadmapPath === 'string' ? parsed.roadmapPath : undefined,
      manifestoPath: typeof parsed.manifestoPath === 'string' ? parsed.manifestoPath : undefined,
    }
  } catch {
    return null
  }
}

export function saveWorkspaceConfig(config: WorkspaceConfig) {
  mkdirSync(dirname(WORKSPACE_CONFIG_PATH), { recursive: true })
  writeFileSync(WORKSPACE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export async function getWorkspaceStatus(): Promise<WorkspaceStatus> {
  const workspaceConfig = loadWorkspaceConfig()
  if (workspaceConfig) {
    return resolveConfigPaths(workspaceConfig)
  }

  try {
    const config = await import('./config')
    return {
      configured: true,
      source: 'env',
      profile: config.PROFILE_ID || null,
      projectRoot: config.PROJECT_ROOT || null,
      trackerPath: config.TRACKER_PATH || null,
      trackerExists: Boolean(config.TRACKER_PATH && existsSync(config.TRACKER_PATH)),
      roadmapPath: config.DOCS_PATHS?.roadmap || null,
      roadmapExists: Boolean(config.DOCS_PATHS?.roadmap && existsSync(config.DOCS_PATHS.roadmap)),
      manifestoPath: config.DOCS_PATHS?.manifesto || null,
      manifestoExists: Boolean(config.DOCS_PATHS?.manifesto && existsSync(config.DOCS_PATHS.manifesto)),
    }
  } catch {
    return {
      configured: false,
      source: null,
      profile: null,
      projectRoot: null,
      trackerPath: null,
      trackerExists: false,
      roadmapPath: null,
      roadmapExists: false,
      manifestoPath: null,
      manifestoExists: false,
    }
  }
}

export function configureWorkspace(projectRoot: string): WorkspaceStatus {
  const config: WorkspaceConfig = {
    projectRoot,
    profile: 'generic',
    trackerFile: 'command-center-tracker.json',
    roadmapPath: 'docs/roadmap.md',
    manifestoPath: 'docs/manifesto.md',
  }

  saveWorkspaceConfig(config)
  return resolveConfigPaths(config)
}

export function createStarterRoadmap(projectRoot: string) {
  const docsRoot = join(projectRoot, 'docs')
  const roadmapPath = join(docsRoot, 'roadmap.md')
  const manifestoPath = join(docsRoot, 'manifesto.md')
  const created: string[] = []

  mkdirSync(docsRoot, { recursive: true })

  if (!existsSync(roadmapPath)) {
    writeFileSync(roadmapPath, starterRoadmapContent(), 'utf-8')
    created.push('docs/roadmap.md')
  }

  if (!existsSync(manifestoPath)) {
    writeFileSync(manifestoPath, starterManifestoContent(), 'utf-8')
    created.push('docs/manifesto.md')
  }

  return { created, status: configureWorkspace(projectRoot) }
}

export function importRoadmap(projectRoot: string, sourcePath: string) {
  const targetPath = join(projectRoot, 'docs', 'roadmap.md')
  mkdirSync(dirname(targetPath), { recursive: true })
  copyFileSync(sourcePath, targetPath)
  return { imported: targetPath, status: configureWorkspace(projectRoot) }
}

export function generateTrackerForWorkspace(status: WorkspaceStatus) {
  if (!status.projectRoot || !status.roadmapPath || !status.trackerPath) {
    throw new Error('Workspace is not configured.')
  }

  if (!status.roadmapExists) {
    throw new Error(`Roadmap not found at ${status.roadmapPath}.`)
  }

  const checklistPath = join(status.projectRoot, 'docs/submission-checklist.md')
  const result = parseAndGenerate({
    roadmapPath: status.roadmapPath,
    checklistPath: existsSync(checklistPath) ? checklistPath : null,
    outputPath: status.trackerPath,
  })

  return {
    ...result,
    status: resolveConfigPaths(loadWorkspaceConfig() || {
      projectRoot: status.projectRoot,
      profile: 'generic',
    }),
  }
}
