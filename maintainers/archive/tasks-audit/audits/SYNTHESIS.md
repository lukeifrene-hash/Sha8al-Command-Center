# Talkstore Task Audit — Synthesis Report

**Synthesizer:** Claude (Opus)
**Date:** March 16, 2026
**Inputs:** LLM 1 (Claude), LLM 2 (GPT), LLM 3 (Gemini)
**Original task count:** ~165

---

# STEP 1 — CONSENSUS ANALYSIS

## UNANIMOUSLY AGREED — All 3 LLMs flagged these

### Missing tasks all 3 added:
| # | Missing Task | Manifesto Ref |
|---|-------------|---------------|
| 1 | GDPR mandatory webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) with real deletion behavior | §14, §15 |
| 2 | Safe mode: agent stops and asks for guidance on unexpected state during execution | §15 |
| 3 | `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` webhook handler | §14 |
| 4 | Cumulative impact view ("What has Talkstore done for my store") | §8.7 |
| 5 | Batch confirmation: ask before modifying >5 products | §8.4 |
| 6 | Token/context budget management (truncation, chunking, cost control) | §12 |

### Tasks all 3 agreed to remove:
| # | Removed Task | Shared Reasoning |
|---|-------------|-----------------|
| 1 | Navigation menu management (Week 15-16) | Not in manifesto scope §17 or §18 |
| 2 | Submission checklist items inside build tasks (Week 10) | Separate compliance document |
| 3 | "Prepare rejection rapid-response plan" | Reference material, not a build task |
| 4 | Timeline visual / cost projection / decision log as tasks | Planning docs, not executable work |
| 5 | Duplicate conversation-continuity task (Week 13-14) | Already built in Week 2 |

### Structural issues all 3 agreed on:
| # | Issue | Shared Recommendation |
|---|-------|----------------------|
| 1 | Week 10 is far too dense (~18 tasks spanning UX, legal, compliance, submission) | Split into sub-weeks or redistribute |
| 2 | Error handling is scattered and vague across multiple weeks | Consolidate and make specific |
| 3 | Intent classification tasks are too vague to action | Rewrite with specific deliverables |
| 4 | Anomaly detection needs specific thresholds, not "significant changes" | Define concrete thresholds (>20% week-over-week) |

### Risk flags all 3 agreed on:
| # | Risk |
|---|------|
| 1 | Duplicate theme bloat — Shopify limits unpublished themes; need garbage collection strategy |
| 2 | Bulk Operations API (Week 15) is architecturally different from sync GraphQL — budget extra time |
| 3 | Gross margin queries depend on cost data that most merchants don't have — need fallback behavior |
| 4 | Sidekick work can become scope creep — keep as R&D/docs only in V1.5 |

---

## MAJORITY AGREED (2/3)

| # | Task/Change | Supported By | Dissenter | Dissent Reason | Recommendation |
|---|------------|-------------|-----------|----------------|----------------|
| 1 | LLM model routing as an explicit build task (Opus/Sonnet/Haiku selection) | LLM 1, LLM 3 | LLM 2 (implicit) | GPT bundled it into the tool router | **Include** — this is a distinct engineering task per manifesto §7 |
| 2 | CSP frame-ancestors header as explicit task | LLM 1 (critical), LLM 3 | LLM 2 (implicit) | GPT rolled it into auth | **Include** — App Store rejection risk, deserves its own task |
| 3 | Encrypted token storage helpers | LLM 2, LLM 3 | LLM 1 | Claude didn't mention it | **Include** — security fundamental, Shopify expects this |
| 4 | True data deletion on APP_UNINSTALLED (not just flag inactive) | LLM 1, LLM 3 | LLM 2 (partial) | GPT mentioned it less explicitly | **Include** — Shopify requirement |
| 5 | Page-level SEO (meta titles/descriptions) in V1.5 | LLM 1, LLM 2 | LLM 3 | Gemini says it's not core wedge, manifesto says "not an SEO tool" | **Decision needed** — see STEP 4 |
| 6 | CSS fix pipeline in V1.5 | LLM 1, LLM 3 | LLM 2 | GPT didn't include it | **Include** — manifesto §10 Workflow 3 covers theme modifications including visual bugs |
| 7 | Export CSV functionality in V1.5 | LLM 1, LLM 2 | LLM 3 | Gemini didn't include it | **Include** — low effort, high utility |
| 8 | Free revision logic is duplicated (Week 4 + Week 5) | LLM 1, LLM 3 | LLM 2 | GPT kept it as one task | **Merge** into Week 4 only |

