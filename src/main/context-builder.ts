/**
 * Sha8al Command Center — Context Builder
 *
 * Auto-assembles task context from git history, previous similar tasks,
 * and active agent threads. Provides intelligent context injection for
 * agents before they start working on a task.
 *
 * This module powers the "Intelligent Context & Memory" feature from the
 * redesign plan, providing:
 * - Context Builder: auto-assemble task context
 * - Agent Memory Bank: per-agent learning across sessions
 * - Auto-Prompt Engineering: suggest prompt improvements
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskContext {
  taskId: string
  taskLabel: string
  milestoneTitle: string
  domain: string
  complexity: string
  relatedFiles: string[]
  recentGitActivity: GitActivity[]
  similarTasks: SimilarTask[]
  agentMemory: AgentMemoryEntry[]
  suggestedPrompt: string
  contextSummary: string
}

export interface GitActivity {
  hash: string
  message: string
  author: string
  date: string
  files: string[]
}

export interface SimilarTask {
  taskId: string
  label: string
  similarity: number
  outcome: 'completed' | 'failed' | 'blocked'
  completionTime?: string
}

export interface AgentMemoryEntry {
  agentId: string
  pattern: string
  learnedAt: string
  relevance: number
  context: string
}

export interface PromptSuggestion {
  original: string
  improved: string
  reason: string
}

// ─── Context Builder ──────────────────────────────────────────────────────────

export class ContextBuilder {
  private projectRoot: string | null = null
  private memoryDir: string | null = null

  setProjectRoot(root: string): void {
    this.projectRoot = root
    this.memoryDir = join(root, '.sha8al', 'memory')
    mkdirSync(this.memoryDir, { recursive: true })
  }

  /**
   * Build a complete context package for a task.
   */
  buildContext(params: {
    taskId: string
    taskLabel: string
    milestoneTitle: string
    domain: string
    complexity: string
    prompt?: string
    contextFiles?: string[]
  }): TaskContext {
    const relatedFiles = this.resolveRelatedFiles(params.taskLabel, params.contextFiles)
    const recentGitActivity = this.getRecentGitActivity(relatedFiles)
    const similarTasks = this.findSimilarTasks(params.taskLabel, params.domain)
    const agentMemory = this.getAgentMemory(params.domain, params.complexity)
    const suggestedPrompt = this.suggestPrompt(params.prompt ?? params.taskLabel, similarTasks, agentMemory)

    const contextSummary = this.buildSummary(params, relatedFiles, recentGitActivity, similarTasks)

    return {
      taskId: params.taskId,
      taskLabel: params.taskLabel,
      milestoneTitle: params.milestoneTitle,
      domain: params.domain,
      complexity: params.complexity,
      relatedFiles,
      recentGitActivity,
      similarTasks,
      agentMemory,
      suggestedPrompt,
      contextSummary,
    }
  }

  /**
   * Store a learning entry in the agent memory bank.
   */
  storeMemory(agentId: string, pattern: string, context: string, relevance: number): void {
    if (!this.memoryDir) return

    const entry: AgentMemoryEntry = {
      agentId,
      pattern,
      learnedAt: new Date().toISOString(),
      relevance,
      context,
    }

    const memoryFile = join(this.memoryDir, `${agentId}-memory.json`)
    const existing: AgentMemoryEntry[] = existsSync(memoryFile)
      ? JSON.parse(readFileSync(memoryFile, 'utf-8'))
      : []

    // Avoid duplicates
    if (!existing.some((e) => e.pattern === pattern && e.context === context)) {
      existing.push(entry)
      // Keep only last 100 entries per agent
      const trimmed = existing.slice(-100)
      writeFileSync(memoryFile, JSON.stringify(trimmed, null, 2), 'utf-8')
    }
  }

  /**
   * Suggest prompt improvements based on audit failure patterns.
   */
  suggestPromptImprovements(originalPrompt: string, failurePatterns: string[]): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = []

    if (!originalPrompt || originalPrompt.length < 20) {
      suggestions.push({
        original: originalPrompt,
        improved: `${originalPrompt}\n\nAcceptance criteria:\n- [Add specific measurable criteria]`,
        reason: 'Prompt is too short — add acceptance criteria',
      })
    }

    if (failurePatterns.some((p) => p.includes('missing error handling'))) {
      suggestions.push({
        original: originalPrompt,
        improved: `${originalPrompt}\n\nEnsure proper error handling with try/catch and user-facing error messages.`,
        reason: 'Previous failures indicate missing error handling',
      })
    }

    if (failurePatterns.some((p) => p.includes('missing tests'))) {
      suggestions.push({
        original: originalPrompt,
        improved: `${originalPrompt}\n\nInclude unit tests covering the main logic paths.`,
        reason: 'Previous failures indicate missing tests',
      })
    }

    if (failurePatterns.some((p) => p.includes('no type safety'))) {
      suggestions.push({
        original: originalPrompt,
        improved: `${originalPrompt}\n\nUse TypeScript strict mode with proper type annotations.`,
        reason: 'Previous failures indicate type safety issues',
      })
    }

    return suggestions
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private resolveRelatedFiles(taskLabel: string, explicitFiles?: string[]): string[] {
    const files = [...(explicitFiles ?? [])]

    if (!this.projectRoot) return files

    // Try to find files mentioned in the task label
    const filePatterns = taskLabel.match(/[\w/.-]+\.(ts|tsx|js|jsx|py|rs|go|swift)/g) ?? []
    for (const pattern of filePatterns) {
      try {
        const result = execSync(`find ${this.projectRoot}/src -name "${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 5000,
          maxBuffer: 1024 * 1024,
        }).trim()
        if (result) files.push(...result.split('\n').filter(Boolean))
      } catch {
        // find may fail, ignore
      }
    }

    // Deduplicate
    return [...new Set(files)].slice(0, 20)
  }

  private getRecentGitActivity(relatedFiles: string[]): GitActivity[] {
    if (!this.projectRoot) return []

    try {
      const log = execSync(
        `git log --oneline --max-count=20 --format="%H|%s|%an|%aI" -- ${relatedFiles.join(' ')}`,
        {
          encoding: 'utf-8',
          timeout: 10000,
          maxBuffer: 1024 * 1024,
          cwd: this.projectRoot,
        }
      ).trim()

      if (!log) return []

      return log.split('\n').map((line) => {
        const [hash, message, author, date] = line.split('|')
        let files: string[] = []
        try {
          const diff = execSync(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
            encoding: 'utf-8',
            timeout: 5000,
            maxBuffer: 512 * 1024,
            cwd: this.projectRoot!,
          }).trim()
          files = diff.split('\n').filter(Boolean)
        } catch {
          // ignore
        }

        return { hash, message, author, date, files }
      })
    } catch {
      return []
    }
  }

  private findSimilarTasks(taskLabel: string, domain: string): SimilarTask[] {
    // Simple keyword-based similarity matching
    // In production, this would use vector embeddings (sqlite-vss)
    const keywords = taskLabel.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    if (keywords.length === 0) return []

    // For now, return empty — the tracker data would be queried here
    // when connected to the live tracker state
    return []
  }

  private getAgentMemory(domain: string, complexity: string): AgentMemoryEntry[] {
    if (!this.memoryDir) return []

    const allMemory: AgentMemoryEntry[] = []

    try {
      const { readdirSync } = require('fs')
      const files = readdirSync(this.memoryDir).filter((f: string) => f.endsWith('-memory.json'))

      for (const file of files) {
        try {
          const entries: AgentMemoryEntry[] = JSON.parse(
            readFileSync(join(this.memoryDir!, file), 'utf-8')
          )
          // Filter by domain/complexity relevance
          allMemory.push(
            ...entries.filter((e) =>
              e.context.toLowerCase().includes(domain.toLowerCase()) ||
              e.context.toLowerCase().includes(complexity.toLowerCase())
            )
          )
        } catch {
          // ignore corrupt files
        }
      }
    } catch {
      // fs.readdirSync may fail
    }

    return allMemory
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10)
  }

  private suggestPrompt(
    original: string,
    similarTasks: SimilarTask[],
    agentMemory: AgentMemoryEntry[]
  ): string {
    let prompt = original

    // Add context from similar tasks
    const failedSimilar = similarTasks.filter((t) => t.outcome === 'failed')
    if (failedSimilar.length > 0) {
      prompt += `\n\nNote: ${failedSimilar.length} similar task(s) previously failed. Review their patterns carefully.`
    }

    // Add context from agent memory
    const highRelevanceMemory = agentMemory.filter((m) => m.relevance >= 0.7)
    if (highRelevanceMemory.length > 0) {
      prompt += '\n\nLearned patterns:\n'
      for (const mem of highRelevanceMemory.slice(0, 3)) {
        prompt += `- ${mem.pattern}\n`
      }
    }

    return prompt
  }

  private buildSummary(
    params: { taskId: string; taskLabel: string; milestoneTitle: string; domain: string; complexity: string },
    relatedFiles: string[],
    gitActivity: GitActivity[],
    similarTasks: SimilarTask[]
  ): string {
    const parts: string[] = []

    parts.push(`Task: ${params.taskLabel}`)
    parts.push(`Milestone: ${params.milestoneTitle}`)
    parts.push(`Domain: ${params.domain} · Complexity: ${params.complexity}`)

    if (relatedFiles.length > 0) {
      parts.push(`Related files: ${relatedFiles.slice(0, 5).join(', ')}${relatedFiles.length > 5 ? ` +${relatedFiles.length - 5} more` : ''}`)
    }

    if (gitActivity.length > 0) {
      parts.push(`Recent activity: ${gitActivity.length} commits touching related files`)
    }

    if (similarTasks.length > 0) {
      const failed = similarTasks.filter((t) => t.outcome === 'failed').length
      if (failed > 0) {
        parts.push(`⚠ ${failed} similar task(s) previously failed`)
      }
    }

    return parts.join('\n')
  }
}

// Singleton
export const contextBuilder = new ContextBuilder()
