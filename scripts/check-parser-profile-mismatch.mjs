#!/usr/bin/env node

import { join } from 'path'
import { REPO_ROOT, assert, ensureDir, tempDir, writeJson, writeText, runNode } from './check-support.mjs'

function makeTalkstoreFixture(root) {
  ensureDir(join(root, 'docs'))
  writeText(join(root, 'docs/tasks.md'), '# THE BUILD ROADMAP\n\n## WEEK 1 - Example\n- [ ] Example task\n')
  writeText(join(root, 'docs/submission-checklist.md'), '## 1. OAuth + Auth\n- ⬜ Example checklist item\n')
  writeText(join(root, 'docs/manifesto.md'), '# Example manifesto\n')
  writeJson(join(root, 'talkstore-tracker.json'), {
    project: {
      parser_profile: 'talkstore',
      parser_id: 'talkstore-markdown',
      parser_source_pairing: 'talkstore-markdown:talkstore',
    },
    milestones: [],
    submission_checklist: { categories: [] },
  })
}

function makeGenericFixture(root) {
  ensureDir(join(root, 'docs'))
  writeText(join(root, 'docs/roadmap.md'), '# THE BUILD ROADMAP\n\n### WEEK 1 - Example\n- [ ] Example task\n')
  writeText(join(root, 'docs/tasks.md'), '# THE BUILD ROADMAP\n\n### WEEK 1 - Legacy Example\n- [ ] Legacy task path\n')
  writeText(join(root, 'docs/submission-checklist.md'), '## 1. OAuth + Auth\n- ⬜ Example checklist item\n')
  writeText(join(root, 'docs/manifesto.md'), '# Example manifesto\n')
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
    milestones: [],
    submission_checklist: { categories: [] },
  })
}

function makeAciFixture(root) {
  ensureDir(join(root, 'Brainstorming & Pivot'))
  writeText(
    join(root, 'Brainstorming & Pivot/ROADMAP.md'),
    [
      '## M1 \u2014 Example Roadmap',
      '',
      '**Goal:** mismatch test.',
      '',
      '- **Tasks:**',
      '- **T1.1 \u2014 Example task**',
      '  - **What:** example',
      '  - **Why:** example',
      '  - **Acceptance:** example',
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
    milestones: [],
    submission_checklist: { categories: [] },
  })
}

