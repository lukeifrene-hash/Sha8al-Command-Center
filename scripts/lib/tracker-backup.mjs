import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { assertTrackerWriteAllowed } from './project-paths.mjs'

export const DEFAULT_TRACKER_BACKUP_DIR_NAME = '.command-center-backups'

function sanitizeBackupLabel(label) {
  return String(label || 'tracker-write')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tracker-write'
}

function formatBackupTimestamp(date = new Date()) {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z')
}

export function serializeTrackerJson(tracker) {
  return JSON.stringify(tracker, null, 2) + '\n'
}

export function getTrackerBackupPath(targetPath, options = {}) {
  const extension = extname(targetPath) || '.json'
  const filename = basename(targetPath, extension)
  const backupDir = options.backupDir || join(dirname(targetPath), DEFAULT_TRACKER_BACKUP_DIR_NAME)
  const timestamp = formatBackupTimestamp(options.timestamp)
  const label = sanitizeBackupLabel(options.label)

  return join(backupDir, `${filename}.${timestamp}.${label}.bak${extension}`)
}

export function createTrackerBackup(targetPath, options = {}) {
  if (!existsSync(targetPath)) return null

  const backupPath = getTrackerBackupPath(targetPath, options)
  mkdirSync(dirname(backupPath), { recursive: true })
  writeFileSync(backupPath, readFileSync(targetPath, 'utf8'), 'utf8')

  return backupPath
}

export function writeTrackerJsonWithBackup({ targetPath, tracker, dryRun = false, label = 'tracker-write' }) {
  const serialized = serializeTrackerJson(tracker)
  const existingContent = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null
  const changed = existingContent !== serialized

  if (!changed) {
    return {
      changed: false,
      wrote: false,
      backupPath: null,
    }
  }

  if (dryRun) {
    return {
      changed: true,
      wrote: false,
      backupPath: null,
    }
  }

  assertTrackerWriteAllowed(targetPath)
  const backupPath = createTrackerBackup(targetPath, { label })
  writeFileSync(targetPath, serialized, 'utf8')

  return {
    changed: true,
    wrote: true,
    backupPath,
  }
}
