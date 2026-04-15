import { useEffect, useState } from "react";
import { getPublicPreview, type Article } from "../utils/supabase";

interface UsePublicPreviewResult {
  articles: Article[];
  loading: boolean;
}

/**
 * Fetch a slice of the public preview feed, keyed by `cacheKey`.
 *
 * The hook memoises results per cache key for the component's lifetime so
 * toggling between tabs (the primary caller) doesn't re-hit the network for
 * a tab that's already been loaded. Handles cancellation on unmount and on
 * key changes so a stale fetch can't clobber a newer one.
 */
export function usePublicPreview(
  cacheKey: string,
  slug: string | null,
  limit: number = 5,
): UsePublicPreviewResult {
  const [cache, setCache] = useState<Record<string, Article[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(cacheKey);

  useEffect(() => {
    if (cache[cacheKey] !== undefined) {
      setLoadingKey(null);
      return;
    }
    let cancelled = false;
    setLoadingKey(cacheKey);
    getPublicPreview(slug)
      .then((articles) => {
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [cacheKey]: articles.slice(0, limit) }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[usePublicPreview] failed to load:", err);
        setCache((prev) => ({ ...prev, [cacheKey]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingKey(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, slug, limit, cache]);

  return {
    articles: cache[cacheKey] ?? [],
    loading: loadingKey === cacheKey,
  };
}
