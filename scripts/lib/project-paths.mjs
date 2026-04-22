import { join, resolve } from 'path'

import {
  COMMAND_CENTER_ROOT,
  loadProfileManifest,
  loadProfileManifests,
  readSetting,
  resolveConsumerProfile,
  resolveParserProjectPaths,
  resolveProjectFile,
  resolveProjectPaths,
  resolveProjectRoot,
  resolveProfileName,
  resolveProfileNameFromCliAlias,
  resolveProfileNameFromTrackerFile,
  resolveRelativeTo,
  resolveTrackerFile,
  resolveTrackerProjectPaths,
  toProjectRelativePath,
} from './profile-manifests.mjs'

export {
  COMMAND_CENTER_ROOT,
  loadProfileManifest,
  loadProfileManifests,
  readSetting,
  resolveConsumerProfile,
  resolveParserProjectPaths,
  resolveProjectFile,
  resolveProjectPaths,
  resolveProjectRoot,
  resolveProfileName,
  resolveProfileNameFromCliAlias,
  resolveProfileNameFromTrackerFile,
  resolveRelativeTo,
  resolveTrackerFile,
  resolveTrackerProjectPaths,
  toProjectRelativePath,
}

function parseBooleanSetting(value) {
  if (!value) return null

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false
    default:
      return null
  }
}

export function getTrackerWriteGuardError(targetPath) {
  const configuredAllowance = parseBooleanSetting(
    readSetting(['COMMAND_CENTER_ALLOW_TRACKER_WRITES', 'ALLOW_TRACKER_WRITES'])
  )
  const liveTalkstoreTrackerPath = join(
    resolve(COMMAND_CENTER_ROOT, '..', 'talkstore'),
    'talkstore-tracker.json'
  )
  const writesBlockedByDefault = resolve(targetPath) === resolve(liveTalkstoreTrackerPath)
  const writesAllowed = configuredAllowance ?? !writesBlockedByDefault

  if (writesAllowed) return null

  return configuredAllowance === false
    ? `Tracker writes are disabled by configuration for ${targetPath}.`
    : `Writes to ${targetPath} are blocked by default to protect the live TalkStore tracker. Set COMMAND_CENTER_ALLOW_TRACKER_WRITES=true to override intentionally.`

}

export function assertTrackerWriteAllowed(targetPath) {
  const error = getTrackerWriteGuardError(targetPath)
  if (error) throw new Error(error)
}
