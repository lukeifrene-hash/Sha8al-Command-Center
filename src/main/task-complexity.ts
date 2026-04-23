const ARCHITECTURAL_PATTERNS = [
  /\barchitect(?:ure|ural)?\b/i,
  /\bplatform\b/i,
  /\binfrastructure\b/i,
  /\bschema\b/i,
  /\bmigration\b/i,
  /\brefactor\b/i,
  /\borchestrat(?:e|ion)\b/i,
  /\bcross[- ](?:cutting|project|surface)\b/i,
  /\bruntime\b/i,
  /\bprofile system\b/i,
  /\bcommand center\b/i,
]

const LARGE_PATTERNS = [
  /\bworkflow\b/i,
  /\bdashboard\b/i,
  /\bmilestone\b/i,
  /\bagent(?:ic)?\b/i,
  /\bprompt(?:s|ing)?\b/i,
  /\baudit(?:ing)?\b/i,
  /\bparser\b/i,
  /\bmcp\b/i,
  /\belectron\b/i,
  /\bintegration\b/i,
  /\bstate management\b/i,
  /\bdependency\b/i,
]

const MEDIUM_PATTERNS = [
  /\badd\b/i,
  /\bbuild\b/i,
  /\bcreate\b/i,
  /\bimplement\b/i,
  /\bintegrate\b/i,
  /\bwire\b/i,
  /\bupdate\b/i,
  /\bsupport\b/i,
  /\bgenerate\b/i,
  /\bconfigure\b/i,
  /\bbootstrap\b/i,
  /\bvalidate\b/i,
  /\blaunch\b/i,
]

const SMALL_PATTERNS = [
  /\breadme\b/i,
  /\bdocs?\b/i,
  /\bdocumentation\b/i,
  /\bcheck(?:list)?\b/i,
  /\bverify\b/i,
  /\breview\b/i,
  /\brename\b/i,
  /\bcleanup\b/i,
  /\bpolish\b/i,
  /\blink\b/i,
  /\bcopy\b/i,
  /\bmanifesto\b/i,
  /\benv\b/i,
  /\bdry[- ]run\b/i,
  /\bguard status\b/i,
]

function scorePatterns(text: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0)
}

export function classifyTaskComplexity(
  label: string,
): 'small' | 'medium' | 'large' | 'architectural' {
  const normalized = String(label).replace(/\s+/g, ' ').trim()
  if (!normalized) return 'medium'

  if (ARCHITECTURAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'architectural'
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  const smallScore = scorePatterns(normalized, SMALL_PATTERNS)
  const mediumScore = scorePatterns(normalized, MEDIUM_PATTERNS)
  const largeScore = scorePatterns(normalized, LARGE_PATTERNS)

  let score = mediumScore + largeScore * 2
  if (wordCount >= 9) score += 1
  if (/[,:/]/.test(normalized) || /\band\b/i.test(normalized)) score += 1

  if (score >= 4) return 'large'
  if (score >= 2) return 'medium'
  if (smallScore > 0 && mediumScore === 0 && largeScore === 0) return 'small'
  if (wordCount <= 6) return 'small'
  return 'medium'
}
