-- Rewrite get_subscriber_feed to use three-dimension relevance ranking.
--
-- Contract preserved:
--   - Signature: (text, integer) → jsonb
--   - Output keys: subscriber, topics, articles
--   - Per-article fields unchanged, plus new optional `relevance_score`
--   - SECURITY DEFINER preserved
--   - {error: 'not_found'} shape preserved
--
-- The function now:
--   - Joins ticker_cap_tier to translate primary_entities → cap-tier weight
--   - Calls calculate_relevance per row (pure SQL)
--   - Orders by relevance DESC, LIMIT p_limit
--   - Falls back to a market×temporal-only ranking when the user has no
--     interests (personal degenerates to a constant; still better than recency)
--
-- send-digest's selection.ts continues to work unchanged: it receives
-- already-ranked articles and applies only dedup+truncate.
--
-- ───────────────────────────────────────────────────────────────────
-- Rollback: to revert to the recency-only ordering, drop this function
-- and re-create the previous definition (which lived only on the live
-- database, not in a prior migration). The previous body did the same
-- joins but ordered by published_at DESC instead of calling
-- calculate_relevance.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_subscriber_feed(
  p_token text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_sub record;
  v_result jsonb;
  v_has_interests boolean;
BEGIN
  SELECT id, user_id, email, frequency
  INTO v_sub
  FROM digest_subscribers
  WHERE feed_token = p_token AND is_active = true;

  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_interests WHERE user_id = v_sub.user_id
  ) INTO v_has_interests;

  SELECT jsonb_build_object(
    'subscriber', jsonb_build_object(
      'email', v_sub.email,
      'frequency', v_sub.frequency
    ),
    'topics', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'slug', t.slug,
        'display_name', t.display_name
      )), '[]'::jsonb)
      FROM user_interests ui
      JOIN topics t ON t.id = ui.topic_id
      WHERE ui.user_id = v_sub.user_id
    ),
    'articles', CASE
      WHEN v_has_interests THEN (
        -- Personalized feed, ranked by three-dimension relevance.
        SELECT COALESCE(jsonb_agg(article ORDER BY relevance DESC), '[]'::jsonb)
        FROM (
          SELECT
            ranked.relevance,
            jsonb_build_object(
              'id', ranked.id,
              'headline', ranked.headline,
              'ai_preview', ranked.ai_preview,
              'source_url', ranked.source_url,
              'publication', ranked.publication,
              'published_at', ranked.published_at,
              'consensus_signal', ranked.consensus_signal,
              'extracted_tickers', ranked.extracted_tickers,
              'inference_watch', ranked.inference_watch,
              'relevance_score', round(ranked.relevance::numeric, 4)
            ) AS article
          FROM (
            SELECT
              a.id, a.headline, a.ai_preview, a.source_url, a.publication,
              a.published_at, a.consensus_signal, a.extracted_tickers,
              a.inference_watch,
              calculate_relevance(
                a.story_magnitude,
                -- Market: max() across primary_entities. Missing ticker
                -- defaults to 0.2 (small-cap). Macro entities get 0.9.
                COALESCE((
                  SELECT MAX(
                    CASE
                      WHEN e LIKE 'macro:%' OR e LIKE 'regulatory:%' THEN 0.9
                      WHEN tc.tier = 'mega'  THEN 1.0
                      WHEN tc.tier = 'large' THEN 0.7
                      WHEN tc.tier = 'mid'   THEN 0.4
                      ELSE 0.2
                    END
                  )
                  FROM jsonb_array_elements_text(a.primary_entities) e
                  LEFT JOIN ticker_cap_tier tc
                    ON tc.ticker = REPLACE(e, 'TICKER:', '')
                   AND e LIKE 'TICKER:%'
                ), 0.2),
                -- Temporal: age in hours
                EXTRACT(EPOCH FROM (NOW() - a.published_at)) / 3600.0,
                -- Half-life by story type
                CASE a.story_type
                  WHEN 'thematic' THEN 72.0
                  ELSE 18.0
                END,
                -- Personal: topic match 1.0 if user is interested, else 0.1 soft floor
                CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM user_interests ui
                    JOIN article_topics at2 ON at2.topic_id = ui.topic_id
                    WHERE ui.user_id = v_sub.user_id
                      AND at2.article_id = a.id
                  ) THEN 1.0
                  ELSE 0.1
                END,
                -- Personal: ticker match 0.5 if any followed ticker appears
                CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM subscriber_tickers st
                    WHERE st.subscriber_id = v_sub.id
                      AND ('TICKER:' || st.ticker) IN (
                        SELECT jsonb_array_elements_text(a.primary_entities)
                      )
                  ) THEN 0.5
                  ELSE 0.0
                END
              ) AS relevance
            FROM ai_articles a
            WHERE a.processing_status = 'complete'
              AND a.published_at > NOW() - INTERVAL '30 days'
              AND (
                -- Keep broad: all articles matching either a subscribed topic
                -- OR a followed ticker. The soft-floor on topic_match in
                -- calculate_relevance lets huge cross-topic stories through.
                EXISTS (
                  SELECT 1
                  FROM user_interests ui
                  JOIN article_topics at2 ON at2.topic_id = ui.topic_id
                  WHERE ui.user_id = v_sub.user_id
                    AND at2.article_id = a.id
                )
                OR EXISTS (
                  SELECT 1
                  FROM subscriber_tickers st
                  WHERE st.subscriber_id = v_sub.id
                    AND ('TICKER:' || st.ticker) IN (
                      SELECT jsonb_array_elements_text(a.primary_entities)
                    )
                )
              )
          ) ranked
          ORDER BY ranked.relevance DESC
          LIMIT p_limit
        ) sub
      )
      ELSE (
        -- Default feed (no interests): ranked by market × temporal only
        -- (personal degenerates to a constant). Still better than recency.
        SELECT COALESCE(jsonb_agg(article ORDER BY relevance DESC), '[]'::jsonb)
        FROM (
          SELECT
            ranked.relevance,
            jsonb_build_object(
              'id', ranked.id,
              'headline', ranked.headline,
              'ai_preview', ranked.ai_preview,
              'source_url', ranked.source_url,
              'publication', ranked.publication,
              'published_at', ranked.published_at,
              'consensus_signal', ranked.consensus_signal,
              'extracted_tickers', ranked.extracted_tickers,
              'inference_watch', ranked.inference_watch,
              'relevance_score', round(ranked.relevance::numeric, 4)
            ) AS article
          FROM (
            SELECT
              a.id, a.headline, a.ai_preview, a.source_url, a.publication,
              a.published_at, a.consensus_signal, a.extracted_tickers,
              a.inference_watch,
              calculate_relevance(
                a.story_magnitude,
                COALESCE((
                  SELECT MAX(
                    CASE
                      WHEN e LIKE 'macro:%' OR e LIKE 'regulatory:%' THEN 0.9
                      WHEN tc.tier = 'mega'  THEN 1.0
                      WHEN tc.tier = 'large' THEN 0.7
                      WHEN tc.tier = 'mid'   THEN 0.4
                      ELSE 0.2
                    END
                  )
                  FROM jsonb_array_elements_text(a.primary_entities) e
                  LEFT JOIN ticker_cap_tier tc
                    ON tc.ticker = REPLACE(e, 'TICKER:', '')
                   AND e LIKE 'TICKER:%'
                ), 0.2),
                EXTRACT(EPOCH FROM (NOW() - a.published_at)) / 3600.0,
                CASE a.story_type WHEN 'thematic' THEN 72.0 ELSE 18.0 END,
                1.0,  -- no interests → treat as universal topic match
                0.0   -- no ticker follows
              ) AS relevance
            FROM ai_articles a
            WHERE a.processing_status = 'complete'
              AND a.published_at > NOW() - INTERVAL '30 days'
          ) ranked
          ORDER BY ranked.relevance DESC
          LIMIT p_limit
        ) sub
      )
    END
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
