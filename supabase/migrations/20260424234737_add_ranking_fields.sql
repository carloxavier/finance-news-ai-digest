-- Digest relevance ranking v1 — schema additions.
--
-- Adds ranking-related columns to ai_articles plus two reference tables
-- (ticker_cap_tier, subscriber_tickers). The new RPC get_subscriber_feed
-- (added in a later migration) reads these to compute a three-dimension
-- relevance score (personal × market × temporal).
--
-- All ai_articles columns are nullable/defaulted so existing rows remain
-- valid. subscriber_tickers ships empty in v1; the onboarding/dashboard
-- UX that populates it is a follow-up PR.
--
-- See docs/design/digest-relevance-ranking.md for the formula rationale.

-- ───────────────────────────────────────────────────────────────────
-- Ranking-related columns on ai_articles.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE ai_articles
  ADD COLUMN IF NOT EXISTS primary_entities jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS story_magnitude smallint DEFAULT 2
    CHECK (story_magnitude BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS story_type text DEFAULT 'breaking'
    CHECK (story_type IN ('breaking', 'thematic')),
  ADD COLUMN IF NOT EXISTS story_cluster_id text;

COMMENT ON COLUMN ai_articles.primary_entities IS
  'JSONB array of entity identifiers relevant to this bundle. '
  'Tickers appear as "TICKER:AAPL"; macro/regulatory topics appear as '
  '"macro:fed_policy", "regulatory:sec_enforcement", etc. Used by '
  'get_subscriber_feed to compute market-dimension score and '
  'ticker-match boost. Populated by seeder skill v2.1.3+.';

COMMENT ON COLUMN ai_articles.story_magnitude IS
  'LLM-assigned significance, 1-5 scale. See seeder skill '
  'v2.1.3 for calibration rules. 5 = truly market-moving (Fed cut, '
  'mega-cap earnings surprise). 2 = modest single-ticker event. '
  '1 = commentary/opinion that somehow got seeded.';

COMMENT ON COLUMN ai_articles.story_type IS
  'Controls temporal decay half-life in the ranker. '
  '"breaking" = 18h half-life (earnings, M&A, rate decisions). '
  '"thematic" = 72h half-life (analysis, trends, outlook pieces).';

COMMENT ON COLUMN ai_articles.story_cluster_id IS
  'Stable identifier grouping bundles that cover the same underlying '
  'story. Not consumed by the v1 ranker; reserved for future '
  'cross-bundle dedup in send-digest. Populated by seeder v2.1.3+.';

-- Index for the new ORDER BY pattern.
CREATE INDEX IF NOT EXISTS ai_articles_ranking_idx
  ON ai_articles (story_magnitude DESC, published_at DESC)
  WHERE processing_status = 'complete';

-- ───────────────────────────────────────────────────────────────────
-- Ticker cap tier lookup. Small, static, hand-curated.
-- Missing tickers are treated as small-cap by the RPC.
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticker_cap_tier (
  ticker text PRIMARY KEY,
  tier text NOT NULL CHECK (tier IN ('mega', 'large', 'mid', 'small'))
);

COMMENT ON TABLE ticker_cap_tier IS
  'Static lookup of ticker → market-cap tier, used by '
  'get_subscriber_feed. Tickers not present default to "small" in '
  'the RPC. Maintained by hand; rebalance ~quarterly.';

-- Seed data: ~50 mega-caps and ~50 large-caps covering the bulk of
-- what Finnopolis currently seeds. Additions welcome over time.

INSERT INTO ticker_cap_tier (ticker, tier) VALUES
  -- Mega-cap tech
  ('AAPL', 'mega'), ('MSFT', 'mega'), ('GOOGL', 'mega'), ('GOOG', 'mega'),
  ('AMZN', 'mega'), ('META', 'mega'), ('NVDA', 'mega'), ('TSLA', 'mega'),
  ('AVGO', 'mega'), ('ORCL', 'mega'), ('CRM', 'mega'), ('ADBE', 'mega'),
  ('NFLX', 'mega'), ('AMD', 'mega'), ('TSM', 'mega'), ('ASML', 'mega'),
  -- Mega-cap financials / consumer / healthcare / industrial
  ('BRK.B', 'mega'), ('JPM', 'mega'), ('V', 'mega'), ('MA', 'mega'),
  ('BAC', 'mega'), ('WFC', 'mega'), ('UNH', 'mega'), ('LLY', 'mega'),
  ('JNJ', 'mega'), ('XOM', 'mega'), ('CVX', 'mega'), ('WMT', 'mega'),
  ('PG', 'mega'), ('HD', 'mega'), ('COST', 'mega'), ('DIS', 'mega'),
  ('KO', 'mega'), ('PEP', 'mega'), ('MCD', 'mega'), ('NKE', 'mega'),
  ('ABBV', 'mega'), ('MRK', 'mega'), ('PFE', 'mega'), ('TMO', 'mega'),
  ('ABT', 'mega'), ('DHR', 'mega'), ('HON', 'mega'), ('CAT', 'mega'),
  ('GE', 'mega'), ('LMT', 'mega'), ('BA', 'mega'), ('INTC', 'mega'),
  ('IBM', 'mega'), ('QCOM', 'mega'), ('CSCO', 'mega'), ('TXN', 'mega'),
  -- Large-cap (sampling — expand over time)
  ('MRVL', 'large'), ('MU', 'large'), ('LRCX', 'large'), ('KLAC', 'large'),
  ('AMAT', 'large'), ('STM', 'large'), ('ARM', 'large'),
  ('NOW', 'large'), ('SNOW', 'large'), ('PLTR', 'large'), ('DDOG', 'large'),
  ('SHOP', 'large'), ('UBER', 'large'), ('ABNB', 'large'), ('SPOT', 'large'),
  ('PYPL', 'large'), ('SQ', 'large'), ('COIN', 'large'), ('HOOD', 'large'),
  ('GS', 'large'), ('MS', 'large'), ('C', 'large'), ('AXP', 'large'),
  ('AAL', 'large'), ('DAL', 'large'), ('UAL', 'large'), ('LUV', 'large'),
  ('F', 'large'), ('GM', 'large'), ('RIVN', 'large'), ('LCID', 'large'),
  ('URI', 'large'), ('GEV', 'large'), ('DOW', 'large'), ('BSX', 'large'),
  ('OKLO', 'large'), ('XE', 'large')
ON CONFLICT (ticker) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────
-- Subscriber-followed tickers. Empty in v1; populated by follow-up PR
-- that adds onboarding + dashboard UX. The ranker handles empty
-- gracefully: ticker_match = 0 for every subscriber.
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriber_tickers (
  subscriber_id uuid NOT NULL REFERENCES digest_subscribers(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscriber_id, ticker)
);

CREATE INDEX IF NOT EXISTS subscriber_tickers_ticker_idx
  ON subscriber_tickers (ticker);

COMMENT ON TABLE subscriber_tickers IS
  'Tickers a subscriber has chosen to follow. Consumed by '
  'get_subscriber_feed to boost ticker-match in the personal '
  'dimension. Empty in v1; populated by the ticker-following UX PR.';

-- ───────────────────────────────────────────────────────────────────
-- RLS: subscribers can read their own rows, service role manages all.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE subscriber_tickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscribers_can_read_own_tickers"
  ON subscriber_tickers FOR SELECT
  USING (subscriber_id IN (
    SELECT id FROM digest_subscribers WHERE user_id = auth.uid()
  ));

CREATE POLICY "service_role_manages_subscriber_tickers"
  ON subscriber_tickers FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ticker_cap_tier is world-readable (it's static reference data).
-- No RLS needed. If you enable RLS on it later, grant SELECT to anon.