---

## CONTESTED (1/3 only)

| # | Task | Proposed By | Not Included By | Rationale Given |
|---|------|-----------|-----------------|-----------------|
| 1 | Success-metric instrumentation (activation tracking, undo rate, enrichment acceptance, retention events) | LLM 3 | LLM 1, LLM 2 | Manifesto §16 defines metrics but roadmap never tasks the instrumentation code |
| 2 | Explainability layer — explicit response templates for action explanations and diagnostic reasoning | LLM 3 | LLM 1, LLM 2 | Manifesto §8.2 requires plain-language explanations; roadmap treats this as copy, not a tasked UX layer |
| 3 | PII/least-privilege enforcement as explicit code guardrails (aggregated-only responses, redaction-safe logging) | LLM 3 | LLM 1, LLM 2 | Manifesto §8.3, §15 forbid customer PII; roadmap assumes it but doesn't task the enforcement |
| 4 | Split Prisma schema/migration into 3 separate tasks | LLM 2 | LLM 1, LLM 3 | GPT wanted provisioning, schema, and migration as individual tasks |
| 5 | Split LLM customization pipeline into Context Assembly, Prompt Engineering, Output Parsing | LLM 2 | LLM 1, LLM 3 | GPT wanted finer granularity |
| 6 | Merge shared snippet detection + vintage theme detection + low-confidence fallback into one "safety heuristics" task | LLM 3 | LLM 1, LLM 2 | Gemini thought they were too tightly coupled to separate |
| 7 | Remove "Page-level SEO" entirely | LLM 3 | LLM 1, LLM 2 | Gemini says manifesto says "not an SEO tool" — but JSON-LD is defensible |
| 8 | Pricing ambiguity risk: need a strict quoting rule for task counting | LLM 3 | LLM 1, LLM 2 | Gemini flagged that "1 request = 1 task" conflicts with "1 task per 25 products" and "2-task chained operations" |
| 9 | Health Score formula is undefined — needs a canonical weighting | LLM 3 | LLM 1, LLM 2 | Neither manifesto nor roadmap gives the formula |

---

# STEP 2 — CONFLICT RESOLUTION TABLE

