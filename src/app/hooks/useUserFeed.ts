import { useEffect, useState } from "react";
import {
  getUserFeed,
  getSubscriberFeed,
  getArticlesByTopicSlugs,
  getGeneralFeed,
  type Article,
} from "../utils/supabase";
import { findGroupByLabel, CHIP_KEY_SEPARATOR } from "../utils/topicGroups";
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
 *   - mode === "brief":
 *       - feed_token present → subscriber personalised feed
 *       - otherwise          → user feed by persisted user id
 *   - mode === "explore":
 *       - empty chip key     → general (unfiltered) feed
 *       - chip labels set    → articles across the union of the selected groups' slugs
 *
 * `selectedChipKey` is a CHIP_KEY_SEPARATOR-joined sorted string of selected
 * group labels (e.g. "Crypto\u001FMacro" or ""). Using a string dep avoids
 * stale-array reference issues in the effect. The separator is deliberately
 * an unprintable character so labels may safely contain commas/pipes/etc.
 */
export function useUserFeed(
  mode: "brief" | "explore",
  selectedChipKey: string,
  enabled: boolean,
): UseUserFeedResult {
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

        if (mode === "brief") {
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
        } else {
          const selectedGroupLabels = selectedChipKey
            ? selectedChipKey.split(CHIP_KEY_SEPARATOR)
            : [];
          if (selectedGroupLabels.length === 0) {
            fetched = await getGeneralFeed(40);
          } else {
            const allSlugs = selectedGroupLabels.flatMap((label) => {
              const group = findGroupByLabel(label);
              return group ? group.slugs : [];
            });
            fetched = allSlugs.length > 0
              ? await getArticlesByTopicSlugs(allSlugs, 40)
              : [];
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
  }, [mode, selectedChipKey, enabled]);

  return { articles, loading, firstLoadDone, error };
}
