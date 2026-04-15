import { useEffect, useState } from "react";
import {
  getUserFeed,
  getSubscriberFeed,
  getArticlesByTopicSlugs,
  type Article,
} from "../utils/supabase";
import { findGroupByLabel } from "../utils/topicGroups";
import { getUserId, getFeedToken, clearFeedToken } from "../utils/userId";

interface UseUserFeedResult {
  articles: Article[];
  loading: boolean;
  firstLoadDone: boolean;
  error: string | null;
}

/**
 * Resolve and fetch the authenticated user's feed.
 *
 * Branches on:
 *   1. An active topic group  → fetch articles by that group's slugs.
 *   2. An email-link feed_token → fetch the subscriber's personalised feed.
 *   3. Otherwise                → fetch by persisted user id.
 *
 * Tracks `firstLoadDone` separately from `loading` so callers can show a
 * one-time full-screen spinner on mount and an inline loader for later
 * tab changes (keeping navigation visible).
 */
export function useUserFeed(activeGroup: string | null, enabled: boolean): UseUserFeedResult {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        let fetched: Article[];
        if (activeGroup !== null) {
          const group = findGroupByLabel(activeGroup);
          fetched = group ? await getArticlesByTopicSlugs(group.slugs) : [];
        } else {
          const feedToken = getFeedToken();
          if (feedToken) {
            const feed = await getSubscriberFeed(feedToken);
            if (feed) {
              fetched = feed.articles;
            } else {
              clearFeedToken();
              fetched = await getUserFeed(getUserId());
            }
          } else {
            fetched = await getUserFeed(getUserId());
          }
        }
        if (cancelled) return;
        setArticles(fetched);
      } catch (err) {
        if (cancelled) return;
        console.error("[useUserFeed] failed to load:", err);
        setError(err instanceof Error ? err.message : "Failed to load feed");
      } finally {
        if (cancelled) return;
        setLoading(false);
        setFirstLoadDone(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeGroup, enabled]);

  return { articles, loading, firstLoadDone, error };
}
