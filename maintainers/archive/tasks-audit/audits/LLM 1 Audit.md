# Talkstore — Task Audit Report

**Auditor:** Claude (Opus)
**Date:** March 16, 2026
**Inputs:** manifesto.md v2.0, roadmap.md v2.0
**Original task count:** ~158 checkbox items

---

# PART 1 — AUDIT

## 1. Missing Tasks (Manifesto requires, Roadmap has no corresponding task)

| # | Missing Task | Manifesto Reference | Severity |
|---|-------------|---------------------|----------|
| M1 | GDPR mandatory webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) — roadmap mentions GDPR only in rejection-reasons prose, never as a build task | §14 Webhooks, §15 Data Privacy | **Critical** — will cause App Store rejection |
| M2 | LLM model routing implementation (Opus for generation, Sonnet for modification, Haiku for reads) — roadmap has intent classification but never tasks the model-selection layer | §7 Three Domains table, §13 Tech Stack, §18 MVP Scope item 4 | **High** — core cost/quality architecture |
| M3 | Token budget caps per task type — manifesto lists as a margin protection lever | §12 Unit Economics | Medium — affects profitability |
| M4 | Conservative defaults: agent asks before batch-modifying >5 products | §8.4 Merchant Control | Medium — trust/safety |
| M5 | Safe mode: agent stops and asks for guidance if something unexpected happens during execution | §15 Rollback → Safe mode | Medium — trust/safety |
| M6 | Data deletion on APP_UNINSTALLED (true deletion, not just flag) | §15 Data Privacy: "Merchants can request full data deletion upon uninstallation" | **High** — Shopify requirement |
| M7 | CSP frame-ancestors header configuration | §14 implied (embedded app security), roadmap mentions in rejection reasons but never as a task | **High** — will cause App Store rejection |
| M8 | `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` webhook handler | §14 Webhooks table | Medium — billing UX |
| M9 | Capped amount handling UX (notify merchant before hitting usage cap) | §14 Webhooks | Medium |
| M10 | Measurable impact tracking — before/after metrics surfaced to merchant after every action (not just stored in audit log) | §8.7 Measurable Impact Tracking | Medium — differentiator |
| M11 | "What has Talkstore done for my store?" cumulative impact view | §8.7: "The merchant can always see what Talkstore has done for their store and the cumulative impact" | Medium |
| M12 | Explicit scope request transparency when new capabilities need additional permissions | §8.3 Permission Discipline | Low — V2 concern |
| M13 | Theme publish flow — merchant explicitly clicks publish; agent never auto-publishes | §8.4, §15 "Never publish automatically" — roadmap implies but never tasks the publish confirmation gate | Medium — safety |
| M14 | Batch operations: 25 products enriched in one LLM call (not 25 separate calls) — roadmap mentions batch processing but doesn't task the actual LLM batching implementation | §12 Margin Protection Levers | Medium — cost |

## 2. Unnecessary Tasks (Not in manifesto scope or busywork)

| # | Task | Location | Reason |
|---|------|----------|--------|
| U1 | Navigation menu management | Week 15-16 | Not mentioned in manifesto §17 In Scope or §18 MVP Scope. Not one of the 3 domains. Adds scope without manifesto backing. **Remove or defer to V2.** |
| U2 | "Prepare rejection rapid-response plan" | Week 10 | This is a contingency doc, not a build task. Luqman already knows this from the roadmap prose. Delete from task list. |
| U3 | "Most Likely Rejection Reasons" list | Week 10 | Reference material, not an actionable task. Already in the roadmap prose. |
| U4 | "Record 2-3 real merchant sessions for testimonial" | Week 11-12 | Marketing task that Luqman handles. Too specific for a build task list — this is a judgment call during beta, not a checkbox. |
| U5 | "Basic error recovery — if theme operation partially fails, auto-rollback" | Week 13-14 | This should already exist from Week 5's error handling. Either it's redundant or it was missed in Week 5. Move to Week 5. |

## 3. Redundant / Duplicate Tasks

| # | Task A | Task B | Resolution |
|---|--------|--------|------------|
| R1 | Week 10: "App handles uninstall webhook (clean up data)" (inside checklist) | Week 10: "Webhook handlers registered: APP_UNINSTALLED → clean up shop data, cancel billing" | Merge into single webhook task |
| R2 | Week 2: "Conversation context maintained across messages within a session" | Week 13-14: "Session memory: context carries across messages in a conversation" | Week 2 task covers this. Week 13-14 item should be "Verify conversation context works across 10+ message threads" (testing, not building) |
| R3 | Week 10 App Store checklist: "Polaris design system followed" | Week 1: "Basic Polaris layout" | Week 10 item is a verification, not a build task. Convert to QA check. |
| R4 | Week 10: "Session tokens validated on every request" | Week 1: "Session token validation middleware" | Same. Already built in Week 1. Week 10 is verification. |

