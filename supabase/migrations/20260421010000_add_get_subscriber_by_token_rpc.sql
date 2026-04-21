-- Lean subscriber-by-token lookup.
--
-- Feed.tsx and ArticleDetail.tsx used to call get_subscriber_feed purely to
-- extract subscriber.email (and, for Feed, topic display names). That RPC
-- runs the full feed-ranking pipeline (join user_interests → article_topics
-- → ai_articles, filter by published_at, sort, limit, serialize articles)
-- — expensive work for a caller that only needs identity + topics.
--
-- This function is the lean alternative: a single indexed lookup on
-- digest_subscribers.feed_token plus a join to user_interests → topics.
-- Returns subscriber identity + topic display names only. No articles.
--
-- Security posture is equivalent to get_subscriber_feed: SECURITY DEFINER,
-- executable by anon, keyed on a feed_token that is already treated as a
-- session credential. If a feed_token leaks, the attacker can already call
-- get_subscriber_feed (which surfaces the same email), so this RPC does
-- not widen exposure.
--
-- See docs/backlog/done/P4-lean-subscriber-by-token-rpc.md.

CREATE OR REPLACE FUNCTION public.get_subscriber_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'email', ds.email,
    'frequency', ds.frequency,
    'timezone', ds.timezone,
    'topics', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('slug', t.slug, 'display_name', t.display_name) ORDER BY t.display_name)
        FROM public.user_interests ui
        JOIN public.topics t ON t.id = ui.topic_id
        WHERE ui.user_id = ds.user_id AND t.is_active = true
      ),
      '[]'::jsonb
    )
  )
  FROM public.digest_subscribers ds
  WHERE ds.feed_token = p_token
    AND ds.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscriber_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_subscriber_by_token(text) IS
  'Lightweight subscriber lookup by feed_token. Returns email, frequency, timezone, and active topic display-names as JSONB. Used by Feed.tsx and ArticleDetail.tsx where the subscriber identity is needed but the article feed is not.';
