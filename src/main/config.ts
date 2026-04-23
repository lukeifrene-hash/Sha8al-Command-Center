import { existsSync, readFileSync } from 'fs'
import { basename, isAbsolute, join, resolve } from 'path'

const COMMAND_CENTER_ROOT = resolve(__dirname, '../..')
const PROFILES_ROOT = join(COMMAND_CENTER_ROOT, 'profiles')
const SIBLING_TALKSTORE_ROOT = resolve(COMMAND_CENTER_ROOT, '..', 'talkstore')

type ConsumerProfileId = 'generic' | 'talkstore'

interface ConsumerProfileDocEntry {
  default_path: string
  compatibility_paths?: string[]
  required: boolean
}

interface ConsumerProfileManifest {
  id: ConsumerProfileId
  display_name: string
  kind: 'public' | 'compatibility' | 'internal'
  resolution_priority: number
  project_root: {
    env_keys: string[]
    compatibility_inference?: Array<{ type: string; key?: string; value?: string }>
  }
  tracker: {
    primary_filename: string
    compatibility_filenames: string[]
    default_creation_filename: string
  }
  docs: {
    tasks: ConsumerProfileDocEntry
    checklist: ConsumerProfileDocEntry
    manifesto: ConsumerProfileDocEntry
    roadmap_optional?: ConsumerProfileDocEntry
  }
}

function parseEnvFile(): Record<string, string> {
  const envPath = join(COMMAND_CENTER_ROOT, '.env')
  const values: Record<string, string> = {}

  try {
    const envContent = readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed) continue
      const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/)
      if (match) values[match[1]] = match[2].trim()
    }
  } catch {
    // .env not found
  }

  return values
}

function readSetting(keys: string[]): string | null {
  const envFileValues = parseEnvFile()
  for (const key of keys) {
    const fromProcess = process.env[key]
    if (fromProcess?.trim()) return fromProcess.trim()
    const fromFile = envFileValues[key]
    if (fromFile?.trim()) return fromFile.trim()
  }
  return null
}

function resolveMaybeRelative(basePath: string, value: string): string {
  return isAbsolute(value) ? value : resolve(basePath, value)
}