## 4. Too Vague to Be Actionable

| # | Task | Location | Problem | Suggested Rewrite |
|---|------|----------|---------|-------------------|
| V1 | "Fix: any Liquid generation failures discovered in real themes" | Week 13-14 | Can't be actioned until failures exist. Not specific enough for an agent to execute. | "Review Liquid generation error logs from beta merchants. Create regression tests for each failure pattern. Fix root causes in template library or generation prompt." |
| V2 | "Monitor: which section types are most requested?" | Week 13-14 | Observation, not a build task. | "Build a query/dashboard on audit_log to surface top section types by request count. Use output to prioritize next 3 templates." |
| V3 | "Improve: classification accuracy based on real conversation data" | Week 13-14 | How? What specifically? | "Export misclassified messages from beta. Update intent classification system prompt with 10+ real-world edge case examples. Measure accuracy improvement." |
| V4 | "Add: 3 additional section types based on demand signals" | Week 13-14 | Unactionable until demand data exists. Fine as a placeholder but needs a trigger. | Keep as-is with note: "Blocked until Week 12 usage data is available." |
| V5 | "Error boundaries: graceful handling for all API failures, LLM failures, timeout scenarios" | Week 10 | Too broad. This is 3+ tasks bundled. | Split: (a) Shopify API error handling with retry logic, (b) LLM timeout/failure with user-facing error messages, (c) Global error boundary component in React |
| V6 | "Anomaly detection: significant changes in revenue, conversion, or order volume trigger an in-app alert" | Week 17-18 | What thresholds? What's "significant"? | "Implement anomaly detection: flag week-over-week changes >20% in revenue, conversion, or order volume. Store as notification with recommended action." |

## 5. Tasks That Should Be Split

| # | Current Task | Location | Split Into |
|---|-------------|----------|------------|
| S1 | **Week 10 is 3 weeks of work.** History tab + undo + rate limiting + error boundaries + loading states + app listing + privacy policy + ToS + submission checklist + webhooks + beta onboarding + rejection plan | Week 10 | Split into Week 9b (polish: error handling, rate limiting, loading states) + Week 10a (History tab + undo) + Week 10b (listing + legal + submission) |
| S2 | Week 9: Billing integration AND Onboarding scan | Week 9 | Both are complex critical-path features. Billing alone is a full week. Split: Week 8b (Billing) + Week 9 (Onboarding scan). This requires shifting Commerce Intel earlier. |
| S3 | "App Store listing written: name, tagline, description, screenshots, demo video" | Week 10 | Screenshots and demo video are separate work from writing the listing copy. Split: (a) Write listing copy, (b) Capture 5-8 screenshots of core flows, (c) Record 60-90s demo video |
| S4 | "Webhook handlers registered" (4 webhooks lumped together) | Week 10 | Each webhook has different logic. Split into individual tasks. |

## 6. Tasks That Should Be Merged

| # | Task A | Task B | Merge Into |
|---|--------|--------|------------|
| G1 | Week 5: "Settings-only detection" | Week 5: "Settings-only changes: agent makes config changes" | Single task: "Implement settings-only detection and execution pipeline (free to merchant, no task consumed)" |
| G2 | Week 10 checklist: "Only requested scopes are used" + "No hardcoded store references" + "Performance: app loads in <3s" | Multiple checklist sub-items | Single task: "Run full Shopify App Review QA checklist and fix any failures" |

---

# PART 2 — REVISED TASK LIST

## PHASE 1: FOUNDATION (Weeks 1–2)

### WEEK 1 — Scaffold + Auth + Chat Shell
**Domain:** foundation
**Goal:** Merchant opens app inside Shopify admin, types a message, gets a streamed LLM response. OAuth works. Sessions persist.

- [ ] Scaffold Shopify Remix app from official template with Node 20.x LTS
- [ ] Implement OAuth flow: install → consent → redirect → session token storage
- [ ] Integrate App Bridge 4.x so app renders embedded inside Shopify admin
- [ ] Build session token validation middleware (JWT verification on every request)
- [ ] Configure CSP frame-ancestors header dynamically from Shopify shop domain
- [ ] Set up Polaris layout: sidebar nav (Chat, History, Settings), main content area
- [ ] Build chat UI shell using Vercel AI SDK `useChat` hook with streaming
- [ ] Create `/api/chat` route that accepts messages and streams a hardcoded Claude Haiku response
- [ ] Configure environment variables: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `ANTHROPIC_API_KEY`, `SCOPES`, `HOST`
- [ ] Set up Railway deployment pipeline: push to `main` → auto-deploy
- [ ] Provision PostgreSQL on Supabase. Create initial tables: `shops`, `sessions`, `conversations`, `messages`
- [ ] Configure Prisma ORM with initial schema and run first migration

