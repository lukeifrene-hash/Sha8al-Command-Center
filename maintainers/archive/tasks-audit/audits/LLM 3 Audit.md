PART 1 - AUDIT
1) Missing tasks

These are required by the manifesto but not clearly represented as executable tasks in the roadmap:

Success-metric instrumentation is missing. The manifesto defines activation, retention, north-star and guardrail metrics, but the roadmap does not turn those into concrete instrumentation tasks until too late, and even then only partially. You need explicit tasks for scan completion, first task execution, result viewed, undo rate, enrichment acceptance rate, and uninstall tracking.

Explainability is under-specified as implementation work. The manifesto says every action must include plain-language explanation and every diagnostic must include reasoning, but the roadmap mostly treats this as copy inside examples rather than a tasked UX layer.

Least-privilege / no-PII enforcement is missing as code work. The manifesto forbids customer PII access and says permission discipline matters, but the roadmap does not assign explicit guardrail tasks for aggregated-only responses, redaction-safe logging, and scope review logic.

Safe-mode stop behavior is missing as an explicit task. The manifesto says the agent should stop and ask for guidance if something unexpected happens during execution. The roadmap has generic error handling, but not a concrete “safe mode” implementation task.

Merchant-visible cumulative impact is missing. The manifesto requires merchants to see cumulative impact and a store-wide Health Score after actions; the roadmap adds Health Score later, but not a clear cumulative impact summary tied to audit history.

Usage-cap warning webhook support is missing. The manifesto includes APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT, but the roadmap does not explicitly task it.

Batch-size approval discipline is missing. The manifesto says the agent asks before batch-modifying more than 5 products, but the roadmap only has general confirmation gates.

2) Unnecessary or out-of-scope tasks

Submission checklist bullets should not live inside the build plan. The audit prompt explicitly says not to duplicate the submission checklist into build tasks. Week 10 currently mixes implementation with review/compliance checklist items.

“Navigation menu management” is out of scope. It is not in the manifesto’s scope boundaries, MVP scope, or V1.2 workflow set.

“Page-level SEO meta title/meta description generation” is not core to the manifesto. The manifesto explicitly says Talkstore is not an SEO tool. JSON-LD/schema support is defensible; full SEO-copy expansion is not core.

Timeline visual, cost projection, decision log, and rejection-reasons prose are planning/support docs, not canonical tasks.

“App Store approval received” is a milestone outcome, not a task.

3) Redundant / duplicate tasks

Conversation continuity appears twice. “Conversation context maintained across messages” in Week 2 overlaps with “Session memory: context carries across messages” in Weeks 13-14.

Free-revision logic appears twice. It is introduced in Week 4 and then repeated in Week 5.

Error handling is spread across Week 5, Week 10, and Weeks 13-14 with overlapping intent.

Insight-to-action logic is repeated in Week 8 and again in Weeks 15-16 without clear distinction.

Rollback exists in multiple places without one canonical implementation path. There are separate rollback tasks for storefront, product ops, and history undo, but the roadmap does not define a unified rollback service.

4) Too vague to be actionable

These need rewriting into real build tasks:

“Intent classification system built”

“Tool router dispatches to correct domain handler”

“Agent can now answer questions about the merchant’s store”

“Section generation tested against Dawn theme for all 10 types”

“Commerce Intelligence query handler”

“Improve classification accuracy based on real conversation data”

“Anomaly detection”

“Theme detection + adaptation”

“Sidekick integration plan”
All of these describe outcomes, not bounded work sessions.

5) Tasks that should be split

Landing page live should be split into page build, waitlist capture, analytics, and metadata.

Shopify GraphQL Admin API connected should be split into products, collections, and orders/analytics reads.

Onboarding scan flow should be split into theme scan, catalog scan, order summary, report generation, and first-run trigger.

Store Health Score should be split into formula, computation, surface area, and downstream recommendation usage.

App Store listing written should be split from submission/compliance work.

