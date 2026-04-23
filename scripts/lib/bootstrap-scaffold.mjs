import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const STARTER_DOCS = {
  'docs/roadmap.md': `# THE BUILD ROADMAP

### WEEK 1 — Bootstrap the project
- [ ] Confirm bootstrap resolves the public \`generic\` profile
- [ ] Review and replace these starter roadmap tasks with your real milestone plan
- [ ] Dry-run the parser before the first tracker write

### WEEK 2 — First execution pass
- [ ] Generate the tracker from \`docs/roadmap.md\`
- [ ] Open the swim lane and task board against the generated tracker
- [ ] Prepare prompts for the non-small work
`,
  'docs/manifesto.md': `# Project Manifesto

This project uses Sha8al Command Center as a local tracker-driven workflow.

## Principles

- Keep \`docs/roadmap.md\` as the task source of truth.
- Keep the tracker local and file-based.
- Dry-run before every tracker write.
- Expand the roadmap before real build work begins.
`,
}

export function scaffoldGenericStarterDocs(projectRoot) {
  const created = []
  const existing = []
  const roadmapMissing = !existsSync(join(projectRoot, 'docs/roadmap.md'))
  const targets = roadmapMissing
    ? [
        ['docs/roadmap.md', STARTER_DOCS['docs/roadmap.md']],
        ['docs/manifesto.md', STARTER_DOCS['docs/manifesto.md']],
      ]
    : []

  for (const [relativePath, content] of targets) {
    const absolutePath = join(projectRoot, relativePath)
    if (existsSync(absolutePath)) {
      existing.push(relativePath)
      continue
    }

    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, content, 'utf8')
    created.push(relativePath)
  }

  return { created, existing }
}
