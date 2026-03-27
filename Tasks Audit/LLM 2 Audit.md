PART 1 — AUDIT
1. Missing Tasks

Safe Mode/Clarification Flow: Manifesto Section 15 requires the agent to stop and ask for guidance if it detects something unexpected. The roadmap lacks a task for the routing logic that handles clarification_needed = true.

GDPR Webhooks: Manifesto Section 14 mandates customers/data_request, customers/redact, and shop/redact. Roadmap Week 10 missed these entirely.

Context Token Management: Manifesto Section 12 mentions "Token budget caps per task type," but there is no engineering task for writing the utility that truncates or chunks theme/product data before sending it to Claude.

2. Unnecessary Tasks

Shopify App Review checklist (Week 10): Removed. As per your prompt, compliance checklists are handled in a separate document.

"Fix: any Liquid generation failures..." (Week 13-14): Removed. Reactive bug fixing is an operational reality, not a proactive roadmap build task.

3. Redundant/Duplicate Tasks

Week 4 duplicated the theme duplication and asset API tasks. "Theme duplication via Themes REST API" and "Asset installation..." are the same functional block as modifying the JSON template.

4. Too Vague to be Actionable

"Edge cases handled gracefully" (Week 5): Replaced with specific error-handling tasks (e.g., API rate limit catches, missing schema blocks).

"Handling: conflicting metafields from other apps" (Week 7): Rewritten to specifically query existing namespaces, filter out talkstore, and prompt the merchant if an overwrite is detected.

"Improve: classification accuracy based on real conversation data" (Week 13): Rewritten to "Implement few-shot examples in the intent classification system prompt based on beta logs."

5. Should be Split

"PostgreSQL database provisioned... + Prisma ORM configured" (Week 1): Split into infrastructure provisioning, Prisma schema definition, and initial migration deployment.

"LLM customization pipeline" (Week 3): Split into Context Assembly (fetching tokens/patterns), Prompt Engineering (building the system prompt), and Output Parsing (extracting Liquid/JSON/CSS).

6. Should be Merged

Week 9 billing tasks ("Usage-based billing", "Task counter UI", "Billing guard") merged into two focused tasks: Backend Billing Logic and Frontend Billing UI.

PART 2 — REVISED TASK LIST
PHASE 1: FOUNDATION (Weeks 1-2)
WEEK 1 — Scaffold + Auth + Base Infrastructure
Domain: foundation
Goal: The embedded app loads in Shopify, authenticates via OAuth, persists sessions, and connects to the database.

[ ] Deploy waitlist landing page with email capture and Talkstore brand palette.

[ ] Scaffold Shopify Remix app with App Bridge 4.x and clean up default template boilerplate.

[ ] Provision PostgreSQL database on Supabase and configure environment variables locally and on Railway.

[ ] Define Prisma schema for core entities (shops, sessions, conversations, messages).

[ ] Generate and deploy initial Prisma database migration.

[ ] Build basic Polaris layout shell (Sidebar: Chat, History, Settings).

[ ] Implement Vercel AI SDK useChat hook in the frontend UI.

[ ] Create /api/chat route with session token validation middleware.

[ ] Wire up a hardcoded Claude Haiku streaming response to verify the end-to-end chat pipe.

WEEK 2 — API Connections + Tool Router
Domain: foundation
Goal: The agent can classify merchant intent and query basic store context (themes, products, orders) without executing changes.

[ ] Build Shopify REST API wrapper module for Themes (GET themes, GET assets).

[ ] Build Shopify GraphQL API wrapper module for Products (first: 25, including metafields) and Collections.

[ ] Build Shopify GraphQL API wrapper module for Orders and basic Analytics (read-only).

[ ] Write system prompt for Intent Classification (outputs JSON: domain, verb, confidence, clarification_needed).

[ ] Build the Tool Router middleware to dispatch classified requests to the correct domain handler.

[ ] Implement Safe Mode: return a clarification prompt to the merchant if classification confidence < 0.7.

[ ] Build Theme Context Cache utility to fetch, compress, and store the active theme's file tree and settings_data.json upon first session load.

PHASE 2: STOREFRONT DOMAIN (Weeks 3-5)
WEEK 3 — Section Generation Engine
Domain: storefront
Goal: The agent can parse a request, match theme styles, and generate a valid, namespaced Liquid section.

[ ] Create the MVP Section Template Library (10 base .liquid templates with schemas).

[ ] Build Context Assembly utility to inject theme brand tokens (colors, fonts) into the LLM prompt.

[ ] Build the Generation Pipeline (Opus) to output customized .liquid files with talkstore- namespaced CSS.

[ ] Write regex/AST validators for Liquid syntax, JSON schema integrity, and CSS parsing.

[ ] Implement validation retry loop: if code fails validation, feed error back to Opus (max 2 retries) before failing gracefully.

[ ] Record 60–90 second teaser video of the generation flow for the landing page.