6) Tasks that should be merged

Preview delivery + explanation of what was done should be one execution-result task.

Task consumption tracking + usage charge creation should live behind one entitlement/billing service.

Shared snippet detection + vintage theme detection + low-confidence fallback should become one storefront safety heuristics layer.

Task counter UI + plan selection UI + upgrade prompts should be one merchant billing surface.

PART 2 - REVISED TASK LIST

This version keeps the roadmap’s week structure, keeps the marketing parallel track, strips out non-build checklist duplication, and makes tasks traceable to the manifesto’s workflows, principles, scope boundaries, and MVP/V1.2/V1.5 commitments.

PHASE 0: PARALLEL TRACK (Weeks 1-10)
WEEK 1 - Landing Page + Waitlist

Domain: launch_prep
Goal: A live waitlist page exists, captures leads, and explains the MVP clearly.

 Secure the primary launch domain and point DNS to the landing-page host.

 Build a single-page landing page with hero, 3 value props, “how it works,” repeated waitlist CTA, and footer links.

 Implement waitlist form submission to a waitlist table or approved third-party email list.

 Add lightweight analytics for page views, CTA clicks, and waitlist submissions.

 Add Open Graph, title, description, favicon, and social preview metadata.

WEEK 3 - Teaser Asset

Domain: launch_prep
Goal: A short teaser demonstrates the core “request → preview” loop and can be reused across channels.

 Record a 60-90 second demo using a dev store that shows request, agent response, and generated preview.

 Publish the teaser on the landing page and upload the canonical version to YouTube.

 Export short cuts for X, Reddit, and short-form social posting.

WEEKS 1-10 - Ongoing Distribution

Domain: launch_prep
Goal: The build creates a warm list before App Store submission.

 Add the landing-page link to every stream description, profile, and public build update.

 Run a weekly posting loop across r/shopify, Shopify forums, and X with one proof-of-work update.

 Send 2-3 pre-launch waitlist emails covering progress, feature preview, and launch notice.

 Recruit beta merchants from the highest-intent waitlist leads during Weeks 8-9.

PHASE 1: FOUNDATION (Weeks 1-2)
WEEK 1 - Scaffold + Auth + Shell

Domain: foundation
Goal: A merchant can install the embedded app, open chat, and receive a streamed model response.

 Scaffold the app from the official Shopify Remix template.

 Implement install/OAuth flow and session-token validation for all authenticated routes.

 Add App Bridge and a Polaris shell with Chat, History, and Settings navigation.

 Create /api/chat with streaming responses from Claude Haiku using the Vercel AI SDK.

 Define and migrate the initial Prisma schema for shops, sessions, conversations, and messages.

 Provision Supabase Postgres and Railway deployment, and confirm auto-deploy from main.

 Add encrypted storage helpers for shop and session access tokens.

WEEK 2 - Router + Store Reads

Domain: foundation
Goal: ASK flows work across theme, product, and order data with persisted conversation state.

 Define the classifier output contract { domain, verb, confidence, clarification_needed }.

 Implement the tool router that maps classifier results to storefront, product-ops, commerce-intel, or conversation handlers.

 Build Shopify API clients for theme reads, product reads, collection reads, order reads, and billing primitives.

 Implement theme-context caching for file tree, theme role, brand tokens, and sections in use.

 Implement product-sample caching for 25 products with variants and metafields.

 Persist conversation messages with domain, verb, model, token counts, and task-consumed flags.

 Enforce aggregated-only answers for customer/order analytics and block any response path that would expose customer PII.

 Add explanation and clarification templates so ASK responses are consistent, plain-language, and confidence-aware.

PHASE 2: STOREFRONT (Weeks 3-5)
WEEK 3 - Section Generation Engine

