/**
 * Sha8al Command Center — Dynamic Project Configuration
 *
 * Schema-driven project model. Each workspace declares its own lanes,
 * phases, domains, audit rules, and agent roster in sha8al.config.yaml.
 *
 * This replaces the hardcoded MILESTONE_META, DEPENDENCY_MAP,
 * CHECKLIST_CATEGORY_MAP, and phase constants from parser.ts.
 */

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import YAML from 'js-yaml'

// ─── Config Schema ───────────────────────────────────────────────────────────

export interface ProjectLane {
  id: string
  label: string
  color: string
  description?: string
}

export interface ProjectPhase {
  id: string
  title: string
  color: string
  start_week: number
  end_week: number
}

export interface AuditRule {
  id: string
  category: string
  label: string
  severity: 'optional' | 'required' | 'critical'
}

export interface AgentDefinition {
  id: string
  name: string
  type: 'orchestrator' | 'sub-agent' | 'human'
  color: string
  permissions: string[]
  model?: string
  cost_profile?: 'low' | 'medium' | 'high'
}

export interface ProjectTemplate {
  name: string
  description: string
  roadmap_template: string
  config_overrides: Partial<ProjectConfig>
}

export interface ProjectConfig {
  project_name: string
  start_date: string
  target_submit_date: string
  total_weeks: number

  // Dynamic structure (replaces hardcoded constants)
  lanes: ProjectLane[]
  phases: ProjectPhase[]
  audit_rules: AuditRule[]
  agents: AgentDefinition[]

  // Parser hints (replaces MILESTONE_META)
  milestone_patterns: {
    section_markers: string[]          // e.g. ["# THE BUILD ROADMAP", "# PARALLEL TRACK"]
    milestone_regex: string             // regex pattern for milestone headers
    week_regex: string                  // regex pattern for week extraction
    subtask_marker: string              // e.g. "- [ ]"
  }

  // Integration settings
  integrations: {
    git_auto_commit?: boolean
    git_remote?: string
    notify_webhook?: string
  }

  // Human-in-the-loop gates
  gates: {
    auto_approve_lanes?: string[]       // lanes where audit-all-pass auto-approves
    require_human_for?: ('large' | 'destructive' | 'all')[]
  }
}

// ─── Default / Fallback Config ───────────────────────────────────────────────

export const DEFAULT_CONFIG: ProjectConfig = {
  project_name: 'Untitled Project',
  start_date: new Date().toISOString().split('T')[0],
  target_submit_date: '',
  total_weeks: 12,

  lanes: [
    { id: 'foundation', label: 'Foundation', color: '#585CF0', description: 'Core infrastructure and setup' },
    { id: 'product', label: 'Product', color: '#14B8A6', description: 'Feature development' },
    { id: 'frontend', label: 'Frontend', color: '#5B6EE8', description: 'UI/UX and surfaces' },
    { id: 'ship', label: 'Ship & Operate', color: '#F59E0B', description: 'Quality, security, launch' },
  ],

  phases: [
    { id: 'foundation', title: 'Foundation', color: '#585CF0', start_week: 1, end_week: 2 },
    { id: 'product', title: 'Product', color: '#14B8A6', start_week: 3, end_week: 7 },
    { id: 'frontend', title: 'Frontend', color: '#5B6EE8', start_week: 5, end_week: 9 },
    { id: 'ship', title: 'Ship', color: '#F59E0B', start_week: 8, end_week: 12 },
  ],

  audit_rules: [
    { id: 'build_pass', category: 'structural', label: 'Build + typecheck + lint exit 0', severity: 'required' },
    { id: 'tests_pass', category: 'structural', label: 'Every acceptance command from prompt block passes', severity: 'required' },
    { id: 'scope_check', category: 'structural', label: 'Git diff scope matches task scope (no scope creep)', severity: 'required' },
    { id: 'no_secrets', category: 'security', label: 'No secrets in committed files', severity: 'critical' },
    { id: 'no_cves', category: 'security', label: 'New dependencies free of known CVEs', severity: 'required' },
    { id: 'tests_added', category: 'correctness', label: 'Tests added/updated for new behavior', severity: 'required' },
  ],

  agents: [
    { id: 'explorer', name: 'Explorer', type: 'sub-agent', color: '#22c55e', permissions: ['read', 'discover'] },
    { id: 'planner', name: 'Planner', type: 'sub-agent', color: '#3b82f6', permissions: ['read', 'plan'] },
    { id: 'builder', name: 'Builder', type: 'sub-agent', color: '#f59e0b', permissions: ['read', 'write', 'execute'] },
    { id: 'auditor', name: 'Auditor', type: 'sub-agent', color: '#ef4444', permissions: ['read', 'audit'] },
    { id: 'claude_code', name: 'Claude Code', type: 'orchestrator', color: '#585CF0', permissions: ['*'] },
  ],

  milestone_patterns: {
    section_markers: ['# THE BUILD ROADMAP', '# PARALLEL TRACK'],
    milestone_regex: '^(?:###|##)\\s*(?:WEEKS?\\s*(\\d+)(?:\\s*[—–-]\\s*(\\d+))?\\s*[—–-]\\s*)?(.+)$',
    week_regex: 'WEEKS?\\s*(\\d+)',
    subtask_marker: '- [ ]',
  },

  integrations: {
    git_auto_commit: false,
  },

  gates: {
    auto_approve_lanes: ['foundation', 'product'],
    require_human_for: ['destructive'],
  },
}

