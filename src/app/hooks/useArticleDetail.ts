import { useEffect, useState } from "react";
import { getArticleDetail, type ArticleDetail } from "../utils/supabase";

interface UseArticleDetailResult {
  article: ArticleDetail | null;
  loading: boolean;
}

/**
 * Fetch a single article's detail payload by id.
 *
 * Centralises the loading state and cancellation semantics so the
 * component that renders the article can stay focused on presentation.
 * Passing `undefined` (e.g. before the route param resolves) leaves the
 * hook in a loading state and skips the fetch.
 */
export function useArticleDetail(id: string | undefined): UseArticleDetailResult {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getArticleDetail(id)
      .then((fetched) => {
        if (cancelled) return;
        setArticle(fetched);
      })
      .catch((err) => {
        console.error("[useArticleDetail] failed to load:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { article, loading };
}
