import { join } from 'path'
import { readFileSync } from 'fs'

/**
 * Resolve the Talkstore project root from:
 *  1. TALKSTORE_PROJECT_ROOT env var
 *  2. .env file in the command-center root
 */
function resolveProjectRoot(): string {
  if (process.env.TALKSTORE_PROJECT_ROOT) {
    return process.env.TALKSTORE_PROJECT_ROOT
  }

  // Try loading from .env file
  try {
    const envPath = join(__dirname, '../../.env')
    const envContent = readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed) continue
      const match = trimmed.match(/^TALKSTORE_PROJECT_ROOT\s*=\s*(.+)$/)
      if (match) return match[1].trim()
    }
  } catch {
    // .env not found
  }

  throw new Error(
    'TALKSTORE_PROJECT_ROOT is not set. Create a .env file with TALKSTORE_PROJECT_ROOT=/path/to/talkstore'
  )
}

export const TALKSTORE_ROOT = resolveProjectRoot()

export const TRACKER_PATH = join(TALKSTORE_ROOT, 'talkstore-tracker.json')

export const DOCS_PATHS = {
  roadmap: join(TALKSTORE_ROOT, 'docs/tasks.md'),
  checklist: join(TALKSTORE_ROOT, 'docs/submission-checklist.md'),
}
