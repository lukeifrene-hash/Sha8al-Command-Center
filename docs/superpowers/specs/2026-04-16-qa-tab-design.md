# QA Verification Tab — Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Location:** Talkstore Command Center (Electron app)

## Problem

Talkstore has 28 distinct EXECUTE use cases across 11 groups. The app is built, but there's no structured way to verify that every use case works end-to-end. The operator tests manually in the browser and has no record of what's been tested, what passed, and what failed. The diagnostic agent can test via the API but has nowhere to record results. There is no readiness gate before Shopify submission.

## Solution

A new **QA tab** in the command center that lists all 28 use cases, supports dual verification (agent + operator), auto-pushes failures to the Review tab, and shows a readiness score.

---

## Data Model

New `qa` key in `talkstore-tracker.json`:

```json
{
  "qa": {
    "groups": [
      {
        "id": "product_enrichment",
        "name": "Product Enrichment",
        "use_cases": [
          {
            "id": "enrich_missing_attributes",
            "name": "Enrich products with missing attributes",
            "task": "processBatch",
            "scope": "write_products",
            "built": true,
            "test_prompt": "Fix my top 25 products",
            "agent_status": "untested",
            "agent_tested_at": null,
            "agent_notes": null,
            "operator_status": "untested",
            "operator_tested_at": null,
            "operator_notes": null,
            "review_fix_id": null
          }
        ]
      }
    ]
  }
}
```

### Status Values

- `untested` — not yet tested
- `pass` — tested and verified working
- `fail` — tested and found broken

A use case is **fully verified** only when `agent_status === "pass" AND operator_status === "pass"`.

### The 28 Use Cases (11 Groups)

**Group 1: Product Enrichment (5)**
| ID | Name | Task | Test Prompt |
|---|---|---|---|
| `enrich_missing_attributes` | Enrich products with missing attributes | `processBatch` | "Fix my top 25 products" |
| `add_material_color_dimensions` | Add material/color/dimensions | `processBatch` | "Add material and color data to my snowboards" |
| `fix_alt_text` | Fix alt text for SEO | `processBatch` | "Fix alt text on all my product images" |
| `vision_save_attributes` | Vision analysis → save attributes | `processBatch` | "Look at my product photos and fill in the details" |
| `score_and_fix` | Score catalog + fix gaps | `processBatch` | "Score my catalog health and fix the gaps" |

**Group 2: Product Descriptions (3)**
| ID | Name | Task | Test Prompt |
|---|---|---|---|
| `rewrite_factual` | Rewrite to factual/structured | `rewriteProductDescription` | "Rewrite my best seller's description to be factual" |
| `rewrite_seo` | Make SEO-friendly | `rewriteProductDescription` | "Make The Complete Snowboard's description SEO-friendly" |
| `rewrite_specs` | Convert marketing to specs | `rewriteProductDescription` | "Convert my product descriptions from marketing fluff to specs" |

**Group 3: Collection Creation (3)**
| ID | Name | Task | Test Prompt |
|---|---|---|---|
| `create_seasonal` | Create seasonal collection | `createCollection` | "Create a Summer Sale collection with seasonal products" |
| `create_clearance` | Group clearance/dead-stock | `createCollection` | "Create a clearance collection for products that haven't sold" |
| `create_new_arrivals` | Create New Arrivals | `createCollection` | "Create a New Arrivals collection from products added this month" |

**Group 4: Collection Management (1)**
| ID | Name | Task | Test Prompt |
|---|---|---|---|
| `add_to_collection` | Add products to existing collection | `addProductsToCollection` | "Add my snowboards to the Winter Sports collection" |

**Group 5: Blog & Articles (3)**
| ID | Name | Task | Test Prompt |
|---|---|---|---|
| `blog_topic` | Write topic-driven blog post | `createBlogPost` | "Write a blog post about snowboard maintenance" |
| `blog_gift_guide` | Create catalog-aware gift guide | `createBlogPost` | "Create a holiday gift guide based on my best sellers" |
| `blog_how_to` | Write educational how-to | `createBlogPost` | "Write a how-to article about choosing the right snowboard size" |

