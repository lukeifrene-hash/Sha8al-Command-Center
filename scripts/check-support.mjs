import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { spawnSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
export const REPO_ROOT = resolve(dirname(__filename), '..')

export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function tempDir(prefix = 'sha8al-command-center-check-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

export function writeText(path, content) {
  ensureDir(dirname(path))
  writeFileSync(path, content, 'utf8')
}

export function writeJson(path, value) {
  writeText(path, JSON.stringify(value, null, 2) + '\n')
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function removePath(path) {
  rmSync(path, { recursive: true, force: true })
}

export function runNode(args, options = {}) {
  const {
    cwd = REPO_ROOT,
    env = {},
    expectStatus = 0,
    label = args.join(' '),
  } = options

  const result = spawnSync(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })

  if ((result.status ?? 0) !== expectStatus) {
    const stdout = result.stdout?.trim() || '(empty)'
    const stderr = result.stderr?.trim() || '(empty)'
    throw new Error(
      `${label} exited with ${result.status}\n` +
      `stdout:\n${stdout}\n\nstderr:\n${stderr}`
    )
  }

  return result
}

export async function withTempEnv(overrides, fn) {
  const previous = new Map()

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined)
    if (value === undefined || value === null) delete process.env[key]
    else process.env[key] = value
  }

  try {
    return await fn()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}