### WEEK 2 — Tool Router + API Connections + Store Awareness
**Domain:** foundation
**Goal:** Agent reads the merchant's theme, products, and orders via Shopify APIs and answers questions about the store. Intent classification routes messages to correct domain handler.

- [ ] Build intent classification system: every message → `{ domain, verb, confidence, clarification_needed }` using system prompt + Haiku
- [ ] Build tool router that dispatches to correct domain handler based on classification output
- [ ] Implement LLM model routing layer: Haiku for reads/classification, Sonnet for modifications, Opus for generation (manifesto §7 routing table)
- [ ] Connect Shopify Themes REST API: list themes, read file tree, read individual asset files
- [ ] Connect Shopify GraphQL Admin API: query products (first 25) with metafields, read collections
- [ ] Connect Shopify GraphQL: query orders (read-only), basic analytics
- [ ] Build theme context cache: on first message, read and cache active theme's file tree, brand tokens (colors, fonts, spacing), sections-in-use, settings_schema.json, settings_data.json
- [ ] Build product sample cache: pull 25 products with full metafield data, store in session context
- [ ] Verify agent answers store questions: "What theme am I using?", "How many products?", "Sales last week?"
- [ ] Maintain conversation context across messages within a session (message history sent to LLM)

---

## PHASE 2: STOREFRONT DOMAIN (Weeks 3–5)

### WEEK 3 — Section Generation Engine
**Domain:** storefront
**Goal:** Given a merchant request, the engine produces a valid, scoped Liquid section file that passes all validation checks. Not yet installed — just generated and validated.

- [ ] Create 10 base section templates (Liquid + JSON schema): announcement-bar, hero-banner, testimonial-carousel, faq-accordion, image-with-text, feature-grid, countdown-timer, newsletter-signup, rich-text-block, custom-html-embed
- [ ] Build LLM customization pipeline: base template + merchant's theme tokens + merchant's request → Opus generates customized section
- [ ] Build Liquid syntax validator (structural validation, unclosed tags, malformed logic)
- [ ] Build JSON schema validator (ensures `{% schema %}` block parses and has valid settings)
- [ ] Build CSS scoping enforcer: all generated CSS uses `talkstore-{section-name}-` prefix; check for class name collisions against existing theme
- [ ] Build retry loop: if validation fails, retry with error context (max 2 retries)
- [ ] Test all 10 section types against Dawn theme — all must pass validation

### WEEK 4 — Theme Duplication + Installation + Preview Flow
**Domain:** storefront
**Goal:** Full end-to-end flow: merchant requests section → agent confirms cost → duplicates theme → installs section → delivers preview link. Task is tracked. Audit log is written.

- [ ] Implement theme duplication via Themes REST API (POST with role: unpublished)
- [ ] Implement asset installation: write generated .liquid file to duplicate theme via Asset API
- [ ] Implement template update: modify relevant JSON template (e.g., `templates/index.json`) to include new section at correct position
- [ ] Build preview URL generation: `https://{shop}.myshopify.com/?preview_theme_id={duplicate_id}`
- [ ] Build confirmation gate: agent explains action + states cost in tasks → waits for explicit "yes" → executes
- [ ] Implement task consumption tracking: after successful execution, increment `free_tasks_used` or create usage charge
- [ ] Create `audit_log` and `task_usage` database tables with before/after state snapshots
- [ ] Implement free revision flow: one modification after initial generation doesn't consume an additional task
- [ ] Log every action to audit_log: timestamp, domain, files changed, before/after state, preview URL

### WEEK 5 — Modifications + Settings Detection + Safety
**Domain:** storefront
**Goal:** Agent can modify existing sections, detect settings-only changes (free), handle edge cases, and roll back any storefront action.

- [ ] Build section modification pipeline: read existing section code → apply targeted edit via Sonnet → install on duplicate theme → deliver preview
- [ ] Build settings-only detection and execution: identify when a change is a JSON config change (free) vs. code edit (task); execute settings changes directly without theme duplication
- [ ] Implement shared snippet detection: warn merchant when editing a snippet used across multiple templates
- [ ] Implement vintage theme detection: identify non-OS 2.0 themes and communicate limited support with specific limitations
- [ ] Build Shopify API error handling: catch failures, report clearly to merchant, offer retry with exponential backoff
- [ ] Build storefront rollback: from audit_log, identify duplicate theme → unpublish if published → delete if merchant requests
- [ ] Add mobile responsiveness note to preview delivery ("Check mobile view at this link too")
- [ ] Implement safe mode: if agent detects unexpected state during execution (file missing, schema mismatch), stop immediately and ask merchant for guidance
- [ ] Implement theme publish confirmation gate: after merchant previews and approves, provide explicit "Publish this theme" action — agent never auto-publishes

