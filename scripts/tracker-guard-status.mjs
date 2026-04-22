#!/usr/bin/env node

import { getTrackerWriteGuardError, resolveProjectPaths } from './lib/project-paths.mjs'

const paths = resolveProjectPaths()
const guard = getTrackerWriteGuardError(paths.trackerPath)

console.log('Sha8al Command Center — Tracker Guard Status')
console.log('='.repeat(48))
console.log(`Consumer profile: ${paths.profileName}`)
console.log(`Project root: ${paths.projectRoot}`)
console.log(`Tracker path: ${paths.trackerPath}`)
console.log(`Script writes allowed: ${guard ? 'false' : 'true'}`)

if (guard) {
  console.log(`Reason: ${guard}`)
} else {
  console.log('Reason: script-side tracker writes are allowed for the current target.')
}