// ─── Config Loader ───────────────────────────────────────────────────────────

const CONFIG_FILENAME = 'sha8al.config.yaml'

export function loadProjectConfig(projectRoot: string): ProjectConfig {
  const configPath = join(projectRoot, CONFIG_FILENAME)

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG }
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = YAML.load(raw) as Partial<ProjectConfig>

    // Deep merge with defaults
    return mergeConfig(DEFAULT_CONFIG, parsed)
  } catch (err) {
    console.error(`[project-config] Failed to parse ${configPath}:`, err)
    return { ...DEFAULT_CONFIG }
  }
}

function mergeConfig(base: ProjectConfig, override: Partial<ProjectConfig>): ProjectConfig {
  return {
    ...base,
    ...override,
    lanes: override.lanes ?? base.lanes,
    phases: override.phases ?? base.phases,
    audit_rules: override.audit_rules ?? base.audit_rules,
    agents: override.agents ?? base.agents,
    milestone_patterns: override.milestone_patterns
      ? { ...base.milestone_patterns, ...override.milestone_patterns }
      : base.milestone_patterns,
    integrations: override.integrations
      ? { ...base.integrations, ...override.integrations }
      : base.integrations,
    gates: override.gates
      ? { ...base.gates, ...override.gates }
      : base.gates,
  }
}

export function resolveLaneForMilestone(
  config: ProjectConfig,
  milestoneId: string,
  milestoneTitle: string,
  phaseId: string
): string {
  // 1. Check if milestone title contains lane keywords
  const titleLower = milestoneTitle.toLowerCase()
  for (const lane of config.lanes) {
    if (titleLower.includes(lane.id.toLowerCase())) {
      return lane.id
    }
  }

  // 2. Check phase → lane mapping by matching phase id to lane id
  const phase = config.phases.find(p => p.id === phaseId)
  if (phase) {
    const matchingLane = config.lanes.find(l => l.id === phaseId)
    if (matchingLane) return matchingLane.id
  }

  // 3. Default to first lane
  return config.lanes[0]?.id ?? 'foundation'
}

export function getPhaseForWeek(config: ProjectConfig, week: number): ProjectPhase | null {
  return config.phases.find(p => week >= p.start_week && week <= p.end_week) ?? null
}

export function getLaneColor(config: ProjectConfig, laneId: string): string {
  return config.lanes.find(l => l.id === laneId)?.color ?? '#9B9BAA'
}

// ─── Template Engine ─────────────────────────────────────────────────────────