Domain: storefront
Goal: The app can generate validated, theme-matched Liquid sections from a template library.

 Create the 10-section MVP template library with Liquid markup and schema blocks.

 Define the prompt contract for template selection and section generation from merchant intent.

 Implement theme-pattern extraction for colors, fonts, spacing, and heading conventions.

 Add Liquid syntax validation before any write occurs.

 Add JSON schema validation for generated section settings.

 Add CSS namespacing and class-collision checks for all generated sections.

WEEK 4 - Duplicate Theme + Preview Flow

Domain: storefront
Goal: A merchant can approve a section request and receive a preview link on an unpublished duplicate theme.

 Implement theme duplication against the active theme and persist duplicate theme IDs.

 Write generated section assets into the duplicate theme.

 Read, patch, and rewrite the target JSON template to place the new section in the requested location.

 Generate the preview URL and return a result message with a plain-language explanation of what changed.

 Write an audit-log entry containing domain, action type, files changed, before/after state, and preview URL.

 Implement the explicit approval gate that quotes cost before execution.

 Implement one free revision state so one follow-up adjustment does not re-charge the task.

WEEK 5 - Modification + Storefront Safety

Domain: storefront
Goal: Existing theme changes, settings-only edits, and storefront rollback all work safely.

 Implement the code-modification path for existing sections and CSS-targeted edits.

 Implement settings-only detection and free JSON-config edits when no code change is required.

 Add storefront safety heuristics for shared snippets, vintage themes, and low-confidence edits.

 Implement storefront rollback from the audit log for duplicate-theme changes.

 Add safe-mode behavior that stops execution and asks for guidance when an unexpected write-state is detected.

 Add a mobile-preview reminder and success/failure/retry messaging to all storefront result states.

PHASE 3: PRODUCT OPS (Weeks 6-7)
WEEK 6 - Product Scan + Enrichment

Domain: product_ops
Goal: The app can score products, propose enrichment, and execute approved batch updates safely.

 Implement a normalized full-product reader for title, description, variants, images, tags, product type, category, and all metafields.

 Implement the DCI scorer using the 7 weighted categories defined in the manifesto.

 Persist per-product DCI and store-wide aggregate DCI snapshots.

 Build an enrichment planner that labels values as certain, inferred, or unresolved.

 Implement the metafield write pipeline using Shopify-native category fields first and talkstore.* only when needed.

 Implement the description-rewrite prompt and productUpdate mutation flow.

 Require merchant approval before batch writes, and require an extra confirmation when the batch exceeds 5 products.

WEEK 7 - Collections + Rollback + Edge Cases

Domain: product_ops
Goal: Collections and product rollback work, and the main catalog edge cases are handled.

 Implement collection create/update flows for manual and rule-based collections.

 Implement chained collection + storefront quoting so multi-domain requests are priced before execution.

 Implement one-click product rollback from audit_log.before_state.

 Add “missing description” handling that generates a draft description and marks it for review.

 Add conflict handling for third-party metafields and same-language handling for non-English catalogs.

 Add throttling, queueing, and retry/backoff for product write operations.

PHASE 4: LAUNCH PREP (Weeks 8-10)
WEEK 8 - Commerce Intelligence

Domain: commerce_intel
Goal: ASK and RECOMMEND work for the main analytics questions and always bridge to action when relevant.

 Implement analytics query classification for revenue, orders, margin, inventory, product performance, customer cohorts, comparisons, and dead stock.

 Build revenue and order handlers using read-only Shopify data.

 Build product-performance, customer-cohort, and inventory handlers using aggregated outputs only.

 Implement period-comparison and dead-stock calculators.

 Enforce “text answers only” for analytics responses and block charts/dashboards.

 Implement the insight-to-action recommendation engine that proposes storefront or product-ops fixes after every relevant answer.

 Add reasoning-rich response templates so diagnostics explain why a gap matters, not just that it exists.

WEEK 9 - Billing + Onboarding Scan

