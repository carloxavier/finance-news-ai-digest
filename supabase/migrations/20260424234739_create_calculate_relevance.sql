-- Pure-SQL relevance scoring function.
-- All fuzzy judgment (magnitude, story_type, entity extraction) is done
-- upstream by the LLM at seed time and passed in here as scalars. SQL
-- only does the arithmetic so the query planner can inline it.
--
-- See docs/design/digest-relevance-ranking.md for the formula rationale.

CREATE OR REPLACE FUNCTION calculate_relevance(
  p_magnitude smallint,
  p_cap_tier_weight float,
  p_age_hours float,
  p_half_life_hours float,
  p_topic_match float,
  p_ticker_match float
) RETURNS float
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- Personal dimension
    (p_topic_match + p_ticker_match)
    *
    -- Market dimension: cap-tier × normalized magnitude (0.2..1.0)
    (p_cap_tier_weight * (p_magnitude::float / 5.0))
    *
    -- Temporal dimension: exponential decay
    exp(-1.0 * p_age_hours / GREATEST(p_half_life_hours, 1.0));
$$;

COMMENT ON FUNCTION calculate_relevance IS
  'Pure arithmetic combining the three ranking dimensions. All fuzzy '
  'judgment (magnitude, story_type, entity extraction) is done upstream '
  'by the LLM at seed time and passed in as scalars. See '
  'docs/design/digest-relevance-ranking.md for the formula rationale.';