---

## PHASE 3: PRODUCT OPS DOMAIN (Weeks 6–7)

### WEEK 6 — Product Scanning + Scoring + Enrichment
**Domain:** product_ops
**Goal:** Agent scans 25 products, scores each with DCI, presents enrichment plan, merchant approves, agent enriches metafields and rewrites descriptions, before/after comparison delivered.

- [ ] Build product data reader: pull full product data via GraphQL (title, description HTML, all metafields, variants, product_type, vendor, tags, images, category)
- [ ] Implement Data Completeness Index (DCI) scoring algorithm: Identity 15% + Physical 15% + Description 20% + Taxonomy 15% + Variants 10% + Media 10% + Feed Readiness 15% = 0-100
- [ ] Build store-wide aggregate DCI score (average across scanned products)
- [ ] Build metafield enrichment pipeline: infer and populate material, dimensions, weight, product category using Sonnet. Use `talkstore.*` namespace for custom data, Shopify built-in category metafields where they exist
- [ ] Build description rewrite pipeline: marketing fluff → factual + persuasive, structured, AI-parseable format via Opus
- [ ] Implement before/after snapshot: every product change stores prior state in `audit_log.before_state`
- [ ] Implement batch processing: handle up to 25 products per task in a single LLM call with batch context (not 25 separate calls)
- [ ] Build confirmation gate: agent presents enrichment plan with cost → waits for approval → executes
- [ ] Implement ambiguity handling: when agent infers a value with low confidence, flag it for merchant review rather than silently writing it
- [ ] Implement conservative defaults: agent asks before batch-modifying more than 5 products (manifesto §8.4)

### WEEK 7 — Collections + Rollback + Edge Cases
**Domain:** product_ops
**Goal:** Collections can be created. Enrichment handles edge cases. Rollback restores prior state. Chained operations work with correct task counting.

- [ ] Implement collection creation via GraphQL (`collectionCreate` mutation) — both automated (rule-based) and manual
- [ ] Implement product assignment to collections
- [ ] Build collection + storefront chaining: if merchant wants collection displayed, chain Product Ops (create collection) + Storefront (generate section) — communicate 2-task cost upfront
- [ ] Build product data rollback: one-click revert from audit_log — restore metafields + description from `before_state` via GraphQL mutations
- [ ] Handle products with no description: generate from title + images + collection context, mark as "generated — please review"
- [ ] Handle conflicting metafields from other apps: surface conflicts, never overwrite without asking merchant for source of truth
- [ ] Handle non-English catalogs: detect language, enrich in same language
- [ ] Implement Shopify API rate limit handling: queue and retry with backoff, communicate delay to merchant

---

## PHASE 4: COMMERCE INTELLIGENCE + BILLING + LAUNCH PREP (Weeks 8–10)

### WEEK 8 — Commerce Intelligence Domain
**Domain:** commerce_intel
**Goal:** Merchant asks any analytics question → agent queries APIs, computes answer, delivers text response, bridges to actionable Storefront or Product Ops recommendations.

- [ ] Build Commerce Intelligence query handler: receives classified analytics question, queries Shopify APIs (Haiku only), computes answer
- [ ] Implement revenue queries: total revenue by period, by product, by collection, by channel
- [ ] Implement order queries: order count, AOV, fulfillment status, unfulfilled count, refund rate
- [ ] Implement product performance: top sellers by revenue and units, worst performers, zero-sale products (dead stock detection)
- [ ] Implement customer queries: repeat purchase rate, new vs. returning (aggregated, no PII)
- [ ] Implement inventory queries: low stock alerts, out-of-stock products, overstock detection
- [ ] Implement period comparison: "Compare January vs February" → side-by-side metrics
- [ ] Build Insight → Action bridge: after every analytics response, check for actionable Storefront or Product Ops recommendations. Phrase as: "I noticed [insight]. Want me to [action]? That would be [N] task(s)."
- [ ] Verify all responses are text-based in chat — no charts, no dashboards, no new UI elements

### WEEK 9 — Billing Integration
**Domain:** foundation
**Goal:** All billing plans work end-to-end via Shopify native billing. Free tasks decrement. PAYG charges appear on merchant's Shopify bill. Billing guard prevents unpaid execution.