Domain: launch_prep
Goal: Plans, task entitlements, and the onboarding scan all work end to end.

 Integrate subscription creation for Growth and Pro plans.

 Integrate usage-charge creation for PAYG and plan overages.

 Implement the entitlement service for Free, PAYG, Growth, and Pro task accounting.

 Build the merchant billing surface with task counter, plan selector, and upgrade prompts.

 Implement the onboarding theme-scan module for theme name, role, section count, OS 2.0 status, and brand tokens.

 Implement the onboarding catalog-scan module for 25-product sampling, DCI summary, and top gaps.

 Implement the onboarding orders-summary module for the last 30 days.

 Compose the first-run diagnostic report with reasoning and 3 recommended actions, and trigger it on first session or manual rescan.

WEEK 10 - History + Safety + Submission

Domain: launch_prep
Goal: Undo, privacy, webhook refreshes, and launch-critical UX are in place before submission.

 Build the History tab from audit-log data.

 Wire undo actions in History to storefront and product-ops rollback services.

 Register and handle THEMES_PUBLISH, APP_SUBSCRIPTIONS_UPDATE, APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT, and SHOP_UPDATE.

 Implement APP_UNINSTALLED, customers/data_request, customers/redact, and shop/redact handlers with real deletion/cancellation behavior.

 Add free-tier rate limiting and abuse guards for chat usage.

 Add loading, retry, and error-boundary UX for long-running operations.

 Finalize listing copy/assets and submit the app to the Shopify App Store.

PHASE 5: REVIEW BUFFER (Weeks 11-12)
WEEKS 11-12 - Beta Triage + Review Response

Domain: launch_prep
Goal: Real merchant usage informs fixes while the app is under review.

 Onboard 5-10 beta merchants through direct install while review is pending.

 Run daily triage on beta sessions and bucket issues into theme, billing, routing, and UX.

 Patch critical bugs found in beta for theme writes, billing, throttling, or undo behavior.

 Review the install → scan → first task → result viewed funnel and fix the biggest activation drop-offs.

 Capture permissioned beta proof for later case studies or listing assets.

 If review is rejected, batch all fixes and resubmit within one pass.

PHASE 6: V1.2 (Weeks 13-16)
WEEKS 13-14 - Live Feedback + Hardening

Domain: post_launch
Goal: Real-merchant failures are fixed and the most-requested gaps are closed.

 Send the “we’re live” email and launch-post set once approval lands.

 Transition beta merchants from direct-install usage to the public install path.

 Fix real-theme Liquid failures and any rollback gaps discovered in production.

 Fix billing edge cases, task-count drift, and catalog-size rate-limit failures found in live usage.

 Tune classifier behavior and conversation memory using labeled production conversations.

 Add 3 demand-driven section templates based on observed merchant requests.

WEEKS 15-16 - Feeds + Health Score

Domain: post_launch
Goal: Feed generation and measurable merchant impact become part of the product.

 Implement OpenAI Product Feed file generation and download.

 Implement Google Merchant Center feed generation and download.

 Implement Meta Catalog feed generation and download.

 Implement per-product validation reports with failing-field summaries for each feed spec.

 Implement 50+ product enrichment using Shopify Bulk Operations.

 Define and compute the composite Health Score from DCI, theme quality, and feed readiness.

 Surface Health Score and cumulative impact summary in chat/history after scans and actions.

 Run a post-action recommendation check using health-score and feed-validation deltas.

PHASE 7: V1.5 (Weeks 17-20)
WEEKS 17-18 - Proactive Insights

Domain: post_launch
Goal: The app can watch for store changes and proactively recommend fixes in-app.

 Create the notifications data model and in-app notification center.

 Handle PRODUCTS_CREATE with auto-scan and queued recommendation generation.

 Handle PRODUCTS_UPDATE with data-drift detection against prior enrichment snapshots.

 Generate a weekly in-app digest with top changes and recommended actions.

 Detect anomalies in revenue, order volume, or top-product performance and create in-app alerts.

 Implement the “What should I fix this week?” prioritization command.

WEEKS 19-20 - Multi-Theme + Advanced Storefront Support

