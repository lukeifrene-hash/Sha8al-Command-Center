import { existsSync, readFileSync, readdirSync } from 'fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const COMMAND_CENTER_ROOT = resolve(__dirname, '..', '..')
export const PROFILES_ROOT = join(COMMAND_CENTER_ROOT, 'profiles')

const PROFILE_MANIFEST_FILENAMES = ['manifest.json', 'profile.json']
const DEFAULT_ANALYSIS_DIR = '/tmp/analysis'

const PARSER_PROFILE_BY_ID = {
  'generic-markdown': 'generic',
  'talkstore-markdown': 'talkstore',
  'aci-roadmap': 'aci',
  'aci-checklist-seed': 'aci',
}

const PARSER_PROFILES = {
  generic: {
    parserIds: ['generic-markdown'],
  },
  talkstore: {
    parserIds: ['talkstore-markdown'],
  },
  aci: {
    parserIds: ['aci-roadmap', 'aci-checklist-seed'],
  },
}

const DEFAULT_TALKSTORE_MARKDOWN_SOURCE_FIELDS = {
  tasks: {
    env_keys: ['COMMAND_CENTER_TASKS_DOC', 'TASKS_DOC'],
    cli_keys: ['tasks-source', 'tasks-doc'],
    default_path: 'docs/tasks.md',
    compatibility_paths: ['docs/roadmap.md'],
    required: true,
    require_explicit: true,
  },
  checklist: {
    env_keys: ['COMMAND_CENTER_CHECKLIST_DOC', 'CHECKLIST_DOC'],
    cli_keys: ['checklist-source', 'checklist-doc'],
    default_path: 'docs/submission-checklist.md',
    compatibility_paths: ['docs/submission-checklist.md'],
    required: false,
    require_explicit: false,
  },
  manifesto: {
    env_keys: ['COMMAND_CENTER_MANIFESTO_DOC', 'MANIFESTO_DOC'],
    cli_keys: ['manifesto-source', 'manifesto-doc'],
    default_path: 'docs/manifesto.md',
    compatibility_paths: ['docs/manifesto.md'],
    required: false,
    require_explicit: false,
  },
}

const DEFAULT_GENERIC_MARKDOWN_SOURCE_FIELDS = {
  tasks: {
    env_keys: ['COMMAND_CENTER_TASKS_DOC', 'TASKS_DOC'],
    cli_keys: ['tasks-source', 'tasks-doc'],
    default_path: 'docs/roadmap.md',
    compatibility_paths: [],
    required: true,
    require_explicit: true,
  },
  checklist: {
    env_keys: ['COMMAND_CENTER_CHECKLIST_DOC', 'CHECKLIST_DOC'],
    cli_keys: ['checklist-source', 'checklist-doc'],
    default_path: 'docs/submission-checklist.md',
    compatibility_paths: ['docs/submission-checklist.md'],
    required: true,
    require_explicit: false,
  },
  manifesto: {
    env_keys: ['COMMAND_CENTER_MANIFESTO_DOC', 'MANIFESTO_DOC'],
    cli_keys: ['manifesto-source', 'manifesto-doc'],
    default_path: 'docs/manifesto.md',
    compatibility_paths: ['docs/manifesto.md'],
    required: false,
    require_explicit: false,
  },
}

let profileIndexCache = null

function parseEnvFile(envPath) {
  const values = {}
  if (!existsSync(envPath)) return values

  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(trimmed)
    if (!match) continue
    values[match[1]] = match[2]
  }
  return values
}

export function readSetting(keys) {
  const envFileValues = parseEnvFile(join(COMMAND_CENTER_ROOT, '.env'))
  for (const key of keys) {
    const fromProcess = process.env[key]
    if (fromProcess && fromProcess.trim()) return fromProcess.trim()
    const fromFile = envFileValues[key]
    if (fromFile && fromFile.trim()) return fromFile.trim()
  }
  return null
}

export function resolveRelativeTo(basePath, candidate) {
  return isAbsolute(candidate) ? candidate : resolve(basePath, candidate)
}

export function toProjectRelativePath(projectRoot, targetPath) {
  const relativePath = relative(projectRoot, targetPath)
  if (!relativePath || relativePath.startsWith('..')) return targetPath
  return relativePath.split(sep).join('/')
}

function normalizeAlias(alias) {
  return alias.trim().toLowerCase()
}

