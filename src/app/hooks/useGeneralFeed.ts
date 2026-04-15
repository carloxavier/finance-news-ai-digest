import { useEffect, useState } from "react";
import { getGeneralFeed, type Article } from "../utils/supabase";

interface UseGeneralFeedResult {
  articles: Article[];
  loading: boolean;
}

/**
 * Fetch the public, unauthenticated general feed on mount.
 *
 * Keeps the data-fetching concern out of the rendering component so the
 * component can stay focused on presentation. Handles cancellation on
 * unmount so a stale fetch can't update state after the component has
 * gone away.
 */
export function useGeneralFeed(limit: number = 20): UseGeneralFeedResult {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGeneralFeed(limit)
      .then((fetched) => {
        if (cancelled) return;
        setArticles(fetched);
      })
      .catch((err) => {
        console.error("[useGeneralFeed] failed to load feed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { articles, loading };
}