export const STARTER_TEMPLATES: Record<string, ProjectTemplate> = {
  software: {
    name: 'Software Project',
    description: 'Standard software development with backend, frontend, and QA phases',
    roadmap_template: `# Software Project Roadmap

## Phase 1 — Foundation
### WEEK 1 — Project Setup
- [ ] Initialize repository and CI/CD
- [ ] Set up development environment

## Phase 2 — Core Features
### WEEK 2-3 — Backend API
- [ ] Design API schema
- [ ] Implement core endpoints

## Phase 3 — Frontend
### WEEK 4-5 — UI Implementation
- [ ] Set up component library
- [ ] Build key screens

## Phase 4 — Ship
### WEEK 6 — Launch Prep
- [ ] End-to-end testing
- [ ] Deployment configuration
`,
    config_overrides: {
      total_weeks: 6,
      phases: [
        { id: 'foundation', title: 'Foundation', color: '#585CF0', start_week: 1, end_week: 1 },
        { id: 'backend', title: 'Backend', color: '#14B8A6', start_week: 2, end_week: 3 },
        { id: 'frontend', title: 'Frontend', color: '#5B6EE8', start_week: 4, end_week: 5 },
        { id: 'ship', title: 'Ship', color: '#F59E0B', start_week: 6, end_week: 6 },
      ],
    },
  },

  product: {
    name: 'Product Development',
    description: 'Product-focused with research, design, build, and iterate phases',
    roadmap_template: `# Product Roadmap

## Phase 1 — Discovery
### WEEK 1 — Research & Design
- [ ] User research synthesis
- [ ] Wireframes and prototypes

## Phase 2 — Build
### WEEK 2-3 — MVP Development
- [ ] Core user flows
- [ ] Payment integration

## Phase 3 — Iterate
### WEEK 4 — Polish & Launch
- [ ] Analytics instrumentation
- [ ] Beta release
`,
    config_overrides: {
      total_weeks: 4,
      lanes: [
        { id: 'research', label: 'Research', color: '#8b5cf6' },
        { id: 'design', label: 'Design', color: '#ec4899' },
        { id: 'engineering', label: 'Engineering', color: '#14B8A6' },
        { id: 'growth', label: 'Growth', color: '#f59e0b' },
      ],
    },
  },

  marketing: {
    name: 'Marketing Campaign',
    description: 'Campaign planning, asset creation, and launch tracking',
    roadmap_template: `# Marketing Campaign Roadmap

## Phase 1 — Strategy
### WEEK 1 — Planning
- [ ] Define target audience
- [ ] Channel strategy

## Phase 2 — Creation
### WEEK 2-3 — Asset Production
- [ ] Copywriting
- [ ] Design assets

## Phase 3 — Launch
### WEEK 4 — Go Live
- [ ] Campaign deployment
- [ ] Performance monitoring
`,
    config_overrides: {
      total_weeks: 4,
      lanes: [
        { id: 'strategy', label: 'Strategy', color: '#585CF0' },
        { id: 'creative', label: 'Creative', color: '#ec4899' },
        { id: 'distribution', label: 'Distribution', color: '#14B8A6' },
        { id: 'analytics', label: 'Analytics', color: '#f59e0b' },
      ],
    },
  },
}

export function generateStarterConfig(templateId: string): { config: ProjectConfig; roadmap: string } | null {
  const template = STARTER_TEMPLATES[templateId]
  if (!template) return null

  const config = mergeConfig(DEFAULT_CONFIG, {
    project_name: template.name,
    ...template.config_overrides,
  })

  return { config, roadmap: template.roadmap_template }
}

export function writeStarterConfig(projectRoot: string, templateId: string): boolean {
  const generated = generateStarterConfig(templateId)
  if (!generated) return false

  try {
    const { writeFileSync } = require('fs')
    const configPath = join(projectRoot, CONFIG_FILENAME)
    writeFileSync(configPath, YAML.dump(generated.config, { lineWidth: -1 }), 'utf-8')

    const roadmapPath = join(projectRoot, 'docs', 'roadmap.md')
    writeFileSync(roadmapPath, generated.roadmap, 'utf-8')
    return true
  } catch {
    return false
  }
}
