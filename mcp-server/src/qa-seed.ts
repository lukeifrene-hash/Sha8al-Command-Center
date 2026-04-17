import type { QAData } from './tracker.js'

export const QA_SEED: QAData = {
  groups: [
    {
      id: 'product_enrichment',
      name: 'Product Enrichment',
      use_cases: [
        { id: 'enrich_missing_attributes', name: 'Enrich products with missing attributes', task: 'processBatch', scope: 'write_products', built: true, test_prompt: 'Fix my top 25 products', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'add_material_color_dimensions', name: 'Add material/color/dimensions', task: 'processBatch', scope: 'write_products', built: true, test_prompt: 'Add material and color data to my snowboards', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'fix_alt_text', name: 'Fix alt text for SEO', task: 'processBatch', scope: 'write_products', built: true, test_prompt: 'Fix alt text on all my product images', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'vision_save_attributes', name: 'Vision analysis → save attributes', task: 'processBatch', scope: 'write_products', built: true, test_prompt: 'Look at my product photos and fill in the details', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'score_and_fix', name: 'Score catalog + fix gaps', task: 'processBatch', scope: 'write_products', built: true, test_prompt: 'Score my catalog health and fix the gaps', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'product_descriptions',
      name: 'Product Descriptions',
      use_cases: [
        { id: 'rewrite_factual', name: 'Rewrite to factual/structured', task: 'rewriteProductDescription', scope: 'write_products', built: true, test_prompt: "Rewrite my best seller's description to be factual", agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'rewrite_seo', name: 'Make SEO-friendly', task: 'rewriteProductDescription', scope: 'write_products', built: true, test_prompt: "Make The Complete Snowboard's description SEO-friendly", agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'rewrite_specs', name: 'Convert marketing to specs', task: 'rewriteProductDescription', scope: 'write_products', built: true, test_prompt: 'Convert my product descriptions from marketing fluff to specs', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'rewrite_product_title', name: 'Rewrite product titles for SEO + GEO', task: 'rewriteProductTitle', scope: 'write_products', built: true, test_prompt: 'Rewrite my top 10 product titles for SEO', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'product_creation',
      name: 'Product Creation',
      use_cases: [
        { id: 'create_product_from_scratch', name: 'Create product from scratch (DRAFT)', task: 'createProductFromScratch', scope: 'write_products', built: true, test_prompt: 'Create a new snowboard product called The Icebreaker', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'duplicate_and_remix_product', name: 'Duplicate & remix product', task: 'duplicateProductFromSource', scope: 'write_products', built: true, test_prompt: 'Make a black version of The Hidden Snowboard', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'add_variants_to_product', name: 'Add variants / options to product', task: 'addVariantsToProduct', scope: 'write_products', built: true, test_prompt: 'Add Small, Medium, Large sizes to The Hidden Snowboard', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'catalog_hygiene',
      name: 'Catalog Hygiene',
      use_cases: [
        { id: 'assign_shopify_category', name: 'Assign Shopify Category (taxonomy)', task: 'assignShopifyCategory', scope: 'write_products', built: true, test_prompt: 'Assign the correct Shopify categories to all my snowboards', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'normalize_type_and_vendor', name: 'Normalize product type + vendor', task: 'normalizeTypeAndVendor', scope: 'write_products', built: true, test_prompt: 'Clean up my vendor names', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'bulk_tag_management', name: 'Bulk tag management', task: 'setProductTagsBulk', scope: 'write_products', built: true, test_prompt: "Tag all my waterproof products with 'waterproof'", agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'reorder_product_images', name: 'Reorder product images (pick hero)', task: 'reorderProductImages', scope: 'write_products', built: true, test_prompt: 'Make the lifestyle shot the hero for each product', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'product_status',
      name: 'Product Status',
      use_cases: [
        { id: 'change_product_status', name: 'Publish / unpublish / archive products', task: 'changeProductStatusBulk', scope: 'write_products', built: true, test_prompt: 'Archive products with no sales in the last 90 days', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'collection_creation',
      name: 'Collection Creation',
      use_cases: [
        { id: 'create_seasonal', name: 'Create seasonal collection', task: 'createCollection', scope: 'write_products', built: true, test_prompt: 'Create a Summer Sale collection with seasonal products', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'create_clearance', name: 'Group clearance/dead-stock', task: 'createCollection', scope: 'write_products', built: true, test_prompt: "Create a clearance collection for products that haven't sold", agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'create_new_arrivals', name: 'Create New Arrivals', task: 'createCollection', scope: 'write_products', built: true, test_prompt: 'Create a New Arrivals collection from products added this month', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'collection_management',
      name: 'Collection Management',
      use_cases: [
        { id: 'add_to_collection', name: 'Add products to existing collection', task: 'addProductsToCollection', scope: 'write_products', built: true, test_prompt: 'Add my snowboards to the Winter Sports collection', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'update_existing_collection', name: 'Update existing collection (fields + image)', task: 'updateCollectionFields', scope: 'write_products', built: true, test_prompt: 'Rename the Summer Sale collection to Summer Clearance', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'remove_products_from_collection', name: 'Remove products from collection', task: 'removeProductsFromCollection', scope: 'write_products', built: true, test_prompt: 'Remove all non-snowboard products from the Snowboards collection', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'reorder_products_in_collection', name: 'Reorder products within collection', task: 'reorderProductsInCollection', scope: 'write_products', built: true, test_prompt: 'Put my best sellers at the top of the Featured collection', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'convert_to_smart_collection', name: 'Convert to smart collection (rules)', task: 'convertCollectionToSmart', scope: 'write_products', built: true, test_prompt: 'Make the Waterproof collection auto-update based on the tag', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'blog_articles',
      name: 'Blog & Articles',
      use_cases: [
        { id: 'blog_topic', name: 'Write topic-driven blog post', task: 'createBlogPost', scope: 'write_content', built: true, test_prompt: 'Write a blog post about snowboard maintenance', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'blog_gift_guide', name: 'Create catalog-aware gift guide', task: 'createBlogPost', scope: 'write_content', built: true, test_prompt: 'Create a holiday gift guide based on my best sellers', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'blog_how_to', name: 'Write educational how-to', task: 'createBlogPost', scope: 'write_content', built: true, test_prompt: 'Write a how-to article about choosing the right snowboard size', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'update_existing_article', name: 'Update existing blog article', task: 'updateBlogArticle', scope: 'write_content', built: true, test_prompt: 'Update my snowboard maintenance article to link my new wax products', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'collection_descriptions',
      name: 'Collection Descriptions',
      use_cases: [
        { id: 'collection_seo_desc', name: 'Write SEO descriptions for collections', task: 'writeCollectionDescriptions', scope: 'write_content', built: true, test_prompt: 'Write SEO descriptions for all my collections', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'seo_meta_tags',
      name: 'SEO Meta Tags',
      use_cases: [
        { id: 'meta_tags_generate', name: 'Generate meta titles + descriptions', task: 'generateMetaTags', scope: 'write_content', built: true, test_prompt: 'Generate SEO meta tags for my top 10 products', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'meta_tags_sweep', name: 'Bulk SEO sweep', task: 'generateMetaTags', scope: 'write_content', built: true, test_prompt: 'Do an SEO sweep across all my products', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'pages',
      name: 'Pages',
      use_cases: [
        { id: 'create_storefront_page', name: 'Create storefront page (About/Shipping/FAQ/etc)', task: 'createStorefrontPage', scope: 'write_content', built: true, test_prompt: 'Write me a Shipping & Returns page', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'update_existing_page', name: 'Update existing page', task: 'updateStorefrontPage', scope: 'write_content', built: true, test_prompt: 'Update my About page to mention we now ship internationally', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'structured_data',
      name: 'Structured Data',
      use_cases: [
        { id: 'metaobj_size_guide', name: 'Create size guides', task: 'createMetaobject', scope: 'app_owned', built: false, test_prompt: 'Create size guides for my apparel products', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'metaobj_materials', name: 'Build materials database', task: 'createMetaobject', scope: 'app_owned', built: false, test_prompt: 'Build a materials database with care instructions', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'metaobj_ingredients', name: 'Generate ingredient lists', task: 'createMetaobject', scope: 'app_owned', built: false, test_prompt: 'Generate ingredient lists for my skincare products', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'discount_codes',
      name: 'Discount Codes',
      use_cases: [
        { id: 'discount_targeted', name: 'Create targeted discount code', task: 'createDiscountCode', scope: 'write_discounts', built: false, test_prompt: 'Create a 20% off code for my slow-moving inventory', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'discount_shipping', name: 'Create free shipping code', task: 'createDiscountCode', scope: 'write_discounts', built: false, test_prompt: 'Create a free shipping code for orders over $50', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
        { id: 'discount_loyalty', name: 'Generate loyalty code', task: 'createDiscountCode', scope: 'write_discounts', built: false, test_prompt: 'Generate a loyalty discount code for returning customers', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
    {
      id: 'automatic_discounts',
      name: 'Automatic Discounts',
      use_cases: [
        { id: 'discount_automatic', name: 'Set up automatic discount', task: 'createAutomaticDiscount', scope: 'write_discounts', built: false, test_prompt: 'Set up a buy-one-get-one for my summer collection', agent_status: 'untested', agent_tested_at: null, agent_notes: null, operator_status: 'untested', operator_tested_at: null, operator_notes: null, review_fix_id: null },
      ],
    },
  ],
}