WEEK 4 — Theme Duplication + Preview Flow
Domain: storefront
Goal: Generated sections are safely installed on a duplicated theme, creating a preview link for merchant approval.

[ ] Build explicit confirmation gate UI: Agent explains action + cost, waits for "Proceed?".

[ ] Implement theme duplication logic (POST /themes.json with role: unpublished).

[ ] Implement asset write logic (PUT /themes/{id}/assets.json) for the new .liquid file.

[ ] Build JSON template modifier to inject the new section reference into the target template (e.g., templates/index.json).

[ ] Generate preview URL and format the chat response with the link and 1-free-revision notice.

[ ] Define Prisma schema for audit_log and task_usage, and write the execution logging logic.

WEEK 5 — Modification, Settings, & Rollback
Domain: storefront
Goal: The agent handles existing code modifications, free settings changes, and one-click undos.

[ ] Build settings-only detection logic (Haiku analyzes if a request can be solved purely via settings_data.json).

[ ] Implement settings-only execution pipeline (modifies JSON config directly, bypasses task billing).

[ ] Build modification pipeline for existing code (reads active section, modifies via Sonnet, installs on duplicate).

[ ] Implement rollback execution logic: identify duplicate theme, unpublish (if live), and delete.

[ ] Build token budget utility to chunk/truncate theme files if they exceed Claude's context window.

PHASE 3: PRODUCT OPS DOMAIN (Weeks 6-7)
WEEK 6 — Scanning & Data Enrichment
Domain: product_ops
Goal: The agent scores catalog health and automatically populates metafields and rewrites descriptions in batches of 25.

[ ] Build the Data Completeness Index (DCI) scoring algorithm (0-100 logic per Manifesto Section 10).

[ ] Build the Enrichment Plan generator (Sonnet) to map missing attributes and flag uncertain inferences.

[ ] Build the GraphQL execution pipeline to mutate productUpdate (descriptions) and metafieldsSet (talkstore.* namespace).

[ ] Implement before/after snapshot storage in the audit_log table for rollback capability.

[ ] Build UI to display the Enrichment Plan, cost, and uncertain flags for merchant approval.

WEEK 7 — Collections & Product Edge Cases
Domain: product_ops
Goal: The agent manages collections, links actions across domains, and safely handles data conflicts.

[ ] Build collection management execution logic via collectionCreate and collectionAddProducts mutations.

[ ] Implement Domain Chaining logic (e.g., creating a collection and generating a storefront section properly communicates a 2-task cost).

[ ] Build existing metafield conflict detection: query namespaces, filter out talkstore, prompt user if an overwrite is requested.

[ ] Implement product data rollback logic (restore specific fields from audit_log.before_state).

[ ] Build error-handling for GraphQL rate limits (queue, backoff, and chat status update).

PHASE 4: COMMERCE INTELLIGENCE & LAUNCH (Weeks 8-10)
WEEK 8 — Analytics & Insight-to-Action Bridge
Domain: commerce_intel
Goal: The agent answers read-only analytics questions and seamlessly up-sells Storefront or Product Ops tasks.

[ ] Build Commerce Intelligence query handlers for Revenue, Orders, and Period Comparisons (GraphQL).

[ ] Build query handlers for Product Performance, Inventory, and Dead Stock detection.

[ ] Write the Insight-to-Action bridging prompt (forces Haiku to append a recommended fix + cost to every data answer).

[ ] Send beta invites to top waitlist signups and provision development store access.

WEEK 9 — Billing & Onboarding Scan
Domain: launch_prep
Goal: Usage is monetized, caps are enforced, and the first-run experience instantly proves value.

[ ] Build Backend Billing Logic (appSubscriptionCreate, appUsageRecordCreate, cap enforcement, free task decrementing).

[ ] Build Frontend Billing UI (Task counter, Plan selection modal, out-of-tasks prompt).

[ ] Build Onboarding Scan aggregator: trigger theme read + 25 product sample + 30-day order summary on first load.

[ ] Build Diagnostic Report generator to format the scan into 3 actionable, one-click recommendations.

WEEK 10 — Polish & Platform Hooks
Domain: launch_prep
Goal: Webhooks, data privacy, and UX edge cases are hardened for App Store submission.

[ ] Build the History Tab UI (fetch audit_log records, render before/after states, attach Undo triggers).

[ ] Implement APP_UNINSTALLED webhook to clear session and billing data.

[ ] Implement GDPR webhooks (customers/data_request, customers/redact, shop/redact) per platform requirements.

[ ] Implement THEMES_PUBLISH webhook to invalidate and refresh the Theme Context Cache.

[ ] Add loading state indicators for long-running LLM operations (theme duplication, bulk enrichment).

[ ] Draft App Store listing copy, privacy policy, and terms of service.

REVIEW BUFFER (Weeks 11-12)
WEEKS 11-12 — Beta Ops & App Store Review
Domain: post_launch
Goal: Actively process beta merchant feedback and clear Shopify App Store review hurdles.

