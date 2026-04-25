-- Supports the seeder's cross-run dedup query (Step 2.4 of the seeder skill,
-- v2.2) which reads `ORDER BY published_at DESC LIMIT 50` filtered to
-- complete articles. The existing `ai_articles_ranking_idx`
-- (story_magnitude DESC, published_at DESC) leads with story_magnitude, so it
-- doesn't cover a published_at-only ordering. At today's row count this is
-- a sequential scan either way; the index is cheap insurance for when the
-- table grows.

CREATE INDEX IF NOT EXISTS ai_articles_published_at_complete_idx
  ON ai_articles (published_at DESC)
  WHERE processing_status = 'complete';