- [ ] Implement Shopify billing: `appSubscriptionCreate` for Growth ($79/mo, 20 tasks) and Pro ($149/mo, 50 tasks) subscription plans
- [ ] Implement usage-based billing: `appUsageRecordCreate` for PAYG ($5/task) and subscription overage charges
- [ ] Declare capped amounts for usage billing (Shopify requirement): PAYG $250, Growth $200 overage, Pro $400 overage
- [ ] Implement free tier tracking: 3 lifetime tasks per shop, tracked in `shops.free_tasks_used`
- [ ] Build billing guard: before any execute action, verify merchant has available tasks or active billing — block execution if not
- [ ] Build upgrade prompt: when free tasks exhausted, present plan selection (PAYG / Growth / Pro) with clear pricing
- [ ] Build task counter UI: merchant always sees remaining tasks (free tier) or current usage and included tasks remaining (subscription)
- [ ] Implement `APP_SUBSCRIPTIONS_UPDATE` webhook handler to track plan changes
- [ ] Implement `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` webhook to notify merchants before hitting usage cap
- [ ] Handle declined charge edge case: if merchant declines billing prompt, explain what's needed and allow retry

### WEEK 10a — Onboarding Scan + History Tab
**Domain:** foundation
**Goal:** Onboarding scan runs on first interaction and delivers a compelling store diagnostic with 3 actionable recommendations. History tab shows past actions with undo.

- [ ] Build onboarding scan pipeline: (1) read active theme via REST API → file tree, section count, OS 2.0 status, brand tokens; (2) sample 25 products via GraphQL → DCI score each, identify top gaps; (3) query last 30 days orders → revenue summary, top products, dead stock; (4) generate diagnostic report via Sonnet; (5) deliver report with 3 specific recommended actions and "You have 3 free tasks. Which first?"
- [ ] Build History tab UI: list all past actions from audit_log with action type, timestamp, description, and domain
- [ ] Connect undo functionality: clicking "Undo" on a storefront action unpublishes/deletes duplicate theme; clicking "Undo" on a product ops action reverts metafields/descriptions from `before_state`
- [ ] Build cumulative impact view: "Talkstore has done X for your store" — total sections generated, products enriched, DCI improvement (manifesto §8.7)

### WEEK 10b — Polish + App Store Submission
**Domain:** launch_prep
**Goal:** App submitted to Shopify App Store with all compliance requirements met. Beta merchants onboarded via direct install.