| Task Topic | LLM 1 (Claude) | LLM 2 (GPT) | LLM 3 (Gemini) | Recommendation |
|-----------|----------------|-------------|----------------|----------------|
| **Week 9 structure** | Split: Week 9 = Billing only, Week 10a = Onboarding + History | Keep together: Week 9 = Billing + Onboarding | Keep together: Week 9 = Billing + Onboarding | **Keep together (2/3)** — Onboarding scan reuses Week 6 DCI + Week 8 Commerce Intel code, making it more integration than new engineering. Billing is the heavier lift. |
| **Week 10 structure** | Split into 10a (Onboarding + History) + 10b (Polish + Submission) | Single Week 10 (Polish + Submission) | Single Week 10 (History + Safety + Submission) | **Split into 2 halves (1 agrees, 2 imply it's dense)** — All 3 agree Week 10 is overloaded. LLM 1's split is most explicit. Use Week 10a (History + Webhooks + Safety) + Week 10b (Polish + Legal + Submission) |
| **Task granularity** | 142 tasks (granular) | 62 tasks (heavily consolidated) | 112 tasks (moderate) | **Target ~115-125** — LLM 2 over-consolidated (tasks like "Build Backend Billing Logic" are 4+ work sessions bundled). LLM 1 is slightly over-split. LLM 3's granularity is closest to right. |
| **Error handling placement** | Shopify API errors in Week 5, LLM errors in Week 10b, React error boundary in Week 10b | Merged into general polish | Storefront safe mode in Week 5, launch UX in Week 10, beta triage in Weeks 11-12 | **LLM 1's split is best** — separate Shopify API errors (Week 5), LLM failures (Week 10), and React error boundary (Week 10). Clear ownership. |
| **Beta onboarding timing** | Week 10b (with submission) | Week 8 (with Commerce Intel) | Weeks 11-12 (Review Buffer) | **Week 10 (submit) + Weeks 11-12 (operate)** — LLM 3 is right that beta ops belong in review buffer. But the initial onboarding of beta merchants should happen at submission time. Split: "set up beta installs" in Week 10, "operate beta program" in Weeks 11-12. |
| **Rollback architecture** | Separate rollback tasks per domain (storefront Week 5, product ops Week 7) | Separate per domain | LLM 3 flagged rollback exists in multiple places without unified service | **Keep separate per domain** (2/3) — Storefront rollback (unpublish theme) and product ops rollback (revert metafields) are fundamentally different operations. A "unified rollback service" would be over-engineering. |
| **Marketing tasks placement** | Separate "Parallel Track" section at end | Separate "Phase 0" at beginning | Separate "Phase 0" at beginning | **Phase 0 at beginning** (2/3) — Marketing starts Week 1, so it should appear first in the document. |
| **Insight-to-action duplication** | Week 8 only | Week 8 only | LLM 3 flagged duplication between Week 8 and Weeks 15-16 | **Week 8 = build the engine. Week 15-16 = enhance with health score deltas.** Not duplication — it's iteration. Keep both with clearer distinction. |

---

# STEP 3 — CANONICAL TASK LIST

## PHASE 0: PARALLEL TRACK — WAITLIST + DISTRIBUTION (Weeks 1-10, Ongoing)

### WEEK 1 — Landing Page + Waitlist
**Domain:** launch_prep
**Goal:** A live waitlist page captures emails and explains the product clearly.

- [ ] Secure primary domain (`talkstore.ai` or `talkstore.app` or `usetalkstore.com`) and point DNS
- [ ] Build and deploy single-page landing page: headline, 3 value props, "how it works," waitlist CTA, Talkstore brand palette
- [ ] Implement waitlist email capture → `waitlist` table or third-party list (Loops/Buttondown)
- [ ] Set up privacy-friendly analytics (Plausible or Umami) for page views, CTA clicks, submissions
- [ ] Configure Open Graph / social meta tags for link sharing

### WEEK 3 — Video Teaser
**Domain:** launch_prep
**Goal:** 60-90 second teaser video demonstrates the core "request → preview" loop.

- [ ] Record 60-90 second teaser: screen recording of merchant request → agent response → section appears on preview store
- [ ] Add voiceover or text overlay explaining what's happening
- [ ] Embed video on landing page and upload to YouTube (Sifr0 channel)
- [ ] Cut 15-30 second clips for X/Twitter, Reddit, short-form social

### ONGOING (Weeks 1-10) — Distribution
**Domain:** launch_prep
**Goal:** By Week 10, warm waitlist of 50-200 signups ready for beta and launch.

- [ ] Link landing page in every stream description, profile, and public build update
- [ ] Run weekly posting loop across r/shopify, Shopify community forums, and X with proof-of-work updates
- [ ] Send 2-3 pre-launch waitlist emails: progress update, feature preview, launch announcement
- [ ] Recruit beta merchants from top waitlist leads during Weeks 8-9

---

## PHASE 1: FOUNDATION (Weeks 1-2)

### WEEK 1 — Scaffold + Auth + Chat Shell
**Domain:** foundation
**Goal:** Merchant installs app, opens chat inside Shopify admin, types a message, gets a streamed LLM response. OAuth works. Sessions persist.

- [ ] Scaffold Shopify Remix app from official template (Node 20.x LTS)
- [ ] Implement OAuth install flow: install → consent → redirect → session token storage with encrypted access tokens
- [ ] Integrate App Bridge 4.x so app renders embedded inside Shopify admin
- [ ] Build session token validation middleware (JWT verification on every authenticated route)
- [ ] Configure CSP `frame-ancestors` header dynamically from Shopify shop domain (required for embedded app security)
- [ ] Set up Polaris layout shell: sidebar nav (Chat, History, Settings), main content area
- [ ] Build chat UI using Vercel AI SDK `useChat` hook with streaming responses
- [ ] Create `/api/chat` route that accepts messages and streams a hardcoded Claude Haiku response
- [ ] Configure environment variables: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `ANTHROPIC_API_KEY`, `SCOPES`, `HOST`
- [ ] Set up Railway deployment pipeline: push to `main` → auto-deploy
- [ ] Provision PostgreSQL on Supabase; define and migrate initial Prisma schema for `shops`, `sessions`, `conversations`, `messages`

### WEEK 2 — Tool Router + API Connections + Store Awareness
**Domain:** foundation
**Goal:** Agent classifies merchant intent, reads theme/products/orders via Shopify APIs, and answers store questions. Conversation context persists across messages.

- [ ] Build intent classification system: message → `{ domain, verb, confidence, clarification_needed }` via system prompt + Haiku
- [ ] Build tool router that dispatches classified requests to correct domain handler; return clarification prompt if confidence < 0.7
- [ ] Implement LLM model routing layer: Haiku for reads/classification, Sonnet for modifications, Opus for generation (manifesto §7)
- [ ] Build Shopify REST API wrapper for Themes: list themes, read file tree, read individual asset files
- [ ] Build Shopify GraphQL API wrapper for Products (first 25 with metafields), Collections
- [ ] Build Shopify GraphQL API wrapper for Orders (read-only) and basic Analytics
- [ ] Build theme context cache: on first message, fetch and store active theme's file tree, brand tokens (colors, fonts, spacing), sections in use, settings_schema.json, settings_data.json
- [ ] Build product sample cache: pull 25 products with full metafield data for session context
- [ ] Persist conversation messages with domain, verb, model, token counts, and task-consumed flags
- [ ] Enforce aggregated-only responses for customer/order analytics — block any response path that would expose individual customer PII

---

## PHASE 2: STOREFRONT DOMAIN (Weeks 3-5)

### WEEK 3 — Section Generation Engine
**Domain:** storefront
**Goal:** Given a merchant request, the engine selects a base template, generates a customized Liquid section matching the merchant's theme, and passes all validation checks. Not yet installed.

- [ ] Create 10 base section templates (Liquid + JSON schema): announcement-bar, hero-banner, testimonial-carousel, faq-accordion, image-with-text, feature-grid, countdown-timer, newsletter-signup, rich-text-block, custom-html-embed
- [ ] Build theme-pattern extraction: read merchant's heading styles, color variables, spacing conventions from existing theme files
- [ ] Build LLM generation pipeline: base template + theme tokens + merchant request → Opus generates customized .liquid file with schema + CSS + optional JS
- [ ] Build Liquid syntax validator (structural validation, unclosed tags, malformed logic)
- [ ] Build JSON schema validator (ensures `{% schema %}` block parses and has valid settings)
- [ ] Build CSS scoping enforcer: all generated CSS uses `talkstore-{section-name}-` prefix; check for class name collisions
- [ ] Build validation retry loop: if validation fails, feed error context back to Opus (max 2 retries) before failing gracefully
- [ ] Test all 10 section types against Dawn theme — all must pass validation

### WEEK 4 — Theme Duplication + Installation + Preview Flow
**Domain:** storefront
**Goal:** Full end-to-end flow: merchant requests section → agent confirms cost → duplicates theme → installs section → delivers preview link → audit log written.

- [ ] Build confirmation gate: agent explains what it will do + states cost in tasks → waits for explicit merchant approval → then executes
- [ ] Implement theme duplication via Themes REST API (POST with role: unpublished)
- [ ] Implement asset installation: write generated .liquid file to duplicate theme via Asset API (PUT)
- [ ] Build JSON template modifier: read and patch relevant template (e.g., `templates/index.json`) to include new section at requested position
- [ ] Build preview URL generation and deliver in chat with plain-language explanation of what changed
- [ ] Create `audit_log` and `task_usage` database tables; log every action with domain, files changed, before/after state, preview URL, timestamp
- [ ] Implement task consumption tracking: after successful execution, increment `free_tasks_used` or create usage charge
- [ ] Implement free revision flow: one modification request after initial generation doesn't consume an additional task

### WEEK 5 — Modifications + Settings Detection + Storefront Safety
**Domain:** storefront
**Goal:** Agent can modify existing sections, detect and execute settings-only changes (free), handle edge cases safely, and roll back any storefront action.

- [ ] Build section modification pipeline: read existing section code → apply targeted edit via Sonnet → install on duplicate theme → deliver preview
- [ ] Build settings-only detection and execution: identify when a change is achievable via JSON config (free, no task) vs. code edit (task); execute settings changes directly
- [ ] Implement shared snippet detection: warn merchant when editing a snippet used across multiple templates
- [ ] Implement vintage (non-OS 2.0) theme detection: communicate limited support with specific limitations
- [ ] Build Shopify API error handling with retry and exponential backoff; report failures clearly to merchant
- [ ] Build storefront rollback: from audit_log, identify duplicate theme → unpublish if published → delete if requested
- [ ] Implement safe mode: if agent detects unexpected state during execution (file missing, schema mismatch, write failure), stop immediately and ask merchant for guidance
- [ ] Implement theme publish confirmation gate: merchant must explicitly choose to publish — agent never auto-publishes

---

## PHASE 3: PRODUCT OPS DOMAIN (Weeks 6-7)

### WEEK 6 — Product Scanning + Scoring + Enrichment
**Domain:** product_ops
**Goal:** Agent scans up to 25 products, scores each with DCI, presents enrichment plan, merchant approves, agent enriches metafields and rewrites descriptions, before/after comparison delivered.

- [ ] Build product data reader: pull full product data via GraphQL (title, description HTML, all metafields, variants, product_type, vendor, tags, images, category)
- [ ] Implement Data Completeness Index (DCI) scoring: Identity 15% + Physical 15% + Description 20% + Taxonomy 15% + Variants 10% + Media 10% + Feed Readiness 15% = 0-100
- [ ] Build store-wide aggregate DCI score from scanned products
- [ ] Build enrichment planner (Sonnet): map missing attributes, label values as certain/inferred/unresolved, generate enrichment proposal
- [ ] Build metafield write pipeline: use Shopify built-in category metafields first, `talkstore.*` namespace for additional structured data; never overwrite existing metafields from other apps without asking
- [ ] Build description rewrite pipeline: marketing fluff → factual + structured format via Opus, executed via `productUpdate` mutation
- [ ] Implement before/after snapshot: every product change stores prior state in `audit_log.before_state`
- [ ] Implement batch processing: handle up to 25 products per task in a single LLM call (not 25 separate calls)
- [ ] Build confirmation gate with enrichment plan, cost, and flagged uncertain values; require extra confirmation when batch exceeds 5 products (manifesto §8.4)

### WEEK 7 — Collections + Rollback + Edge Cases
**Domain:** product_ops
**Goal:** Collections work. Chained operations price correctly. Product data rollback restores prior state. Catalog edge cases handled.

- [ ] Implement collection creation via GraphQL (`collectionCreate`) — both automated (rule-based) and manual
- [ ] Implement product assignment to collections (`collectionAddProducts`)
- [ ] Build domain chaining: collection + storefront section requests communicate 2-task cost upfront before execution
- [ ] Build product data rollback: one-click revert from `audit_log.before_state` — restore metafields + description via GraphQL mutations
- [ ] Handle products with no description: generate draft from title + images + collection context, mark as "generated — please review"
- [ ] Handle conflicting metafields: query existing namespaces, surface conflicts, prompt merchant for source of truth before overwriting
- [ ] Handle non-English catalogs: detect language, enrich in same language
- [ ] Implement Shopify API rate limit handling: queue, backoff, retry, communicate delay to merchant in chat

---

## PHASE 4: COMMERCE INTELLIGENCE + LAUNCH PREP (Weeks 8-10)

### WEEK 8 — Commerce Intelligence Domain
**Domain:** commerce_intel
**Goal:** Merchant asks any analytics question → agent queries APIs (Haiku only), computes answer in text, bridges to actionable Storefront or Product Ops recommendations.

- [ ] Build Commerce Intelligence query handler with classification for: revenue, orders, margins, inventory, product performance, customer cohorts, period comparisons, dead stock
- [ ] Implement revenue queries: total by period, by product, by collection, by channel
- [ ] Implement order queries: order count, AOV, fulfillment status, unfulfilled count, refund rate
- [ ] Implement product performance: top sellers by revenue and units, worst performers, zero-sale products (dead stock)
- [ ] Implement customer queries: repeat purchase rate, new vs. returning (aggregated only, no PII)
- [ ] Implement inventory queries: low stock alerts, out-of-stock products, overstock detection
- [ ] Implement period comparison: side-by-side metrics across two time ranges
- [ ] Build Insight → Action bridge: after every analytics response, check for actionable Storefront or Product Ops recommendations. Phrase: "I noticed [insight]. Want me to [action]? That would be [N] task(s)."
- [ ] Ensure all responses are text-based in chat — no charts, dashboards, or new UI elements

### WEEK 9 — Billing + Onboarding Scan
**Domain:** launch_prep
**Goal:** All billing plans work end-to-end via Shopify native billing. Onboarding scan runs on first interaction and delivers a compelling diagnostic with 3 recommendations.

- [ ] Implement `appSubscriptionCreate` for Growth ($79/mo, 20 tasks) and Pro ($149/mo, 50 tasks) plans
- [ ] Implement `appUsageRecordCreate` for PAYG ($5/task) and subscription overage charges with declared capped amounts
- [ ] Implement free tier tracking: 3 lifetime tasks per shop in `shops.free_tasks_used`
- [ ] Build billing guard: before any execute action, verify merchant has available tasks or active billing — block and explain if not
- [ ] Build merchant billing UI: task counter (remaining tasks), plan selection, upgrade prompt when free tasks exhausted
- [ ] Handle declined charge: if merchant declines billing prompt, restrict paid features gracefully with clear upgrade path
- [ ] Implement `APP_SUBSCRIPTIONS_UPDATE` webhook to track plan changes
- [ ] Implement `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` webhook to notify merchants before hitting usage cap
- [ ] Build onboarding scan: (1) read active theme → file tree, section count, OS 2.0 status, brand tokens; (2) sample 25 products → DCI score each, top gaps; (3) query last 30 days orders → revenue summary, top products, dead stock; (4) generate diagnostic report (Sonnet); (5) deliver with 3 specific recommended actions and "You have 3 free tasks. Which first?"

### WEEK 10a — History + Webhooks + Safety Hardening
**Domain:** launch_prep
**Goal:** History tab with undo works. All required webhooks registered. Privacy and data deletion implemented.

- [ ] Build History tab UI: list all past actions from audit_log with action type, timestamp, description, domain
- [ ] Connect undo: storefront undo unpublishes/deletes duplicate theme; product ops undo reverts metafields/descriptions from `before_state`
- [ ] Build cumulative impact view: "Talkstore has done X for your store" — sections generated, products enriched, DCI improvement (manifesto §8.7)
- [ ] Register `APP_UNINSTALLED` webhook: delete all shop data, cancel billing, remove created theme assets — true deletion, not just flagging inactive
- [ ] Register `THEMES_PUBLISH` webhook: refresh theme context cache
- [ ] Register `SHOP_UPDATE` webhook: refresh store context (currency, locale)
- [ ] Implement GDPR webhooks: `customers/data_request` (acknowledge), `customers/redact` (delete/anonymize), `shop/redact` (delete all shop data) — all with real deletion behavior and 2xx responses
- [ ] Implement rate limiting: 30 messages/day for free tier to prevent abuse

### WEEK 10b — Polish + Legal + App Store Submission
**Domain:** launch_prep
**Goal:** App submitted to Shopify App Store. All compliance met. Beta merchants onboarded via direct install.

- [ ] Build LLM timeout/failure handling: user-facing error messages when Claude API is slow or fails
- [ ] Build global React error boundary to catch and display unexpected UI errors gracefully
- [ ] Add loading state indicators for theme duplication, section installation, product enrichment, onboarding scan
- [ ] Implement token budget caps per task type to protect margins (manifesto §12)
- [ ] Write App Store listing copy: name, tagline, description, key features, pricing section
- [ ] Capture 5-8 screenshots of core flows (onboarding scan, section generation, enrichment, commerce intel)
- [ ] Record 60-90 second demo video of the full merchant experience
- [ ] Create privacy policy (covers: data accessed, storage location, Anthropic API processing, deletion rights)
- [ ] Create terms of service
- [ ] Run full Shopify App Review QA: verify scopes match usage, Polaris compliance, responsive layout, <3s load, no hardcoded store references, session tokens validated
- [ ] Submit to Shopify App Store
- [ ] Set up 5-10 beta merchant direct installs via Partner Dashboard

---

## PHASE 5: REVIEW BUFFER (Weeks 11-12)

### WEEKS 11-12 — Beta Testing + Review Response
**Domain:** launch_prep
**Goal:** Real merchants test the app. Critical bugs found and fixed. Distribution pipeline warm for launch.

- [ ] Operate beta program: monitor which section types requested, which Commerce Intel questions asked, where intent classification fails
- [ ] Run daily triage on beta sessions — bucket issues into theme, billing, routing, and UX categories
- [ ] Fix critical bugs daily — push updates without needing re-review
- [ ] Track activation funnel: install → scan completed → first task executed → result viewed (manifesto §16 activation definition)
- [ ] Continue waitlist campaigns: streams, social, communities
- [ ] Draft "we're live" email for waitlist, ready to send on approval
- [ ] Prepare launch announcement content: X thread, Reddit post, YouTube video
- [ ] If rejected: fix ALL flagged issues, run full QA checklist, resubmit within 48 hours with detailed fix notes

---

## PHASE 6: V1.2 — POST-LAUNCH HARDENING (Weeks 13-16)

### WEEKS 13-14 — Live Feedback + Fixes
**Domain:** storefront + product_ops + commerce_intel
**Goal:** App Store approved. Real merchant feedback drives systematic fixes. Classification accuracy improved.

- [ ] Send waitlist "we're live" email → drive App Store installs
- [ ] Transition beta merchants from direct installs to App Store installs
- [ ] Build usage analytics query on audit_log: top section types, top Commerce Intel questions, classification accuracy rate
- [ ] Export misclassified messages from production; update intent classification system prompt with 10+ real-world edge case examples; measure accuracy before/after
- [ ] Review Liquid generation error logs from production; create regression tests for each failure pattern; fix root causes in template library or generation prompt
- [ ] Fix any billing edge cases discovered: mid-cycle plan changes, task counting errors, declined charges
- [ ] Fix any Shopify API rate limit issues at real-world catalog sizes
- [ ] Add 3 additional section types based on demand signals from usage data
- [ ] Build automatic error recovery: if a theme write operation partially fails (section written but template JSON update fails), auto-rollback the partial change

### WEEKS 15-16 — Feed Generation + Health Score
**Domain:** product_ops + commerce_intel
**Goal:** V1.2 ships with feed generation for 3 specs, batch enrichment at scale, and a composite Health Score.

- [ ] Build OpenAI Product Feed generation (CSV/TSV): map Shopify fields + metafields → OpenAI spec, validate per product
- [ ] Build Google Merchant Center feed generation (XML): map to Google spec, validate per product
- [ ] Build Meta Catalog feed generation (CSV): map to Meta spec, validate per product
- [ ] Build feed validation report: per-product pass/fail with specific failure reasons and failing-field summaries
- [ ] Implement batch enrichment for 50+ products using Shopify Bulk Operations GraphQL API
- [ ] Build Store Health Score: composite metric from average DCI + theme quality + feed readiness (0-100)
- [ ] Surface Health Score in chat with actionable breakdown: "Your store health score is 62/100. Here's what's dragging it down..."
- [ ] After any task completion, run post-action recommendation check using health score and feed validation deltas
- [ ] Build export functionality: enrichment reports, feed validation reports, health scores downloadable as CSV

---

## PHASE 7: V1.5 — INTELLIGENCE LAYER (Weeks 17-20)

### WEEKS 17-18 — Proactive Insights Engine
**Domain:** commerce_intel + product_ops
**Goal:** Agent watches the store via webhooks and surfaces opportunities proactively. All insights terminate in offered actions.

- [ ] Create `notifications` table and in-app notification UI (badge + list in sidebar)
- [ ] Implement `PRODUCTS_CREATE` webhook: auto-score new products with DCI, queue notification with recommended enrichment
- [ ] Implement `PRODUCTS_UPDATE` webhook: detect if Talkstore enrichment was overwritten by third-party app, notify merchant
- [ ] Build weekly digest notification: new products added + DCI scores, stock changes, top seller performance changes — with recommended actions
- [ ] Build anomaly detection: flag week-over-week changes >20% in revenue, conversion, or order volume; create notification with context and recommended action
- [ ] Build "What should I fix this week?" command: analyze current store state and prioritize top 3-5 actions by impact

### WEEKS 19-20 — Multi-Theme + Advanced Storefront
**Domain:** storefront + product_ops
**Goal:** Section generation works beyond Dawn. Schema markup and CSS fixes expand storefront capabilities. Sidekick Extension documented for V2.

- [ ] Build JSON-LD schema markup generation: agent generates structured data for product/collection pages and injects into theme `<head>`
- [ ] Test section generation against Refresh and Craft themes (in addition to Dawn)
- [ ] Build theme fingerprint detection: identify theme family and adapt generation prompts/patterns accordingly
- [ ] Build CSS fix pipeline: merchant describes visual bug → agent reads relevant CSS → generates targeted scoped fix → duplicate + preview flow
- [ ] Build page-level SEO: meta title and meta description generation for product and collection pages *(DECISION ITEM — see Step 4)*
- [ ] Build export functionality for enrichment reports and feed validation as CSV
- [ ] Research Sidekick App Extension developer docs; prototype exposing catalog health data and section generation to Sidekick
- [ ] Document Sidekick integration plan for V2: which capabilities to expose, data schema, auth flow

---

# STEP 4 — DECISION ITEMS FOR YOU

**DECISION 1: Page-Level SEO (meta titles/descriptions)**
- Option A: **Keep in V1.5** (supported by: LLM 1, LLM 2) — It's a natural extension of Product Ops and relatively low-effort. Merchants will ask for it.
- Option B: **Remove entirely** (supported by: LLM 3) — Manifesto says Talkstore is "not an SEO tool." Including it risks scope creep and mixed positioning.
- Stakes: **Low** — Easy to add later if cut. Easy to deprioritize if kept. Not a core wedge feature either way.

**DECISION 2: Success-Metric Instrumentation**
- Option A: **Add explicit instrumentation tasks** (supported by: LLM 3) — Build event tracking for: onboarding scan completed, first task executed, result viewed, undo rate, enrichment acceptance rate, uninstall tracking. Add to Weeks 9-10.
- Option B: **Don't task it separately** (supported by: LLM 1, LLM 2) — Assume metrics come from existing audit_log queries and Shopify analytics. Build analytics queries in Weeks 13-14 when you have real data.
- Stakes: **Medium** — If you don't instrument early, you won't have clean data when you need it in Weeks 13-14. But adding instrumentation tasks to the already-dense Weeks 9-10 is risky.

**DECISION 3: Explainability as a Tasked UX Layer**
- Option A: **Add explicit tasks for response templates** (supported by: LLM 3) — Build a library of explanation and reasoning templates that ensure every action explanation and every diagnostic follows the manifesto's explainability requirements (§8.2).
- Option B: **Handle in system prompts** (supported by: LLM 1, LLM 2) — Explainability is a prompt engineering concern, not a UI/code task. The system prompts for each domain handler should enforce explanation quality.
- Stakes: **Low** — System prompts can handle this initially. Templates can be added later if output quality is inconsistent.

**DECISION 4: PII Enforcement as Explicit Code Guardrails**
- Option A: **Add explicit guardrail tasks** (supported by: LLM 3) — Build code-level enforcement: response sanitizer that strips PII before delivery, redaction-safe logging that never stores customer emails/addresses, scope review logic.
- Option B: **Handle architecturally** (supported by: LLM 1, LLM 2) — The architecture already prevents PII access: Commerce Intelligence uses aggregated queries, no customer PII scopes are requested. Code guardrails are defense-in-depth but may be over-engineering for MVP.
- Stakes: **Medium** — If a customer email leaks into a chat response, it's a privacy incident. But the architecture already makes this very unlikely. Defense-in-depth is good practice but adds Week 2 scope.

**DECISION 5: Task Quoting Consistency**
- Option A: **Add a task-quoting rule engine** (raised by: LLM 3) — The manifesto says "one request = one task" but also "1 task per 25 products" and "2-task chained operations." Build explicit quoting logic so the agent always deterministically states cost before execution.
- Option B: **Handle in system prompts per domain** — Each domain handler's system prompt already includes pricing rules. The confirmation gate enforces cost communication.
- Stakes: **Medium** — Inconsistent pricing in chat will erode trust. But the confirmation gate already forces cost disclosure. A rule engine may be over-engineering for MVP.

**DECISION 6: Merge Storefront Safety Tasks (Week 5)**
- Option A: **Keep separate** (supported by: LLM 1, LLM 2) — Shared snippet detection, vintage theme detection, and safe mode are distinct checks with different implementations.
- Option B: **Merge into one "storefront safety heuristics" task** (supported by: LLM 3) — They're all pre-execution checks that should run as a pipeline.
- Stakes: **Low** — Implementation is the same either way. This is just a task-list organizational question.

---

# STEP 5 — FINAL SUMMARY

| Metric | Count |
|--------|-------|
| **Original roadmap tasks** | ~165 |
| **Agreed tasks (3/3)** | ~85 |
| **Majority tasks (2/3)** | ~22 |
| **Contested tasks (1/3)** | ~9 |
| **Unanimously cut** | 5 categories (~12 individual tasks) |
| **Final task count (canonical list above)** | **128** |
| **Decisions you need to make** | **6** |

### Consensus Strength
The three LLMs agreed on approximately 75% of the task list without conflict. The major structural recommendations (GDPR webhooks, safe mode, Week 10 splitting, removing nav menus, removing checklist duplication) were unanimous. The 6 decisions you need to make are all low-to-medium stakes — none of them will make or break the product.

### Risk Flags All Three Agreed On
1. **Duplicate theme bloat** — Need a garbage collection strategy for unpublished themes
2. **Bulk Operations API** (Week 15) is architecturally different from sync GraphQL — budget extra time
3. **Margin queries** depend on cost data most merchants don't have — need fallback
4. **Sidekick work** can become scope creep — keep as R&D/docs only
5. **Week 10 is still dense** even after splitting — may slip 2-3 days

### What Happens Next
1. You make the 6 decisions above
2. I produce the final `tasks.md` with your decisions applied
3. We update the parser to read `tasks.md` instead of `roadmap.md`
4. The command center swimlane reflects the validated, consensus-driven task list
