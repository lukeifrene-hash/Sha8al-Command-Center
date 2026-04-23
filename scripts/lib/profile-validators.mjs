import { existsSync } from 'fs'
import { relative, resolve, sep } from 'path'

const PARSER_PAIRINGS = {
  'generic-markdown': {
    parserProfile: 'generic',
    sourceFields: [
      { key: 'tasks', pathKey: 'tasksPath', metadataKey: 'tasks_source' },
      { key: 'checklist', pathKey: 'checklistPath', metadataKey: 'checklist_source', optional: true },
      { key: 'manifesto', pathKey: 'manifestoPath', metadataKey: 'manifesto_source', optional: true },
    ],
  },
  'talkstore-markdown': {
    parserProfile: 'talkstore',
    sourceFields: [
      { key: 'tasks', pathKey: 'tasksPath', metadataKey: 'tasks_source' },
      { key: 'checklist', pathKey: 'checklistPath', metadataKey: 'checklist_source' },
      { key: 'manifesto', pathKey: 'manifestoPath', metadataKey: 'manifesto_source', optional: true },
    ],
  },
  'aci-roadmap': {
    parserProfile: 'aci',
    sourceFields: [
      { key: 'roadmap', pathKey: 'aciRoadmapPath', metadataKey: 'roadmap_source' },
      { key: 'manifesto', pathKey: 'manifestoPath', metadataKey: 'manifesto_source', optional: true },
    ],
  },
}

function toProjectRelativePath(projectRoot, targetPath) {
  if (!targetPath) return null

  const relativePath = relative(resolve(projectRoot), resolve(targetPath))
  if (!relativePath || relativePath.startsWith('..')) return resolve(targetPath)

  return relativePath.split(sep).join('/')
}

function allowsLegacyPublicGenericMigration({ parserId, projectPaths, existingProject }) {
  if (parserId !== 'generic-markdown') return false
  if (projectPaths.consumerProfile !== 'generic') return false
  if (!existingProject) return false

  const legacyParserId = existingProject.parser_id || 'talkstore-markdown'
  const legacyParserProfile = existingProject.parser_profile || 'talkstore'
  const legacyPairing =
    existingProject.parser_source_pairing ||
    `${legacyParserId}:${legacyParserProfile}`

  return (
    legacyParserId === 'talkstore-markdown' &&
    legacyParserProfile === 'talkstore' &&
    legacyPairing === 'talkstore-markdown:talkstore'
  )
}

export function validateParserProfilePairing({
  parserId,
  projectPaths,
  existingProject = null,
  sourceOverrides = {},
}) {
  const pairing = PARSER_PAIRINGS[parserId]
  if (!pairing) throw new Error(`No parser/source pairing registered for "${parserId}".`)

  if (projectPaths.parserProfile !== pairing.parserProfile) {
    throw new Error(
      `Parser "${parserId}" must run with profile "${pairing.parserProfile}". ` +
      `Resolved profile: "${projectPaths.parserProfile}".`
    )
  }

  const expectedPairing = `${parserId}:${pairing.parserProfile}`
  const existingTrackerIsStamped = Boolean(
    existingProject?.parser_id ||
    existingProject?.parser_profile ||
    existingProject?.parser_source_pairing ||
    existingProject?.source_files
  )
  const allowLegacyMigration = allowsLegacyPublicGenericMigration({
    parserId,
    projectPaths,
    existingProject,
  })

  if (existingProject?.parser_id && existingProject.parser_id !== parserId && !allowLegacyMigration) {
    throw new Error(
      `Tracker is already stamped with parser_id="${existingProject.parser_id}". ` +
      `Refusing to switch to "${parserId}".`
    )
  }

  if (existingProject?.parser_profile && existingProject.parser_profile !== pairing.parserProfile && !allowLegacyMigration) {
    throw new Error(
      `Tracker is already stamped with parser_profile="${existingProject.parser_profile}". ` +
      `Expected "${pairing.parserProfile}".`
    )
  }

  if (existingProject?.parser_source_pairing && existingProject.parser_source_pairing !== expectedPairing && !allowLegacyMigration) {
    throw new Error(
      `Tracker is already stamped with parser_source_pairing="${existingProject.parser_source_pairing}". ` +
      `Expected "${expectedPairing}".`
    )
  }

  const sourceFiles = {}
  const projectMetadata = {
    parser_id: parserId,
    parser_profile: pairing.parserProfile,
    parser_source_pairing: expectedPairing,
  }

  for (const field of pairing.sourceFields) {
    const sourcePath = sourceOverrides[field.key] || projectPaths[field.pathKey] || null
    if (!sourcePath) {
      if (!field.optional) {
        throw new Error(`Missing source path "${field.pathKey}" for parser "${parserId}".`)
      }
      continue
    }

    if (field.optional && !existsSync(sourcePath)) continue

    const relativePath = toProjectRelativePath(projectPaths.projectRoot, sourcePath)
    const existingRelativePath =
      existingProject?.[field.metadataKey] ||
      existingProject?.source_files?.[field.key] ||
      null

    if (existingTrackerIsStamped && existingRelativePath && existingRelativePath !== relativePath) {
      throw new Error(
        `Tracker is already stamped with ${field.metadataKey}="${existingRelativePath}". ` +
        `Expected "${relativePath}" for parser "${parserId}".`
      )
    }

    sourceFiles[field.key] = relativePath
    projectMetadata[field.metadataKey] = relativePath
  }

  projectMetadata.source_files = sourceFiles

  return {
    parserId,
    parserProfile: pairing.parserProfile,
    parserSourcePairing: expectedPairing,
    sourceFiles,
    projectMetadata,
  }
}

export function validateExistingTrackerProfile({
  expectedProfile,
  existingProject = null,
  operationLabel,
}) {
  if (!existingProject?.parser_profile) {
    throw new Error(
      `${operationLabel} requires an existing tracker stamped with parser_profile="${expectedProfile}".`
    )
  }

  if (existingProject.parser_profile !== expectedProfile) {
    throw new Error(
      `${operationLabel} requires parser_profile="${expectedProfile}". ` +
      `Found "${existingProject.parser_profile}".`
    )
  }
}