**Group 6: Collection Descriptions (1)**
| ID | Name | Task | Test Prompt |
|---|---|---|---|
| `collection_seo_desc` | Write SEO descriptions for collections | `writeCollectionDescriptions` | "Write SEO descriptions for all my collections" |

**Group 7: SEO Meta Tags (2)**
| ID | Name | Task | Test Prompt |
|---|---|---|---|
| `meta_tags_generate` | Generate meta titles + descriptions | `generateMetaTags` | "Generate SEO meta tags for my top 10 products" |
| `meta_tags_sweep` | Bulk SEO sweep | `generateMetaTags` | "Do an SEO sweep across all my products" |

**Group 8: Pages (3) — NOT BUILT**
| ID | Name | Task | Scope Needed | Test Prompt |
|---|---|---|---|---|
| `page_landing` | Create promotional landing page | `createPage` | `write_content` (have it) | "Create a landing page for my summer sale" |
| `page_faq` | Build FAQ page from catalog | `createPage` | `write_content` (have it) | "Build an FAQ page based on my product catalog" |
| `page_about` | Write About Us page | `createPage` | `write_content` (have it) | "Write an About Us page for my store" |

**Group 9: Structured Data (3) — NOT BUILT**
| ID | Name | Task | Scope Needed | Test Prompt |
|---|---|---|---|---|
| `metaobj_size_guide` | Create size guides | `createMetaobject` | App-owned (`$app:`) | "Create size guides for my apparel products" |
| `metaobj_materials` | Build materials database | `createMetaobject` | App-owned (`$app:`) | "Build a materials database with care instructions" |
| `metaobj_ingredients` | Generate ingredient lists | `createMetaobject` | App-owned (`$app:`) | "Generate ingredient lists for my skincare products" |

**Group 10: Discount Codes (3) — NOT BUILT**
| ID | Name | Task | Scope Needed | Test Prompt |
|---|---|---|---|---|
| `discount_targeted` | Create targeted discount code | `createDiscountCode` | `write_discounts` (optional) | "Create a 20% off code for my slow-moving inventory" |
| `discount_shipping` | Create free shipping code | `createDiscountCode` | `write_discounts` (optional) | "Create a free shipping code for orders over $50" |
| `discount_loyalty` | Generate loyalty code | `createDiscountCode` | `write_discounts` (optional) | "Generate a loyalty discount code for returning customers" |

**Group 11: Automatic Discounts (1) — NOT BUILT**
| ID | Name | Task | Scope Needed | Test Prompt |
|---|---|---|---|---|
| `discount_automatic` | Set up automatic discount | `createAutomaticDiscount` | `write_discounts` (optional) | "Set up a buy-one-get-one for my summer collection" |

---

## MCP Tools

### `get_qa_status`
**Who:** Agent or operator
**Returns:** All groups with use case statuses, plus readiness summary (verified/total, agent progress, operator progress).

### `mark_qa_result`
**Who:** Both
**Params:**
- `use_case_id` (string, required) — e.g., `"enrich_missing_attributes"`
- `tester` (string, required) — `"agent"` or `"operator"`
- `status` (string, required) — `"pass"` or `"fail"`
- `notes` (string, optional) — failure details or observations

**Behavior:**
- Sets `{tester}_status`, `{tester}_tested_at` (ISO timestamp), `{tester}_notes`
- If `status === "fail"`: auto-calls `push_qa_failure` to create a fix in the Review tab
- Returns updated use case object

### `reset_qa_result`
**Who:** Operator only
**Params:**
- `use_case_id` (string, required)

**Behavior:**
- Resets BOTH `agent_status` and `operator_status` to `"untested"`
- Clears both `_tested_at` and `_notes` fields
- Clears `review_fix_id`
- Both testers must re-verify after a reset

### Auto-push on failure
When `mark_qa_result` is called with `status: "fail"`:
1. Create a fix entry in the **Fixes Section** at the bottom of the Review tab (the aggregated fixes inbox — NOT inside a debug lane or review session). The fix is appended to the `fixes[]` array of the most relevant existing review session, or a dedicated `qa_failures` session is auto-created if none exists.
2. Fix label: `"QA: {use case name} — {tester} fail"`
3. Fix notes: test prompt + failure notes + use case ID
4. Fix severity: `"major"`
5. Store the fix ID in the use case's `review_fix_id` field for back-linking
6. The fix appears in the Fixes inbox with a "Push" button to promote it to a task on the debug_review milestone — same pattern as all other fixes in that section.

