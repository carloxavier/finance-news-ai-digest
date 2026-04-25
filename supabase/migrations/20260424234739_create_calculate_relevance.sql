-- Pure-SQL relevance scoring function.
-- All fuzzy judgment (magnitude, story_type, entity extraction) is done
-- upstream by the LLM at seed time and passed in here as scalars. SQL
-- only does the arithmetic so the query planner can inline it.
--
-- See docs/design/digest-relevance-ranking.md for the formula rationale.
--
-- Type note: parameters use `integer` and `numeric` (not `smallint` and
-- `float`) so that callers can pass unadorned literals like `5` and `1.0`
-- without explicit casts. PostgreSQL's function dispatch refuses to
-- implicitly narrow integer→smallint or widen numeric→float, which would
-- break both psql sessions and the SQL test file. The underlying column
-- types in ai_articles are smallint (story_magnitude) and computed values
-- are numeric; both auto-widen at the call site. The RPC
-- (get_subscriber_feed) relies on this. Do not "optimize" back to
-- smallint/float without also adding explicit casts at every call site.

CREATE OR REPLACE FUNCTION calculate_relevance(
  p_magnitude integer,
  p_cap_tier_weight numeric,
  p_age_hours numeric,
  p_half_life_hours numeric,
  p_topic_match numeric,
  p_ticker_match numeric
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- Personal dimension
    (p_topic_match + p_ticker_match)
    *
    -- Market dimension: cap-tier × normalized magnitude (0.2..1.0)
    (p_cap_tier_weight * (p_magnitude::numeric / 5.0))
    *
    -- Temporal dimension: exponential decay
    exp(-1.0 * p_age_hours / GREATEST(p_half_life_hours, 1.0));
$$;

COMMENT ON FUNCTION calculate_relevance IS
  'Pure arithmetic combining the three ranking dimensions. All fuzzy '
  'judgment (magnitude, story_type, entity extraction) is done upstream '
  'by the LLM at seed time and passed in as scalars. See '
  'docs/design/digest-relevance-ranking.md for the formula rationale.';
