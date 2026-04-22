Run the following checks on all modified files (use `git diff --name-only` to identify them):

1. `npm run typecheck` — TypeScript compilation check
2. `npm run lint` — ESLint
3. For any `.liquid` files: validate Liquid syntax, JSON schema, CSS prefixing
4. For any files in `lib/prompts/`: warn that prompt files were modified (require explicit confirmation)
5. For any files in `lib/templates/sections/`: warn that template library was modified (require explicit confirmation)

Report: all checks pass → ready to commit, or list failures that need fixing.
