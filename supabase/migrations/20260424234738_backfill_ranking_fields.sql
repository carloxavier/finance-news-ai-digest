-- Heuristic one-shot backfill for existing v2.1.x ai_articles rows.
-- These were seeded before LLM magnitude tagging existed (seeder v2.1.3+).
-- Running the LLM-based seeder against each is overkill for prototype stage;
-- the seeder will re-tag properly when these rows are re-seeded.
-- This is just enough to make the ranker behave reasonably in the meantime.
--
-- Rule order matters — we take the first matching rule per row.

-- ───────────────────────────────────────────────────────────────────
-- Rule 1: mega-cap ticker with any significant event signal → magnitude 4
-- The signal set is intentionally broad — earnings, M&A, leadership changes,
-- large investments, major layoffs, and dollar amounts all count.
-- This heuristic was simulated against 86 existing articles before landing;
-- see the PR description for distribution data.
-- ───────────────────────────────────────────────────────────────────

UPDATE ai_articles a
SET story_magnitude = 4
WHERE processing_status = 'complete'
  AND story_magnitude = 2 -- hasn't been backfilled yet
  AND EXISTS (
    SELECT 1 FROM unnest(a.extracted_tickers) t
    WHERE t IN (SELECT ticker FROM ticker_cap_tier WHERE tier = 'mega')
  )
  AND (
       -- Earnings signals
       a.headline ILIKE '%earnings%'
    OR a.headline ILIKE '% Q1 %' OR a.headline ILIKE '% Q2 %'
    OR a.headline ILIKE '% Q3 %' OR a.headline ILIKE '% Q4 %'
    OR a.headline ILIKE '%beats%' OR a.headline ILIKE '%misses%'
       -- M&A
    OR a.headline ILIKE '%acquire%' OR a.headline ILIKE '%acquisition%'
    OR a.headline ILIKE '%buys%'    OR a.headline ILIKE '%merger%'
       -- Leadership transitions at mega-caps are high-magnitude
    OR a.headline ILIKE '%CEO%'
    OR a.headline ILIKE '%steps down%' OR a.headline ILIKE '%succession%'
       -- Large investments / partnerships (any $ amount)
    OR (a.headline ILIKE '%invest%' AND a.headline ~ '\$[0-9]+')
       -- Major workforce changes
    OR a.headline ILIKE '%layoff%' OR a.headline ILIKE '%jobs cut%'
    OR a.headline ~* 'cut [0-9,]+ jobs'
       -- Hard dollar amounts in billions (including spelled-out)
    OR a.headline ~ '\$[0-9]+(\.[0-9]+)?[BM]'
    OR a.headline ~* '\$[0-9]+(\.[0-9]+)? (billion|million)'
  );

-- ───────────────────────────────────────────────────────────────────
-- Rule 2: any ticker + explicit % move or $B/$M amount → magnitude 3
-- ───────────────────────────────────────────────────────────────────

UPDATE ai_articles a
SET story_magnitude = 3
WHERE processing_status = 'complete'
  AND story_magnitude = 2
  AND array_length(a.extracted_tickers, 1) > 0
  AND (
       a.headline ~ '[0-9]+%'
    OR a.headline ~ '\$[0-9]+(\.[0-9]+)?[BM]'
    OR a.headline ~* '\$[0-9]+(\.[0-9]+)? (billion|million)'
  );

-- ───────────────────────────────────────────────────────────────────
-- Rule 3: macro/regulatory (no tickers) with a hard number → magnitude 3
-- ───────────────────────────────────────────────────────────────────

UPDATE ai_articles a
SET story_magnitude = 3
WHERE processing_status = 'complete'
  AND story_magnitude = 2
  AND (a.extracted_tickers IS NULL OR array_length(a.extracted_tickers, 1) = 0)
  AND a.headline ~ '[0-9]+';

-- ───────────────────────────────────────────────────────────────────
-- Rule 4: derive story_type — default is 'breaking', flip to 'thematic' only
-- on signals that clearly indicate analysis/commentary rather than event.
--
-- NOTE: earlier draft included '%outlook%' and '%could%' here but a
-- simulation against existing articles showed both over-matching.
-- "Full-year outlook" shows up in routine earnings headlines; "could"
-- appears in too many breaking-news contexts. Stick to unambiguous
-- analysis markers.
-- ───────────────────────────────────────────────────────────────────

UPDATE ai_articles
SET story_type = 'thematic'
WHERE processing_status = 'complete'
  AND (
       headline ILIKE '%analysis%'
    OR headline ILIKE '%what to%'
    OR headline ILIKE '%here''s why%'
    OR headline ILIKE '%explainer%'
    OR headline ILIKE '%preview%'
    OR headline ILIKE '% deep dive%'
  );

-- ───────────────────────────────────────────────────────────────────
-- Rule 5: derive primary_entities from extracted_tickers.
-- The new tagging format is "TICKER:SYM" for tickers; macro/regulatory
-- tags will be added by the v2.1.3 seeder going forward.
-- ───────────────────────────────────────────────────────────────────

UPDATE ai_articles a
SET primary_entities = COALESCE(
  (
    SELECT jsonb_agg('TICKER:' || t)
    FROM unnest(a.extracted_tickers) t
  ),
  '[]'::jsonb
)
WHERE processing_status = 'complete'
  AND primary_entities = '[]'::jsonb
  AND a.extracted_tickers IS NOT NULL
  AND array_length(a.extracted_tickers, 1) > 0;

-- story_cluster_id backfill: leave NULL. Not consumed by v1.
