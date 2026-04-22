#!/usr/bin/env node

/**
 * AI Commerce Index Platform — Submission Checklist seeder.
 * Reseeds `submission_checklist.categories` in talkstore-tracker.json
 * from scratch, based on MASTER-MANIFESTO §14.
 *
 * Run AFTER parse-aci-roadmap.mjs (which preserves existing checklist state
 * but does not seed it if empty).
 *
 * Usage:
 *   node scripts/seed-aci-checklist.mjs --profile=aci
 *   node scripts/seed-aci-checklist.mjs --profile=aci --dry-run
 */

import { readFileSync } from 'fs'
import { resolveParserProjectPaths } from './lib/project-paths.mjs'
import { validateExistingTrackerProfile } from './lib/profile-validators.mjs'
import { writeTrackerJsonWithBackup } from './lib/tracker-backup.mjs'

// 12 categories. Each item has an id (slug), title, status ('not_started'),
// optional `linked_milestone` that surfaces the item on that milestone's detail
// panel, and a `risk_level` so the swimlane can mark critical ones.
const CATEGORIES = [
  {
    id: 'oauth_session',
    title: 'OAuth + Session',
    target_week: 1,
    risk_level: 'normal',
    linked_milestone: 'm1_purge_and_foundation_reset',
    items: [
      'OAuth flow works end-to-end on a fresh Shopify dev store install',
      'Access tokens encrypted at rest (AES-256-GCM)',
      'Expiring offline access tokens enabled via future flag',
      'Session storage (PrismaSessionStorage) wired with 15-min cache',
      'Session token validation in middleware, not per-route',
      'Reinstall flow clears stale subscription GIDs',
    ],
  },
  {
    id: 'scopes_justification',
    title: 'Scopes + Justification',
    target_week: 1,
    risk_level: 'critical',
    linked_milestone: 'm1_purge_and_foundation_reset',
    items: [
      'shopify.app.toml declares exactly 5 scopes (read_products, write_products, read_content, write_content, read_product_listings)',
      'Per-scope reviewer-justification copy written (one paragraph each)',
      'read_themes NOT requested (project hard-stop rule)',
      'read_orders NOT requested (protected-data, not needed post-pivot)',
      'read_analytics NOT requested',
      'write_metafields handled implicitly via write_products (verified against 2026-04 API)',
    ],
  },
  {
    id: 'consent_dpa',
    title: 'Consent + DPAs',
    target_week: 2,
    risk_level: 'critical',
    linked_milestone: 'm7_merchant_surfaces',
    items: [
      'In-app consent screen before first LLM call (per Shopify PPA Feb 27 2026)',
      'Each LLM sub-processor listed by name (OpenAI, Anthropic, Google, Perplexity)',
      'DPA link + acceptance checkbox + timestamp persisted to consent_log table',
      'OpenAI zero-retention commercial DPA signed',
      'Anthropic commercial terms + no-training attestation signed',
      'Google Gemini API terms signed (non-grounded mode only)',
      'Perplexity commercial API terms signed',
      'Supabase DPA signed',
      'Railway hosting DPA signed',
    ],
  },
  {
    id: 'privacy_tos',
    title: 'Privacy Policy + ToS',
    target_week: 9,
    risk_level: 'critical',
    linked_milestone: 'm10_launch_and_post_launch',
    items: [
      'Privacy policy dedicated to new product (NOT reused from TalkStore)',
      'All sub-processors enumerated with linked DPAs',
      'Terms of Service drafted',
      'Counsel review complete ($1.5–3K budget allocation)',
      'Privacy policy + ToS published at production URL',
      'Retention policy documented + enforced',
      'AI training opt-out documented',
    ],
  },
  {
    id: 'gdpr_webhooks',
    title: 'GDPR Webhooks',
    target_week: 1,
    risk_level: 'normal',
    linked_milestone: 'm1_purge_and_foundation_reset',
    items: [
      'customers/data_request handler registered + tested with fixture',
      'customers/redact handler redacts customer-linked identifiers',
      'shop/redact handler cascade-deletes all shop data within 48h window',
      'Webhook HMAC verification on every handler',
      'Test fixtures for all 3 GDPR webhooks in CI',
    ],
  },
  {
    id: 'business_webhooks',
    title: 'Business Webhooks',
    target_week: 2,
    risk_level: 'normal',
    linked_milestone: 'm1_purge_and_foundation_reset',
    items: [
      'app/uninstalled handler marks shop inactive + clears sessions',
      'app/scopes_update handler updates session.scope',
      'app_subscriptions/update handler re-queries subscription state',
      'products/create, products/update, products/delete handlers registered (Guard signals)',
      'collections/create, collections/update, collections/delete handlers registered',
      'shop/update handler invalidates caches',
    ],
  },
  {
    id: 'billing_subscription',
    title: 'Billing + Subscription',
    target_week: 2,
    risk_level: 'critical',
    linked_milestone: 'm2_multi_llm_and_async_infra',
    items: [
      'Shopify native Billing API only (appSubscriptionCreate, no external payment)',
      '4 tiers defined: Free / Growth $99 / Pro $229 / Enterprise (custom)',
      '7-day card-required trial flow works',
      'Trial → paid auto-conversion fires correctly',
      'Plan switch + cancellation flows tested',
      'capturePaymentMethod: true on trial',
      'NO PAYG / per-task / usage records in billing surface',
    ],
  },
  {
    id: 'core_web_vitals',
    title: 'Core Web Vitals + Performance',
    target_week: 10,
    risk_level: 'critical',
    linked_milestone: 'm9_quality_security_compliance',
    items: [
      'Dashboard LCP ≤ 2.5s (ideally ≤ 1.5s)',
      'CLS ≤ 0.1 across all admin pages',
      'INP ≤ 200ms',
      'Dashboard renders from cached Supabase state',
      'LLM queries run in background jobs, never block UI',
      'App Bridge loaded from bundle, not CDN',
      'Bundle size budget enforced',
      'Lighthouse score ≥ 90 performance on dashboard',
    ],
  },
  {
    id: 'app_store_listing',
    title: 'App Store Listing',
    target_week: 11,
    risk_level: 'critical',
    linked_milestone: 'm10_launch_and_post_launch',
    items: [
      'Listing copy in factual register (no "rank #1 in ChatGPT" / "guaranteed citations")',
      '5+ screenshots uploaded',
      'Demo video produced',
      'Listing category set correctly',
      'Pricing visible + matches in-app tiers',
      'Support + documentation links live',
      'Privacy + ToS links live',
      'Built for Shopify badge application submitted',
    ],
  },
  {
    id: 'methodology_f1',
    title: 'Methodology + F1 Published',
    target_week: 10,
    risk_level: 'critical',
    linked_milestone: 'm9_quality_security_compliance',
    items: [
      '/methodology public page live',
      'Readiness rubric weights published (per §8.2)',
      'F1 benchmark methodology documented',
      'F1 score ≥ 0.90 on 5,000 labeled responses, published',
      'Model-version anchoring policy documented',
      'Confidence interval explanation rendered',
      'Raw-data-accessibility policy ("click score → see 47 queries") documented',
    ],
  },
  {
    id: 'safety_support',
    title: 'Safety + Support',
    target_week: 11,
    risk_level: 'normal',
    linked_milestone: 'm10_launch_and_post_launch',
    items: [
      'Uninstall flow tested on dev store',
      'Support email monitored',
      'Error states surface actionable messages (no raw stack traces to merchant)',
      'Every write action has merchant confirmation (or Autopilot opt-in)',
      'Before/after snapshots on every mutation',
      '90-day rollback works for all 28 fix types',
      'In-app escape hatch (undo all / contact support / pause Autopilot)',
    ],
  },
  {
    id: 'security_integrity',
    title: 'Security + Data Integrity',
    target_week: 10,
    risk_level: 'critical',
    linked_milestone: 'm9_quality_security_compliance',
    items: [
      'OWASP top 10 review pass (no critical findings)',
      'Prompt injection defence on all merchant-controlled inputs (sanitizeForPrompt)',
      'Rate limiter stress-tested against Shopify throttle',
      'Encryption at rest verified for access tokens',
      'Webhook HMAC verified on every handler',
      'PII not logged (structured log field exclusion)',
      'Multi-tenancy: every merchant-scoped query uses shopId',
      'Dependency audit protection verified (never overwrites GMC-locked metafields)',
      'NO SerpAPI / DataForSEO / AI Overviews in V1 (DMCA §1201 exposure)',
    ],
  },
]