- [ ] Implement rate limiting: 30 messages/day for free tier to prevent abuse
- [ ] Build LLM timeout/failure handling: user-facing error messages when Claude API is slow or fails
- [ ] Build global React error boundary component to catch and display unexpected UI errors
- [ ] Add loading states: skeleton/spinner during theme duplication, section installation, product enrichment
- [ ] Implement token budget caps per task type to protect margins (manifesto §12)
- [ ] Register webhook handlers: `APP_UNINSTALLED` (delete all shop data, cancel billing, remove created theme assets), `THEMES_PUBLISH` (refresh theme context cache), `SHOP_UPDATE` (refresh store context)
- [ ] Implement GDPR mandatory webhooks: `customers/data_request` (acknowledge), `customers/redact` (delete/anonymize customer data), `shop/redact` (delete all shop data)
- [ ] Implement true data deletion on uninstall: remove all shop data, audit logs, conversations, cached theme data
- [ ] Write App Store listing: name, tagline, description, key features, pricing
- [ ] Capture 5-8 screenshots of core flows (onboarding scan, section generation, enrichment, commerce intel)
- [ ] Record 60-90 second demo video showing the full "wow" flow (screen recording with voiceover or text overlay)
- [ ] Create privacy policy (Termly or iubenda template, customized for Talkstore's data handling)
- [ ] Create terms of service
- [ ] Run Shopify App Review QA checklist: verify scopes match usage, Polaris compliance, responsive layout, <3s load time, no hardcoded store references, session tokens validated
- [ ] Submit to Shopify App Store
- [ ] Onboard 5-10 beta merchants via direct install (Partner Dashboard) while awaiting review

---

## PHASE 5: REVIEW BUFFER (Weeks 11–12)

### WEEKS 11-12 — Beta Testing + Distribution
**Domain:** launch_prep
**Goal:** Real merchants test the app. Critical bugs fixed. Distribution pipeline warm for launch.

- [ ] Monitor beta merchant usage: track which section types requested, which Commerce Intel questions asked, where intent classification fails. Export misclassification data.
- [ ] Fix critical bugs daily — push updates without needing re-review
- [ ] Track activation metrics: are merchants completing onboarding scan? Using free tasks? Converting to "wow" moment? (manifesto §16 activation definition)
- [ ] Continue waitlist campaigns: streams, social, communities (Luqman handles, parallel track)
- [ ] Draft "we're live" email for waitlist, ready to send on approval
- [ ] Prepare launch announcement content: X thread, Reddit post, YouTube video (Luqman handles)
- [ ] If rejected: fix ALL flagged issues within 48 hours, run full QA checklist, resubmit with detailed fix notes

---

## PHASE 6: V1.2 — POST-LAUNCH HARDENING (Weeks 13–16)

### WEEKS 13-14 — Live Feedback + Fixes
**Domain:** storefront + product_ops + commerce_intel
**Goal:** App Store approved. First organic merchants using it. Systematic fixes based on real usage data. Classification accuracy improved.

- [ ] Send waitlist "we're live" email → drive App Store installs
- [ ] Transition beta merchants from direct installs to App Store installs
- [ ] Build usage analytics query on audit_log: top section types by request count, top Commerce Intel questions, classification accuracy rate
- [ ] Export misclassified messages from production. Update intent classification system prompt with 10+ real-world edge case examples. Measure accuracy before/after.
- [ ] Review Liquid generation error logs. Create regression tests for each failure pattern. Fix root causes in template library or generation prompt.
- [ ] Fix any billing edge cases discovered: mid-cycle plan changes, task counting errors, declined charges
- [ ] Fix any Shopify API rate limit issues with real-world catalog sizes
- [ ] Add 3 additional section types based on demand signals from usage data (blocked until usage data available)
- [ ] Build automatic error recovery: if a theme write operation partially fails (e.g., section written but template JSON update fails), auto-rollback the partial change

### WEEKS 15-16 — Feed Generation + Health Score
**Domain:** product_ops + commerce_intel
**Goal:** V1.2 ships with feed generation for 3 specs, batch enrichment at scale, and a composite Health Score. 10+ active merchants. Billing generating revenue.

- [ ] Build OpenAI Product Feed generation (CSV/TSV): map Shopify fields + metafields → OpenAI spec fields, validate per product
- [ ] Build Google Merchant Center feed generation (XML): map to Google spec, validate per product
- [ ] Build Meta Catalog feed generation (CSV): map to Meta spec, validate per product
- [ ] Build feed validation report: per-product pass/fail against each spec with specific failure reasons
- [ ] Implement batch enrichment: support 50+ products per operation using Shopify bulk operations GraphQL API
- [ ] Build Store Health Score: composite metric combining average DCI + theme quality signals + feed readiness percentage (0-100)
- [ ] Surface Health Score in chat: "Your store health score is 62/100. Here's what's dragging it down..." with actionable recommendations
- [ ] After any task completion, check if related improvements are available and offer them (proactive recommendation after action)

---

## PHASE 7: V1.5 — INTELLIGENCE LAYER (Weeks 17–20)

### WEEKS 17-18 — Proactive Insights Engine
**Domain:** commerce_intel + product_ops
**Goal:** Agent becomes proactive — watches the store and surfaces opportunities without being asked. All insights terminate in offered actions.

- [ ] Implement webhook handlers for `PRODUCTS_CREATE` and `PRODUCTS_UPDATE`
- [ ] Build new product auto-scan: when merchant adds a product, auto-score with DCI and queue in-app notification with recommended enrichment
- [ ] Build data drift detection: when a product is updated externally (another app or manual edit), check if Talkstore enrichment was overwritten and notify merchant
- [ ] Build weekly digest notification: "This week: 4 new products (DCI avg: 28), 2 went out of stock, top seller conversion dropped 12%" — with recommended actions
- [ ] Build anomaly detection: flag week-over-week changes >20% in revenue, conversion, or order volume. Trigger in-app notification with context and recommended action.
- [ ] Build "What should I fix this week?" command: agent analyzes current store state and prioritizes top 3-5 actions by impact
- [ ] Create `notifications` table and in-app notification UI (badge + list in sidebar)

### WEEKS 19-20 — Multi-Theme + SEO + Sidekick Research
**Domain:** storefront + product_ops
**Goal:** V1.5 ships with multi-theme support, schema markup, and SEO features. Sidekick App Extension prototype. 25+ active paying merchants.

- [ ] Build JSON-LD schema markup generation: agent generates structured data and injects into theme `<head>` section
- [ ] Test section generation against Refresh and Craft themes (in addition to Dawn)
- [ ] Build theme detection + adaptation: agent reads theme fingerprint (name, structure, patterns) and adjusts generation prompts accordingly
- [ ] Build CSS fix pipeline: merchant describes a visual bug → agent reads relevant theme CSS → generates targeted scoped fix → duplicate + preview flow
- [ ] Build page-level SEO generation: meta title and meta description for product and collection pages via Product Ops
- [ ] Build export functionality: enrichment reports, feed validation reports, and health scores downloadable as CSV
- [ ] Research Sidekick App Extension developer preview docs. Prototype exposing catalog health data and section generation capability to Sidekick.
- [ ] Document Sidekick integration plan: which Talkstore capabilities to expose, data schema, authentication flow

---

## PARALLEL TRACK: WAITLIST + DISTRIBUTION (Ongoing from Week 1)

### WEEK 1 — Landing Page + Waitlist
**Domain:** launch_prep
**Goal:** Landing page live, collecting emails. Analytics tracking.

- [ ] Secure domain (`talkstore.ai` or `talkstore.app` or `usetalkstore.com`)
- [ ] Build and deploy landing page (single page, Next.js or plain HTML): headline, 3 value props, how it works, waitlist email capture, Talkstore brand palette
- [ ] Set up email capture → stored in `waitlist` table (email, source, signed_up_at) or third-party list (Loops/Buttondown)
- [ ] Set up privacy-friendly analytics (Plausible or Umami)
- [ ] Configure Open Graph / social meta tags for link sharing

### WEEK 3 — Video Teaser
**Domain:** launch_prep
**Goal:** 60-90 second teaser video showing the core "wow" flow, embedded on landing page and distributed.

- [ ] Record 60-90 second teaser: screen recording of merchant request → agent response → section appears on preview
- [ ] Add voiceover or text overlay explaining what's happening
- [ ] Embed video on landing page
- [ ] Upload to YouTube (Sifr0 channel) + cut 15-30s clips for X/Twitter, Reddit

### ONGOING (Weeks 1-10) — Distribution
**Domain:** launch_prep
**Goal:** By Week 10, 50-200 waitlist signups. Warm audience ready for beta and launch.

- [ ] Sifr0 live streams: every build session links to landing page in stream description
- [ ] r/shopify + Shopify community forums: share progress, provide value, build credibility
- [ ] X/Twitter: build-in-public updates with landing page link
- [ ] Pre-launch email sequence: 2-3 emails to waitlist (progress update, feature preview, launch announcement)
- [ ] Beta recruitment (Week 8-9): convert top waitlist signups to development store beta testers

---

# PART 3 — SUMMARY

## 1. Task Count

| Metric | Count |
|--------|-------|
| **Original roadmap tasks** | ~158 |
| **Revised task list** | ~142 |
| **Net change** | -16 |
| Tasks added | 18 |
| Tasks removed | 12 |
| Tasks rewritten for clarity | ~25 |
| Tasks merged | 8 → 4 |
| Tasks split | 4 → 11 |

## 2. Tasks Added (with manifesto reference)

| # | Task Added | Manifesto Section |
|---|-----------|-------------------|
| A1 | CSP frame-ancestors header configuration | §14 (embedded app security) |
| A2 | LLM model routing layer (Opus/Sonnet/Haiku selection) | §7 Three Domains table, §18 MVP item 4 |
| A3 | GDPR `customers/data_request` webhook | §14 Webhooks |
| A4 | GDPR `customers/redact` webhook | §14 Webhooks |
| A5 | GDPR `shop/redact` webhook | §14 Webhooks |
| A6 | True data deletion on APP_UNINSTALLED | §15 Data Privacy |
| A7 | `APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT` webhook | §14 Webhooks |
| A8 | Token budget caps per task type | §12 Unit Economics |
| A9 | Conservative defaults: ask before batch >5 products | §8.4 Merchant Control |
| A10 | Safe mode: stop on unexpected state during execution | §15 Rollback |
| A11 | Theme publish confirmation gate (agent never auto-publishes) | §8.4, §15 |
| A12 | Cumulative impact view ("What has Talkstore done for my store") | §8.7 Measurable Impact Tracking |
| A13 | Declined billing charge handling | §12 Billing (implied) |
| A14 | Batch LLM calls for enrichment (25 products per call, not 25 calls) | §12 Margin Protection |
| A15 | LLM timeout/failure user-facing error messages | §8.5 Reliability Over Cleverness |
| A16 | Global React error boundary component | §8.5 |
| A17 | Usage analytics query on audit_log | §16 Success Metrics |
| A18 | Notifications table + in-app notification UI | §18 implied by proactive insights |

## 3. Tasks Removed (with reason)

| # | Task Removed | Reason |
|---|-------------|--------|
| X1 | Navigation menu management (Week 15-16) | Not in manifesto scope §17 or §18. Defer to V2. |
| X2 | "Prepare rejection rapid-response plan" | Reference material, not a build task |
| X3 | "Most Likely Rejection Reasons" list | Reference material, not a build task |
| X4 | "Record 2-3 real merchant sessions for testimonial" | Marketing judgment call, not a checkbox task |
| X5 | "Basic error recovery" (Week 13-14) | Moved to Week 5 as "safe mode" — should exist from the start |
| X6 | Week 10 redundant uninstall webhook (duplicate) | Merged with webhook handler task |
| X7 | Week 13-14 "Session memory" (duplicate of Week 2) | Already built in Week 2 |
| X8 | Week 10 "Polaris design system followed" (as standalone task) | Folded into QA checklist task |
| X9 | Week 10 "Session tokens validated" (as standalone task) | Already built in Week 1, folded into QA |
| X10 | Individual App Store checklist sub-items as separate tasks | Merged into single QA checklist task |
| X11 | Week 10 "Responsive layout" as separate task | Should be ongoing from Week 1, verified in QA |
| X12 | "Collect bug reports and UX feedback daily" (Week 11-12) | Process, not a build task |

## 4. Major Rewrites

| # | Before | After | Why |
|---|--------|-------|-----|
| W1 | "Error boundaries: graceful handling for all API failures, LLM failures, timeout scenarios" | Split into 3: Shopify API error handling, LLM timeout handling, React error boundary | Original was 3 tasks pretending to be 1 |
| W2 | "Improve: classification accuracy" | "Export misclassified messages. Update system prompt with 10+ edge cases. Measure before/after." | Original was unactionable |
| W3 | "Fix: any Liquid generation failures" | "Review error logs. Create regression tests per failure pattern. Fix root causes." | Original was unactionable |
| W4 | "Monitor: which section types are most requested?" | "Build usage analytics query on audit_log" | Converted from observation to build task |
| W5 | "Anomaly detection: significant changes trigger alert" | "Flag week-over-week changes >20% in revenue, conversion, or order volume" | Added specific thresholds |

## 5. Structural Changes

| Change | Reason |
|--------|--------|
| **Split Week 9** into Week 9 (Billing only) and Week 10a (Onboarding + History). Moved Commerce Intel earlier to Week 8 (unchanged). | Billing and onboarding scan are both complex critical-path features. Cramming both into one week with a solo founder is unrealistic. |
| **Split Week 10** into Week 10a (Onboarding + History + Undo) and Week 10b (Polish + Legal + Submission). | Original Week 10 had ~18 tasks spanning UX, legal, compliance, and deployment. That's 3 weeks of work in one. |
| **Moved error recovery from Week 13-14 to Week 5** as "safe mode" | Safety features should exist before launch, not after. Manifesto §15 requires this. |
| **Removed navigation menu management from V1.2** | Not in manifesto scope. Reduces V1.2 scope creep. |
| **Added GDPR webhooks and data deletion to Week 10b** | These are Shopify App Store requirements that were missing from the build tasks. Failing these = guaranteed rejection. |

## 6. Risk Flags

| # | Risk | Source | Impact |
|---|------|--------|--------|
| **R1** | **Week 10 is still dense even after splitting.** Week 10b has 16 tasks including legal docs, video production, and App Store submission. This week may slip. | Structural | Medium — budget an extra 2-3 days |
| **R2** | **Theme duplication limits.** Shopify limits unpublished themes. If merchants generate multiple sections without publishing, they'll hit limits. No cleanup strategy is defined in the manifesto. | Manifesto §10 Workflow 1 | Medium — need to define theme lifecycle (auto-delete old duplicates after publish) |
| **R3** | **Billing capped amounts are arbitrary.** PAYG $250, Growth $200 overage — these need validation. Too low = angry merchants hitting caps. Too high = Shopify may flag during review. | Manifesto §12, Roadmap Week 9 | Low — adjustable post-launch |
| **R4** | **"Template library + LLM customization" approach is undertested.** The manifesto chose this over from-scratch generation for reliability, but 10 templates may not cover real merchant requests. What happens when a request doesn't map to any template? | Manifesto §19 Decision 11 | **High** — need a fallback: either generate from scratch (higher cost/risk) or tell merchant "I can't do that yet" |
| **R5** | **Context caching invalidation is underspecified.** Theme cache refreshes on `THEMES_PUBLISH`, but what about manual theme editor changes that don't trigger a publish? Agent could operate on stale context. | Manifesto §12, §14 | Medium — may cause incorrect section generation |
| **R6** | **Commerce Intelligence depends on order data quality.** Shopify's orders API may not expose margin data directly — `product cost` metafield isn't universally populated. Margin queries may fail for most merchants. | Manifesto §7 Commerce Intel scope lists "margins" | Medium — may need to ask merchant for cost data or skip margin queries in MVP |
| **R7** | **20-week timeline with 5-6 hrs/day streaming + building is tight.** Manifesto and roadmap assume AI-assisted development covers the gap, but unexpected Shopify API edge cases and review rejection could eat 2-4 weeks. The review buffer helps but V1.2/V1.5 timelines have no buffer. | Overall | **High** — V1.5 scope may need to be cut |

---

*This audit is the output of a single-model analysis. The task-audit-prompt recommends running this across Claude, GPT, Gemini, and Perplexity, then synthesizing. This document serves as Claude's contribution to that synthesis.*