---

## UI

### Tab
- Position: after the Review tab (7th tab)
- Icon: `◎` 
- Label: "QA"
- Notification dot: if any use case has `fail` status

### Top Bar — Readiness Score

```
QA Verification                              12/28 verified  ████████░░░░░░░  43%
                                             Agent: 18/28 · Operator: 14/28
```

- "Verified" = both agent AND operator passed
- Agent count = how many use cases the agent has passed
- Operator count = how many the operator has passed
- Progress bar color: accent teal when > 80%, warning amber when 50-80%, red when < 50%

### Main Area — Collapsible Groups

**Collapsed row:**
```
▸ Product Enrichment          5 use cases     Agent ●●●●● Operator ●●●○○     3/5 verified
```

- Green dot = pass, red dot = fail, gray dot = untested
- Fraction = fully verified count (both passed)
- Group row background tint: green if all verified, red if any fail, neutral otherwise

**Expanded row (individual use case):**
```
  Enrich products with missing attributes
  "Fix my top 25 products"                         Agent ✓ Apr 16    Operator ✓ Apr 16
                                                   [Copy Prompt]

  Fix alt text for SEO
  "Fix alt text on all my product images"          Agent ✓ Apr 16    Operator ✗ Apr 16
  Notes: "Alt text generated but not saved"        [Copy Prompt] [PASS] [FAIL] [Reset]
                                                   → Review #fix-0042
```

- Test prompt shown in muted text below the name
- Two status columns with icon + date
- [Copy Prompt] always visible — copies test prompt to clipboard
- [PASS] [FAIL] buttons visible when operator status is `untested` or after a reset
- [Reset] button visible when any status is set (clears both for retest)
- If failed: notes displayed, link to Review fix
- If not built: row is grayed out, no action buttons, shows "Not built — requires {scope}"

### Bottom Section — Not Built

```
─── Not Built (10 use cases) ──────────────────────────────────
Pages (3) · write_content (have it — needs implementation)
Structured Data (3) · app-owned metaobjects (no scope needed)
Discount Codes (3) · write_discounts (optional scope — not yet requested)
Automatic Discounts (1) · write_discounts (optional scope — not yet requested)
```

Non-interactive. Grayed out. Always visible so the full 28 is represented.

---

## Failure → Review Flow

1. Either tester marks FAIL → auto-push to Review tab's Fixes Section (bottom inbox)
2. Fix appears in the Fixes inbox with back-link to use case ID, promotable to a debug_review task via "Push"
3. QA row shows red status + link to fix
4. Developer fixes the bug
5. Operator clicks Reset on the QA row → both statuses clear to untested
6. Agent re-runs diagnostic → marks agent result
7. Operator retests manually → marks operator result
8. If both pass → use case goes green, readiness score updates

Reset clears BOTH statuses because if code changed to fix a bug, both testers need to re-verify the new behavior.

---

## Design Palette (matches command center)

- Background: `#0A0A10` (dark)
- Surface: `#0F1315`
- Border: `#1A2B28`
- Accent: `#14B8A6` (teal)
- Pass: `#1D9E75` (green)
- Fail: `#ef4444` (red)
- Untested: `#888780` (gray)
- Muted text: `#9BAAA6`
- Font: Inter (primary), JetBrains Mono (counts, timestamps)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/views/QAView.tsx` | Create | The QA tab React component |
| `src/renderer/components/TabBar.tsx` | Modify | Add QA tab |
| `src/renderer/App.tsx` | Modify | Route to QAView |
| `src/renderer/store.ts` | Modify | Add QA-related state/selectors |
| `mcp-server/src/tools.ts` | Modify | Add 3 new MCP tools |
| `mcp-server/src/tracker.ts` | Modify | Add QA data operations |
| `src/main/parser.ts` | Modify | Seed initial QA data if missing |

## Out of Scope

- Automated "Run" button that sends prompts to the diagnostic endpoint from the command center UI (future — would require the command center to make HTTP requests to the Shopify app dev server)
- Test history / run log (v2 — for now, only the latest result per tester is stored)
- Performance benchmarking (response time tracking per use case)