function assertFailure(result, expectedMessagePart) {
  assert(result.status !== 0, 'expected command to fail')
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`
  assert(combined.includes(expectedMessagePart), `expected output to include: ${expectedMessagePart}`)
  assert(!/\n\s*at\s+/.test(result.stderr || ''), 'expected an operator-readable failure without a stack trace')
}

async function main() {
  const workspace = tempDir()
  const talkstoreRoot = join(workspace, 'talkstore-project')
  const genericRoot = join(workspace, 'generic-project')
  const aciRoot = join(workspace, 'aci-project')
  ensureDir(talkstoreRoot)
  ensureDir(genericRoot)
  ensureDir(aciRoot)
  makeTalkstoreFixture(talkstoreRoot)
  makeGenericFixture(genericRoot)
  makeAciFixture(aciRoot)

  const mismatchTalkstore = runNode(
    [
      'scripts/parse-markdown.mjs',
      '--profile=aci',
      '--tasks-source=docs/tasks.md',
      '--checklist-source=docs/submission-checklist.md',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: talkstoreRoot,
        COMMAND_CENTER_TRACKER_FILE: 'talkstore-tracker.json',
        COMMAND_CENTER_TASKS_DOC: 'docs/tasks.md',
        COMMAND_CENTER_CHECKLIST_DOC: 'docs/submission-checklist.md',
        COMMAND_CENTER_MANIFESTO_DOC: 'docs/manifesto.md',
      },
      expectStatus: 1,
      label: 'parse-markdown profile mismatch',
    }
  )
  assertFailure(
    mismatchTalkstore,
    'No markdown parser is registered for profile "aci". Supported markdown parser profiles: generic, talkstore.'
  )

  const sourceMismatchTalkstore = runNode(
    [
      'scripts/parse-markdown.mjs',
      '--profile=talkstore',
      '--tasks-source=docs/not-a-source.md',
      '--checklist-source=docs/submission-checklist.md',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: talkstoreRoot,
        COMMAND_CENTER_TRACKER_FILE: 'talkstore-tracker.json',
      },
      expectStatus: 1,
      label: 'parse-markdown source mismatch',
    }
  )
  assertFailure(sourceMismatchTalkstore, 'TalkStore task source document for parser "talkstore-markdown" with profile "talkstore" must resolve')

  const sourceMismatchGeneric = runNode(
    [
      'scripts/parse-markdown.mjs',
      '--consumer-profile=generic',
      '--profile=generic',
      '--tasks-source=docs/not-a-source.md',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: genericRoot,
        COMMAND_CENTER_TRACKER_FILE: 'command-center-tracker.json',
      },
      expectStatus: 1,
      label: 'parse-markdown generic source mismatch',
    }
  )
  assertFailure(sourceMismatchGeneric, 'Project roadmap document for parser "generic-markdown" with profile "generic" must resolve')

  const legacyTasksPathRejected = runNode(
    [
      'scripts/parse-markdown.mjs',
      '--consumer-profile=generic',
      '--profile=generic',
      '--tasks-source=docs/tasks.md',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: genericRoot,
        COMMAND_CENTER_TRACKER_FILE: 'command-center-tracker.json',
      },
      expectStatus: 1,
      label: 'parse-markdown legacy tasks path rejected',
    }
  )
  assertFailure(legacyTasksPathRejected, 'must resolve to docs/roadmap.md')

  const legacyGenericMigration = runNode(
    [
      'scripts/parse-markdown.mjs',
      '--consumer-profile=generic',
      '--profile=generic',
      '--tasks-source=docs/roadmap.md',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: genericRoot,
        COMMAND_CENTER_TRACKER_FILE: 'command-center-tracker.json',
      },
      expectStatus: 0,
      label: 'parse-markdown legacy generic migration',
    }
  )
  assert(
    (legacyGenericMigration.stdout || '').includes('Parser/source pairing: generic-markdown:generic'),
    'generic parser should allow legacy public trackers stamped with TalkStore metadata to restamp to the generic pairing'
  )

  const existingTrackerMismatch = runNode(
    [
      'scripts/seed-aci-checklist.mjs',
      '--profile=aci',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: talkstoreRoot,
        COMMAND_CENTER_TRACKER_FILE: 'talkstore-tracker.json',
      },
      expectStatus: 1,
      label: 'seed-aci-checklist tracker mismatch',
    }
  )
  assertFailure(existingTrackerMismatch, 'seed-aci-checklist requires parser_profile="aci". Found "talkstore".')

  const mismatchAci = runNode(
    [
      'scripts/parse-aci-roadmap.mjs',
      '--profile=talkstore',
      '--aci-roadmap-source=Brainstorming & Pivot/ROADMAP.md',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: aciRoot,
        COMMAND_CENTER_TRACKER_FILE: 'talkstore-tracker.json',
      },
      expectStatus: 1,
      label: 'parse-aci-roadmap profile mismatch',
    }
  )
  assertFailure(mismatchAci, 'Parser "aci-roadmap" cannot run with profile "talkstore".')

  const sourceMismatchAci = runNode(
    [
      'scripts/parse-aci-roadmap.mjs',
      '--profile=aci',
      '--aci-roadmap-source=Brainstorming & Pivot/NOT-ROADMAP.md',
      '--dry-run',
    ],
    {
      cwd: REPO_ROOT,
      env: {
        COMMAND_CENTER_PROJECT_ROOT: aciRoot,
        COMMAND_CENTER_TRACKER_FILE: 'talkstore-tracker.json',
      },
      expectStatus: 1,
      label: 'parse-aci-roadmap source mismatch',
    }
  )
  assertFailure(sourceMismatchAci, 'ACI roadmap document for parser "aci-roadmap" with profile "aci" must resolve')

  console.log('parser/profile mismatch checks passed')
  console.log(`workspace: ${workspace}`)
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
