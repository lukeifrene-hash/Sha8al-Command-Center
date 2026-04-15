import { execFile } from 'child_process'
import { TALKSTORE_ROOT } from './config'

export type GitResult =
  | { status: 'success'; message: string; branch: string; filesChanged: number }
  | { status: 'nothing' }
  | { status: 'error'; error: string }

function git(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: TALKSTORE_ROOT, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

function detectDomains(files: string[]): string[] {
  const domainMap: Record<string, string> = {
    'app/lib/ai/': 'ai',
    'app/components/': 'ui',
    'app/lib/shopify/': 'shopify',
    'app/lib/db/': 'db',
    'app/routes/': 'routes',
    'docs/': 'docs',
    'prisma/': 'db',
  }
  const found = new Set<string>()
  for (const file of files) {
    let matched = false
    for (const [prefix, domain] of Object.entries(domainMap)) {
      if (file.startsWith(prefix) || file.includes('/' + prefix)) {
        found.add(domain)
        matched = true
        break
      }
    }
    if (!matched) found.add('chore')
  }
  return [...found]
}

function generateCommitMessage(statusOutput: string): string {
  const lines = statusOutput.split('\n').filter(Boolean)
  const files = lines.map((l) => l.slice(3).trim())

  let added = 0, modified = 0, deleted = 0
  for (const line of lines) {
    const code = line.slice(0, 2)
    if (code.includes('?') || code.includes('A')) added++
    else if (code.includes('D')) deleted++
    else modified++
  }

  let verb: string
  if (deleted > added && deleted > modified) verb = 'chore'
  else if (added > modified) verb = 'feat'
  else verb = 'update'

  const domains = detectDomains(files)
  const choreDomains = domains.filter((d) => d !== 'chore')

  if (choreDomains.length === 0) {
    return 'chore: update config and project files'
  }
  if (choreDomains.length === 1) {
    const domain = choreDomains[0]
    const count = files.length
    if (deleted > added && deleted > modified) {
      return `chore(${domain}): clean up ${count} file${count > 1 ? 's' : ''}`
    }
    return `${verb}(${domain}): update ${count} file${count > 1 ? 's' : ''}`
  }

  const summary = choreDomains.slice(0, 3).join(', ')
  return `${verb}: update ${summary}${choreDomains.length > 3 ? ' and more' : ''}`
}

export async function commitAndPush(): Promise<GitResult> {
  try {
    const status = await git(['status', '--porcelain'])
    if (!status.trim()) {
      return { status: 'nothing' }
    }

    const message = generateCommitMessage(status)
    await git(['add', '-A'])
    await git(['commit', '-m', message])

    const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    await git(['push', 'origin', branch])

    const filesChanged = status.split('\n').filter(Boolean).length
    return { status: 'success', message, branch, filesChanged }
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) }
  }
}