function registerAlias(map, alias, profileId) {
  const normalized = normalizeAlias(alias)
  const existing = map.get(normalized)
  if (existing && existing !== profileId) {
    throw new Error(
      `Profile alias "${alias}" is already registered for "${existing}" and cannot also map to "${profileId}".`
    )
  }
  map.set(normalized, profileId)
}

function readProfileManifest(manifestPath) {
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Profile manifest at ${manifestPath} is not a JSON object.`)
  }
  if (!raw.id || typeof raw.id !== 'string') {
    throw new Error(`Profile manifest at ${manifestPath} is missing required field "id".`)
  }

  const manifest = {
    ...raw,
    aliases: {
      profile_names: [],
      tracker_filenames: [],
      cli_names: [],
      ...(raw.aliases || {}),
    },
    project_root: {
      env_keys: [],
      compatibility_inference: [],
      ...(raw.project_root || {}),
    },
    tracker: {
      primary_filename: '',
      compatibility_filenames: [],
      default_creation_filename: '',
      ...(raw.tracker || {}),
    },
    docs: {
      ...(raw.docs || {}),
    },
    parser_defaults: {
      ...(raw.parser_defaults || {}),
    },
    bootstrap: {
      default_env_keys: [],
      compatibility_env_keys: [],
      ...(raw.bootstrap || {}),
    },
    _manifestPath: manifestPath,
  }

  return manifest
}

function findManifestPath(profileDir) {
  for (const filename of PROFILE_MANIFEST_FILENAMES) {
    const candidate = join(profileDir, filename)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function buildProfileIndex() {
  if (profileIndexCache) return profileIndexCache

  if (!existsSync(PROFILES_ROOT)) {
    throw new Error(`Profiles directory not found at ${PROFILES_ROOT}.`)
  }

  const manifests = new Map()
  const profileAliases = new Map()
  const trackerAliases = new Map()
  const cliAliases = new Map()

  for (const entry of readdirSync(PROFILES_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const profileDir = join(PROFILES_ROOT, entry.name)
    const manifestPath = findManifestPath(profileDir)
    if (!manifestPath) continue

    const manifest = readProfileManifest(manifestPath)
    manifests.set(manifest.id, manifest)

    registerAlias(profileAliases, manifest.id, manifest.id)
    registerAlias(profileAliases, entry.name, manifest.id)
    for (const alias of manifest.aliases.profile_names || []) {
      registerAlias(profileAliases, alias, manifest.id)
    }

    registerAlias(trackerAliases, manifest.tracker.primary_filename, manifest.id)

    for (const alias of manifest.aliases.cli_names || []) {
      registerAlias(cliAliases, alias, manifest.id)
    }
  }

  if (!manifests.size) {
    throw new Error(`No profile manifests found under ${PROFILES_ROOT}.`)
  }

  profileIndexCache = {
    manifests,
    profileAliases,
    trackerAliases,
    cliAliases,
  }

  return profileIndexCache
}

export function loadProfileManifests() {
  return buildProfileIndex().manifests
}

export function resolveProfileName(profileName) {
  if (!profileName || !profileName.trim()) return null
  const index = buildProfileIndex()
  const resolved = index.profileAliases.get(normalizeAlias(profileName))
  if (!resolved) {
    const available = Array.from(index.manifests.keys()).sort().join(', ')
    throw new Error(`Unknown consumer profile "${profileName}". Expected one of: ${available}.`)
  }
  return resolved
}

export function resolveProfileNameFromTrackerFile(trackerFile) {
  if (!trackerFile || !trackerFile.trim()) return null
  const index = buildProfileIndex()
  return index.trackerAliases.get(normalizeAlias(basename(trackerFile))) || null
}

export function resolveProfileNameFromCliAlias(cliName) {
  if (!cliName || !cliName.trim()) return null
  const index = buildProfileIndex()
  return index.cliAliases.get(normalizeAlias(cliName)) || null
}

export function loadProfileManifest(profileName) {
  const canonicalName = resolveProfileName(profileName)
  const manifest = buildProfileIndex().manifests.get(canonicalName)
  if (!manifest) {
    throw new Error(`Profile manifest for "${profileName}" could not be loaded.`)
  }
  return manifest
}

function resolveExplicitProfileName(options = {}) {
  if (options.profileName) {
    return resolveProfileName(options.profileName)
  }

  const configured = readSetting(['COMMAND_CENTER_PROFILE'])
  if (configured) {
    return resolveProfileName(configured)
  }

  return null
}

function resolveProfileByCompatibilitySignals(options = {}) {
  const trackerFile = options.trackerFile || readSetting(['COMMAND_CENTER_TRACKER_FILE', 'TRACKER_FILE'])
  const trackerProfile = resolveProfileNameFromTrackerFile(trackerFile)
  if (trackerProfile) return trackerProfile

  if (readSetting(['TALKSTORE_PROJECT_ROOT'])) {
    return 'talkstore'
  }

  const configuredProjectRoot =
    options.projectRoot || readSetting(['COMMAND_CENTER_PROJECT_ROOT', 'PROJECT_ROOT'])
  if (configuredProjectRoot) {
    const resolvedProjectRoot = resolve(configuredProjectRoot)
    if (existsSync(join(resolvedProjectRoot, 'talkstore-tracker.json'))) {
      return 'talkstore'
    }
    return 'generic'
  }

  const siblingTalkstore = resolve(COMMAND_CENTER_ROOT, '..', 'talkstore')
  if (existsSync(siblingTalkstore)) {
    return 'talkstore'
  }

  return null
}

export function resolveConsumerProfile(options = {}) {
  const explicit = resolveExplicitProfileName(options)
  if (explicit) return explicit

  const inferred = resolveProfileByCompatibilitySignals(options)
  if (inferred) return inferred

  throw new Error(
    'Unable to resolve a consumer profile. Set COMMAND_CENTER_PROFILE explicitly or configure ' +
    'COMMAND_CENTER_PROJECT_ROOT / TALKSTORE_PROJECT_ROOT for compatibility resolution.'
  )
}

export function resolveProjectRoot(options = {}) {
  const profileName = options.profileName ? resolveProfileName(options.profileName) : resolveConsumerProfile(options)
  const manifest = loadProfileManifest(profileName)
  const configured = readSetting(manifest.project_root.env_keys || ['COMMAND_CENTER_PROJECT_ROOT'])

  if (configured) return resolve(configured)
  if (options.projectRoot) return resolve(options.projectRoot)

  if (profileName === 'talkstore') {
    const siblingTalkstore = resolve(COMMAND_CENTER_ROOT, '..', 'talkstore')
    if (existsSync(siblingTalkstore)) return siblingTalkstore
  }

  if (options.optional) return null

  const firstEnvKey = manifest.project_root.env_keys?.[0] || 'COMMAND_CENTER_PROJECT_ROOT'
  throw new Error(
    `Project root is not set for profile "${profileName}". Configure ${firstEnvKey} ` +
    'or provide an explicit project root.'
  )
}

export function resolveTrackerFile(projectRoot, options = {}) {
  const configured = readSetting(['COMMAND_CENTER_TRACKER_FILE', 'TRACKER_FILE'])
  if (configured) return configured

  const profileName = options.profileName ? resolveProfileName(options.profileName) : resolveConsumerProfile(options)
  const manifest = loadProfileManifest(profileName)
  const candidates = [
    manifest.tracker.primary_filename,
    ...(manifest.tracker.compatibility_filenames || []),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(join(projectRoot, candidate))) return candidate
  }

  return manifest.tracker.default_creation_filename || manifest.tracker.primary_filename
}

export function resolveProjectFile(projectRoot, envKeys, candidates, options = {}) {
  const configured = readSetting(envKeys)
  if (configured) return resolveRelativeTo(projectRoot, configured)

  for (const candidate of candidates) {
    const absolute = resolveRelativeTo(projectRoot, candidate)
    if (existsSync(absolute)) return absolute
  }

  if (options.optional) {
    return resolveRelativeTo(projectRoot, candidates[0])
  }

  throw new Error(
    `${options.label || 'Required file'} not found. Checked: ${candidates.join(', ')}`
  )
}

function resolveDocPath(projectRoot, docConfig, options = {}) {
  const configured = readSetting(docConfig.env_keys || [])
  if (configured) return resolveRelativeTo(projectRoot, configured)

  const candidates = [docConfig.default_path]
  if (options.allowCompatibilityFallback) {
    candidates.push(...(docConfig.compatibility_paths || []))
  }

  for (const candidate of candidates) {
    const absolute = resolveRelativeTo(projectRoot, candidate)
    if (existsSync(absolute)) return absolute
  }

  if (docConfig.required === false || options.optional) {
    return resolveRelativeTo(projectRoot, candidates[0])
  }

  throw new Error(
    `${options.label || 'Required file'} not found. Checked: ${candidates.join(', ')}`
  )
}

export function resolveTrackerProjectPaths(options = {}) {
  const profileName = options.profileName ? resolveProfileName(options.profileName) : resolveConsumerProfile(options)
  const projectRoot = resolveProjectRoot({ ...options, profileName })
  const trackerFile = resolveTrackerFile(projectRoot, { ...options, profileName })
  const profileManifest = loadProfileManifest(profileName)
  const profileSource = options.profileName
    ? 'explicit:option'
    : resolveExplicitProfileName(options)
      ? 'explicit:COMMAND_CENTER_PROFILE'
      : resolveProfileByCompatibilitySignals(options)

  return {
    commandCenterRoot: COMMAND_CENTER_ROOT,
    profileName,
    profileSource,
    profileManifest,
    projectRoot,
    trackerFile,
    trackerPath: join(projectRoot, trackerFile),
    analysisDir: readSetting(['COMMAND_CENTER_ANALYSIS_DIR', 'ANALYSIS_DIR']) || DEFAULT_ANALYSIS_DIR,
  }
}

export function resolveProjectPaths(options = {}) {
  const trackerPaths = resolveTrackerProjectPaths(options)
  const docs = trackerPaths.profileManifest.docs || {}

  return {
    ...trackerPaths,
    tasksPath: resolveDocPath(trackerPaths.projectRoot, docs.tasks || {
      default_path: 'docs/roadmap.md',
      compatibility_paths: [],
      env_keys: ['COMMAND_CENTER_TASKS_DOC', 'TASKS_DOC'],
      required: true,
    }, { label: 'Roadmap document' }),
    checklistPath: resolveDocPath(trackerPaths.projectRoot, docs.checklist || {
      default_path: 'docs/submission-checklist.md',
      env_keys: ['COMMAND_CENTER_CHECKLIST_DOC', 'CHECKLIST_DOC'],
      required: false,
    }, { label: 'Submission checklist document', optional: true }),
    manifestoPath: resolveDocPath(trackerPaths.projectRoot, docs.manifesto || {
      default_path: 'docs/manifesto.md',
      env_keys: ['COMMAND_CENTER_MANIFESTO_DOC', 'MANIFESTO_DOC'],
      required: false,
    }, { label: 'Manifesto document', optional: true }),
    roadmapPath: resolveDocPath(trackerPaths.projectRoot, docs.roadmap_optional || {
      default_path: 'docs/roadmap.md',
      required: false,
    }, { label: 'Roadmap document', optional: true }),
  }
}

function parseCliArgs(argv = []) {
  const parsed = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const trimmed = arg.slice(2)
    if (!trimmed) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex >= 0) {
      const key = trimmed.slice(0, equalsIndex)
      const value = trimmed.slice(equalsIndex + 1)
      parsed[key] = value
      continue
    }

    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      parsed[trimmed] = next
      i++
      continue
    }

    parsed[trimmed] = true
  }

  return parsed
}

function readCliOrSetting(cliArgs, cliKeys, envKeys) {
  for (const key of cliKeys) {
    const value = cliArgs[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return readSetting(envKeys)
}

function resolveParserSourceFile(projectRoot, cliArgs, sourceField, options = {}) {
  const configured = readCliOrSetting(cliArgs, sourceField.cli_keys || [], sourceField.env_keys || [])
  if (!configured && sourceField.require_explicit) {
    throw new Error(
      `${options.label} for parser "${options.parserId}" with profile "${options.profileName}" must be set explicitly. ` +
      `Allowed values: ${(sourceField.compatibility_paths && sourceField.compatibility_paths.length > 0
        ? [sourceField.default_path, ...sourceField.compatibility_paths]
        : [sourceField.default_path]).join(' or ')}.`
    )
  }

  const defaultRelativePath = sourceField.default_path
  const allowedRelativePaths = [
    defaultRelativePath,
    ...(sourceField.compatibility_paths || []),
  ]

  const targetPath = resolveRelativeTo(projectRoot, configured || defaultRelativePath)
  const allowedPaths = allowedRelativePaths.map((path) => resolveRelativeTo(projectRoot, path))
  const isAllowed = allowedPaths.some((allowedPath) => resolve(allowedPath) === resolve(targetPath))

  if (!isAllowed) {
    const receivedPath = configured || toProjectRelativePath(projectRoot, targetPath)
    throw new Error(
      `${options.label} for parser "${options.parserId}" with profile "${options.profileName}" must resolve to ` +
      `${allowedRelativePaths.join(' or ')}. Received ${receivedPath}.`
    )
  }

  if (!existsSync(targetPath) && sourceField.required !== false && !sourceField.optional) {
    throw new Error(`${options.label} not found at ${targetPath}.`)
  }

  return targetPath
}

export function resolveParserProjectPaths(options = {}) {
  const { parserId, argv = process.argv.slice(2) } = options

  if (!parserId) {
    throw new Error('resolveParserProjectPaths requires a parserId.')
  }

  const cliArgs = parseCliArgs(argv)
  const profileName = readCliOrSetting(
    cliArgs,
    ['profile', 'parser-profile'],
    ['COMMAND_CENTER_PARSER_PROFILE', 'PARSER_PROFILE']
  ) || PARSER_PROFILE_BY_ID[parserId]

  const profile = PARSER_PROFILES[profileName]
  if (!profile) {
    throw new Error(
      `Unknown parser profile "${profileName}". Expected one of: ${Object.keys(PARSER_PROFILES).join(', ')}.`
    )
  }

  if (!profile.parserIds.includes(parserId)) {
    throw new Error(
      `Parser "${parserId}" cannot run with profile "${profileName}". ` +
      `Use one of: ${profile.parserIds.join(', ')}.`
    )
  }

  const trackerPaths = resolveTrackerProjectPaths(options)
  const profileManifest = trackerPaths.profileManifest
  const paths = {
    commandCenterRoot: COMMAND_CENTER_ROOT,
    consumerProfile: trackerPaths.profileName,
    consumerProfileSource: trackerPaths.profileSource,
    projectRoot: trackerPaths.projectRoot,
    trackerFile: trackerPaths.trackerFile,
    trackerPath: trackerPaths.trackerPath,
    analysisDir: trackerPaths.analysisDir,
    parserProfile: profileName,
  }

  if (parserId === 'talkstore-markdown' || parserId === 'generic-markdown') {
    const sourceFields = profileManifest.parser_defaults?.[parserId]?.source_fields ||
      (parserId === 'generic-markdown'
        ? DEFAULT_GENERIC_MARKDOWN_SOURCE_FIELDS
        : DEFAULT_TALKSTORE_MARKDOWN_SOURCE_FIELDS)

    const labels = parserId === 'generic-markdown'
      ? {
          tasks: 'Project roadmap document',
          checklist: 'Project submission checklist document',
          manifesto: 'Project manifesto document',
        }
      : {
          tasks: 'TalkStore task source document',
          checklist: 'Talkstore submission checklist document',
          manifesto: 'Talkstore manifesto document',
        }

    paths.tasksPath = resolveParserSourceFile(trackerPaths.projectRoot, cliArgs, sourceFields.tasks, {
      label: labels.tasks,
      parserId,
      profileName,
    })
    paths.checklistPath = resolveParserSourceFile(trackerPaths.projectRoot, cliArgs, sourceFields.checklist, {
      label: labels.checklist,
      parserId,
      profileName,
    })
    paths.manifestoPath = resolveParserSourceFile(trackerPaths.projectRoot, cliArgs, sourceFields.manifesto, {
      label: labels.manifesto,
      parserId,
      profileName,
    })
  }

  if (parserId === 'aci-roadmap') {
    paths.aciRoadmapPath = resolveParserSourceFile(trackerPaths.projectRoot, cliArgs, {
      cli_keys: ['aci-roadmap-source', 'roadmap-source'],
      env_keys: ['COMMAND_CENTER_ACI_ROADMAP', 'ACI_ROADMAP_PATH'],
      default_path: 'Brainstorming & Pivot/ROADMAP.md',
      compatibility_paths: ['Brainstorming & Pivot/ROADMAP.md'],
      required: true,
      require_explicit: true,
      optional: false,
    }, {
      label: 'ACI roadmap document',
      parserId,
      profileName,
    })
  }

  return paths
}