function main() {
  try {
    const dryRun = process.argv.includes('--dry-run')
    const outputPath = resolveParserProjectPaths({ parserId: 'aci-checklist-seed' }).trackerPath
    const tracker = JSON.parse(readFileSync(outputPath, 'utf8'))
    validateExistingTrackerProfile({
      expectedProfile: 'aci',
      existingProject: tracker.project || null,
      operationLabel: 'seed-aci-checklist',
    })

    const categories = CATEGORIES.map((cat) => ({
      id: cat.id,
      title: cat.title,
      target_week: cat.target_week,
      risk_level: cat.risk_level,
      linked_milestone: cat.linked_milestone,
      items: cat.items.map((text, i) => ({
        id: `${cat.id}_${String(i + 1).padStart(2, '0')}`,
        text,
        done: false,
        completed_at: null,
        completed_by: null,
        notes: null,
      })),
    }))

    tracker.submission_checklist = { categories }

    const writeResult = writeTrackerJsonWithBackup({
      targetPath: outputPath,
      tracker,
      dryRun,
      label: 'seed-aci-checklist',
    })

    if (!writeResult.changed) {
      console.log(`[seed-aci-checklist] tracker unchanged; skipped write for ${outputPath}`)
    } else if (dryRun) {
      console.log(`[seed-aci-checklist] dry-run: NOT writing ${outputPath}`)
    } else {
      if (writeResult.backupPath) {
        console.log(`[seed-aci-checklist] backup ${writeResult.backupPath}`)
      }
      console.log(`[seed-aci-checklist] wrote ${outputPath}`)
    }

    const totalItems = categories.reduce((n, c) => n + c.items.length, 0)
    console.log(`[seed-aci-checklist] seeded ${categories.length} categories, ${totalItems} items`)
    for (const c of categories) {
      const riskTag = c.risk_level === 'critical' ? ' ⚠ CRITICAL' : ''
      console.log(`  ${c.id.padEnd(26)} items=${String(c.items.length).padStart(2)}  linked→${c.linked_milestone || '—'}${riskTag}`)
    }
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