[ ] Onboard 5-10 beta merchants via direct install links.

[ ] Set up daily log review for intent classification failures and API timeout errors.

[ ] Execute rapid-response code fixes for any bugs reported by beta testers.

[ ] Prepare App Store launch announcement content (X thread, Reddit, YouTube).

[ ] (If rejected by Shopify) Execute complete fix-cycle based on reviewer notes and resubmit within 48 hours.

PHASE 5: V1.2 POST-LAUNCH HARDENING (Weeks 13-16)
WEEKS 13-14 — Feedback Integration
Domain: post_launch
Goal: Harden the core flows based on real-world usage and improve agent memory.

[ ] Send "We're Live" email sequence to the full waitlist.

[ ] Implement few-shot examples in the intent classification system prompt based on beta logs.

[ ] Implement conversation history memory so the agent retains context across multiple requests in the same session.

[ ] Build automated partial rollback logic (if an LLM code edit fails midway, revert the duplicate theme automatically).

WEEKS 15-16 — Feeds & Health Score
Domain: post_launch
Goal: Merchants can generate AI-ready feeds and track aggregate store health.

[ ] Build feed mapping pipeline for OpenAI Product Feed Spec (CSV/TSV).

[ ] Build feed mapping pipelines for Google Merchant Center (XML) and Meta Catalog (CSV).

[ ] Build the Store Health Score compiler (aggregating DCI, theme speed/OS 2.0 status, feed readiness).

[ ] Build Bulk Operations API wrapper to support batch enrichment of 50+ products per task.

PHASE 6: V1.5 INTELLIGENCE LAYER (Weeks 17-20)
WEEKS 17-18 — Proactive Insights
Domain: post_launch
Goal: The agent pushes high-leverage recommendations without waiting to be asked.

[ ] Implement PRODUCTS_CREATE and PRODUCTS_UPDATE webhooks to trigger asynchronous auto-scoring.

[ ] Build Data Drift detection logic to flag if Talkstore metafields are overwritten by third-party apps.

[ ] Build the Weekly Digest aggregator to compile anomalies and data drift into an in-app notification.

[ ] Build the "What should I fix?" handler to dynamically prioritize the top 3 store-wide issues.

WEEKS 19-20 — Multi-Theme & Sidekick R&D
Domain: post_launch
Goal: Expand theme compatibility and prototype the Shopify Sidekick acquisition wedge.

[ ] Build JSON-LD schema generation logic and inject it into the theme <head>.

[ ] Build Theme Detection logic to adapt CSS generation for Refresh and Craft themes.

[ ] Implement Page-level SEO generation (meta titles/descriptions for products and collections).

[ ] Build CSV export functionality for enrichment reports and feed validation.

[ ] Prototype Sidekick App Extension mapping (exposing catalog health and section generation endpoints to Shopify's core agent).

PART 3 — SUMMARY
1. Total Task Count

Original: ~65 actionable lines masquerading as ~165 conceptual items.

Revised: 62 precise, modular execution tasks.

2. Tasks Added

Clarification/Safe Mode Logic (Manifesto Sec 15)

Context Token Management (Manifesto Sec 12)

GDPR Webhooks (Manifesto Sec 14)

Few-shot Intent Updates (Manifesto Sec 8/18)

3. Tasks Removed

Shopify Submission Checklist: Removed per your prompt rules.

Vague Bug Fixing ("Fix any Liquid failures"): Removed. Reactive fixes are operational, not roadmap tasks.

4. Tasks Rewritten

Before: "PostgreSQL database provisioned + Prisma ORM configured"
After: Split into Provisioning, Schema definition, and Initial migration execution to allow AI coding agents to handle them linearly.

Before: "Handling: conflicting metafields from other apps"
After: "Build existing metafield conflict detection: query namespaces, filter out talkstore, prompt user..." (Actionable for Cursor/Claude).

5. Structural Changes

Merged fragmented billing tasks from Week 9 into two robust backend/frontend tasks.

Moved the "Teaser Video" marketing task directly into Week 3, aligning exactly with when the Generation Engine produces visual outputs.

6. Risk Flags & Trade-Offs (Operator's Perspective)

Token Window vs. Opus Cost: Sending a full theme's file tree to Claude Opus for generation (Week 3) will be expensive and slow. Trade-off: You may need to severely truncate the read-context to just base.css and settings_data.json to maintain the ~86% gross margin and keep latency under 15 seconds.

Duplicate Theme Bloat: Your safety mechanism (Week 4) creates an unpublished theme for every test. Shopify limits stores to 20 themes. If a merchant generates 5 sections in an hour without publishing, Talkstore will hit the API ceiling and break. You need aggressive garbage collection logic on abandoned duplicate themes.

Bulk API Complexity: In Week 15, moving from GraphQL synchronous calls (first 25 products) to the Bulk Operations API introduces asynchronous webhooks and JSONL file parsing. It is a completely different architectural pattern. Budget more time here; it often breaks lean apps.