Domain: post_launch
Goal: Storefront generation works beyond Dawn and the next-platform wedge is documented without becoming a shipping dependency.

 Build a multi-theme test suite for Dawn, Refresh, and Craft.

 Implement theme fingerprint detection and generation-adaptation rules per supported theme family.

 Implement the CSS-fix pipeline for merchant-described visual bugs.

 Implement JSON-LD/schema markup generation for supported product and collection templates.

 Document Sidekick App Extension requirements and map which Talkstore capabilities should be exposed in V2.

PART 3 - SUMMARY
1) Total task count

Original: ~165 checkbox tasks, per the audit prompt’s description of the current roadmap.

Revised: 112 canonical tasks.

2) Tasks added

Added because the manifesto requires them but the roadmap did not make them executable:

Success-metric instrumentation - activation, result-viewed, undo/error, and retention event tracking. - Manifesto Section 16.

Explainability layer - explicit response templates for action explanations and diagnostic reasoning. - Manifesto Section 8.

PII / least-privilege guardrails - aggregated-only analytics responses and scope discipline. - Manifesto Sections 8, 14, 15, 17.

Safe mode - stop and ask for guidance on unexpected execution state. - Manifesto Section 15.

Usage-cap warning support - APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT. - Manifesto Section 14.

Cumulative impact summary - merchant-visible “what Talkstore has done” view. - Manifesto Section 8 measurable impact tracking.

Extra confirmation for large product batches - Manifesto Section 8 merchant control.

3) Tasks removed

Submission checklist bullets inside Week 10 - removed because the audit prompt says checklist duplication does not belong in the build task list.

Navigation menu management - removed as out of scope relative to manifesto Sections 17-18.

Page-level SEO meta title/meta description generation - removed as drift away from the product’s core wedge.

Timeline visual / cost projection / decision log / rejection-reasons prose - removed from canonical tasks because they are reference material, not executable work.

“App Store approval received” - removed because it is an outcome, not a task.

4) Tasks rewritten

A few representative before/after examples:

Before: “Intent classification system built”
After: “Define classifier output contract” + “Implement tool router” + “Add explanation and clarification templates.”

Before: “Landing page live”
After: “Build page” + “Implement waitlist storage” + “Add analytics” + “Add metadata.”

Before: “Onboarding scan flow”
After: theme-scan module + catalog-scan module + orders-summary module + diagnostic composer/trigger.

Before: “Store Health Score”
After: define formula + compute score + surface it in chat/history + use it in post-action recommendations.

Before: “Error handling” scattered across multiple weeks
After: storefront safe mode, launch UX error/retry, beta bug triage, and production hardening split by phase.

5) Structural changes

Moved beta onboarding from Week 10 into the review buffer. Submission stays in Week 10; hands-on beta ops live where they belong.

Moved privacy/redaction/uninstall behavior out of checklist language and into explicit implementation tasks in Week 10.

Collapsed duplicate revision/error/context tasks into single canonical implementations.

Kept Sidekick work as bounded V2/R&D documentation, not a shipping dependency. The manifesto frames App Extensions as V2, while the roadmap had started to pull it toward V1.5.

6) Risk flags

Pricing ambiguity: The manifesto says “one request = one task,” but it also defines 1 task per 25 products, 2-task chained operations, and 1 task per feed. You need a strict quoting rule so the agent always states task count deterministically before execution.

Gross-margin queries are underspecified: The manifesto says merchants can ask margin questions, but neither document clearly defines the COGS source of truth or fallback behavior when costs are missing.

Health Score formula is not defined: The roadmap names it; the manifesto requires it; neither gives a canonical weighting formula.

Feed-generation success depends on merchant-supplied fields like GTIN. The product needs a clearer unresolved-fields workflow or merchants will blame the app for data they do not have.

Sidekick work can become scope creep fast. Keep it as R&D/docs only until the storefront and product-ops engine is stable.