function loadProfileManifest(profileId: ConsumerProfileId): ConsumerProfileManifest {
  const manifestPath = join(PROFILES_ROOT, profileId, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Profile manifest not found for "${profileId}" at ${manifestPath}.`)
  }

  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as ConsumerProfileManifest
}

function resolveProfileId(): ConsumerProfileId {
  const explicitProfile = readSetting(['COMMAND_CENTER_PROFILE'])
  if (explicitProfile) {
    if (explicitProfile === 'generic' || explicitProfile === 'talkstore') {
      return explicitProfile
    }

    throw new Error(
      `Unknown consumer profile "${explicitProfile}". Expected "generic" or "talkstore".`
    )
  }

  const legacyRoot = readSetting(['TALKSTORE_PROJECT_ROOT'])
  if (legacyRoot) return 'talkstore'

  const configuredTracker = readSetting(['COMMAND_CENTER_TRACKER_FILE', 'TRACKER_FILE'])
  if (configuredTracker && basename(configuredTracker) === 'talkstore-tracker.json') {
    return 'talkstore'
  }

  const configuredRoot = readSetting(['COMMAND_CENTER_PROJECT_ROOT', 'PROJECT_ROOT'])
  if (configuredRoot) {
    const resolvedRoot = resolve(configuredRoot)
    if (
      resolvedRoot === SIBLING_TALKSTORE_ROOT ||
      existsSync(join(resolvedRoot, 'talkstore-tracker.json'))
    ) {
      return 'talkstore'
    }
    return 'generic'
  }

  if (existsSync(SIBLING_TALKSTORE_ROOT)) {
    return 'talkstore'
  }

  return 'generic'
}

function resolveProjectRoot(profile: ConsumerProfileManifest): string {
  const configured = readSetting(profile.project_root.env_keys)
  if (configured) return resolve(configured)

  if (profile.id === 'talkstore' && existsSync(SIBLING_TALKSTORE_ROOT)) {
    return SIBLING_TALKSTORE_ROOT
  }

  throw new Error(
    'Project root is not set. Configure COMMAND_CENTER_PROJECT_ROOT ' +
    '(or TALKSTORE_PROJECT_ROOT for legacy compatibility).'
  )
}

function resolveTrackerFile(projectRoot: string, profile: ConsumerProfileManifest): string {
  const configured = readSetting(['COMMAND_CENTER_TRACKER_FILE', 'TRACKER_FILE'])
  if (configured) return configured

  const candidateFiles = [profile.tracker.primary_filename, ...profile.tracker.compatibility_filenames]
  for (const candidate of candidateFiles) {
    if (existsSync(join(projectRoot, candidate))) {
      return candidate
    }
  }

  return profile.tracker.default_creation_filename
}

function resolveDocPath(
  projectRoot: string,
  envKeys: string[],
  candidates: string[]
): string {
  const configured = readSetting(envKeys)
  if (configured) return resolveMaybeRelative(projectRoot, configured)

  for (const candidate of candidates) {
    const absolute = resolveMaybeRelative(projectRoot, candidate)
    if (existsSync(absolute)) return absolute
  }

  return resolveMaybeRelative(projectRoot, candidates[0])
}

function resolveTasksPath(projectRoot: string, profile: ConsumerProfileManifest): string {
  const resolvedPath = resolveDocPath(projectRoot, ['COMMAND_CENTER_TASKS_DOC', 'TASKS_DOC'], [
    profile.docs.tasks.default_path,
  ])

  if (profile.id === 'generic') {
    const requiredRoadmapPath = resolveMaybeRelative(projectRoot, profile.docs.tasks.default_path)
    if (resolve(resolvedPath) !== resolve(requiredRoadmapPath)) {
      throw new Error(
        `Public generic installs require ${profile.docs.tasks.default_path} as the task source. ` +
        `Received ${resolvedPath}.`
      )
    }
  }

  return resolvedPath
}

function resolveOptionalDocPath(
  projectRoot: string,
  envKeys: string[],
  defaultPath: string
): string {
  return resolveDocPath(projectRoot, envKeys, [defaultPath])
}

export const PROFILE_ID = resolveProfileId()
export const PROFILE = loadProfileManifest(PROFILE_ID)
export const PROJECT_ROOT = resolveProjectRoot(PROFILE)
export const TALKSTORE_ROOT = PROJECT_ROOT
export const TRACKER_FILE = resolveTrackerFile(PROJECT_ROOT, PROFILE)
export const TRACKER_PATH = join(PROJECT_ROOT, TRACKER_FILE)

const TASKS_PATH = resolveTasksPath(PROJECT_ROOT, PROFILE)

export const DOCS_PATHS = {
  tasks: TASKS_PATH,
  // Preserve the legacy export name used by src/main/parser.ts.
  roadmap: TASKS_PATH,
  checklist: resolveDocPath(
    PROJECT_ROOT,
    ['COMMAND_CENTER_CHECKLIST_DOC', 'CHECKLIST_DOC'],
    [PROFILE.docs.checklist.default_path]
  ),
  manifesto: resolveOptionalDocPath(
    PROJECT_ROOT,
    ['COMMAND_CENTER_MANIFESTO_DOC', 'MANIFESTO_DOC'],
    PROFILE.docs.manifesto.default_path
  ),
  roadmap_optional: PROFILE.docs.roadmap_optional
    ? resolveOptionalDocPath(
        PROJECT_ROOT,
        ['COMMAND_CENTER_ROADMAP_DOC', 'ROADMAP_DOC'],
        PROFILE.docs.roadmap_optional.default_path
      )
    : null,
}
