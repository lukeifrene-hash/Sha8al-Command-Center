#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { createTrackerBackup, getTrackerBackupPath, writeTrackerJsonWithBackup } from './lib/tracker-backup.mjs'
import { assert, ensureDir, tempDir, writeJson } from './check-support.mjs'

function main() {
  const workspace = tempDir()
  const trackerPath = join(workspace, 'tracker.json')
  const originalTracker = {
    project: {
      parser_profile: 'talkstore',
      parser_id: 'talkstore-markdown',
      parser_source_pairing: 'talkstore-markdown:talkstore',
    },
    milestones: [],
    submission_checklist: { categories: [] },
  }
  const changedTracker = {
    ...originalTracker,
    project: {
      ...originalTracker.project,
      parser_profile: 'aci',
    },
  }

  ensureDir(workspace)
  writeJson(trackerPath, originalTracker)

  const unchanged = writeTrackerJsonWithBackup({
    targetPath: trackerPath,
    tracker: originalTracker,
    label: 'backup-check',
  })
  assert(unchanged.changed === false, 'unchanged write should not be treated as a change')
  assert(unchanged.wrote === false, 'unchanged write should not write')
  assert(unchanged.backupPath === null, 'unchanged write should not create a backup')
  assert(readFileSync(trackerPath, 'utf8').endsWith('\n'), 'tracker file should remain untouched')

  const dryRun = writeTrackerJsonWithBackup({
    targetPath: trackerPath,
    tracker: changedTracker,
    dryRun: true,
    label: 'backup-check',
  })
  assert(dryRun.changed === true, 'dry-run should still detect a pending change')
  assert(dryRun.wrote === false, 'dry-run should not write')
  assert(dryRun.backupPath === null, 'dry-run should not create a backup')

  const expectedBackupPath = getTrackerBackupPath(trackerPath, {
    label: 'backup-check',
    timestamp: new Date('2026-04-22T00:00:00.000Z'),
  })
  assert(typeof expectedBackupPath === 'string', 'backup path helper should return a string')

  const changed = writeTrackerJsonWithBackup({
    targetPath: trackerPath,
    tracker: changedTracker,
    label: 'backup-check',
  })
  assert(changed.changed === true, 'changed write should detect a change')
  assert(changed.wrote === true, 'changed write should write')
  assert(changed.backupPath !== null, 'changed write should create a backup')
  assert(existsSync(changed.backupPath), 'backup file should exist after a changed write')
  assert(readFileSync(changed.backupPath, 'utf8') === JSON.stringify(originalTracker, null, 2) + '\n', 'backup should contain the pre-write tracker content')
  assert(readFileSync(trackerPath, 'utf8') === JSON.stringify(changedTracker, null, 2) + '\n', 'tracker should contain the new tracker content')

  const manualBackup = createTrackerBackup(trackerPath, {
    label: 'manual-check',
  })
  assert(manualBackup !== null, 'createTrackerBackup should return a backup path when the target exists')
  assert(existsSync(manualBackup), 'manual backup should exist')

  console.log('backup behavior checks passed')
  console.log(`workspace: ${workspace}`)
}

main()

