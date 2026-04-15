import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Article, SubscriberFeed } from "../../utils/supabase";

vi.mock("../../utils/supabase", async () => {
  const actual = await vi.importActual<typeof import("../../utils/supabase")>(
    "../../utils/supabase",
  );
  return {
    ...actual,
    getUserFeed: vi.fn(),
    getSubscriberFeed: vi.fn(),
    getArticlesByTopicSlugs: vi.fn(),
  };
});

vi.mock("../../utils/userId", () => ({
  getUserId: vi.fn(),
  getFeedToken: vi.fn(),
  clearFeedToken: vi.fn(),
}));

vi.mock("../../utils/topicGroups", () => ({
  findGroupByLabel: vi.fn(),
}));

import {
  getUserFeed,
  getSubscriberFeed,
  getArticlesByTopicSlugs,
} from "../../utils/supabase";
import { getUserId, getFeedToken, clearFeedToken } from "../../utils/userId";
import { findGroupByLabel } from "../../utils/topicGroups";
import { useUserFeed } from "../useUserFeed";

function makeArticle(id: string): Article {
  return {
    id,
    headline: `Headline ${id}`,
    publication: "Reuters",
    published_at: "2026-04-10T00:00:00Z",
    ai_preview: "preview",
    consensus_signal: "BUY",
    extracted_tickers: [],
  } as unknown as Article;
}

describe("useUserFeed", () => {
  beforeEach(() => {
    vi.mocked(getUserFeed).mockReset();
    vi.mocked(getSubscriberFeed).mockReset();
    vi.mocked(getArticlesByTopicSlugs).mockReset();
    vi.mocked(getUserId).mockReset().mockReturnValue("user-xyz");
    vi.mocked(getFeedToken).mockReset().mockReturnValue(null);
    vi.mocked(clearFeedToken).mockReset();
    vi.mocked(findGroupByLabel).mockReset();
  });

  it("does nothing when disabled", () => {
    renderHook(() => useUserFeed(null, false));
    expect(getUserFeed).not.toHaveBeenCalled();
    expect(getSubscriberFeed).not.toHaveBeenCalled();
    expect(getArticlesByTopicSlugs).not.toHaveBeenCalled();
  });

  it("fetches user feed by id when no token and no active group", async () => {
    const articles = [makeArticle("u1")];
    vi.mocked(getUserFeed).mockResolvedValue(articles);

    const { result } = renderHook(() => useUserFeed(null, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getUserFeed).toHaveBeenCalledWith("user-xyz");
    expect(result.current.articles).toEqual(articles);
    expect(result.current.firstLoadDone).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("fetches subscriber feed when a token is present", async () => {
    vi.mocked(getFeedToken).mockReturnValue("tok-abc");
    const subscriberArticles = [makeArticle("s1")];
    vi.mocked(getSubscriberFeed).mockResolvedValue({
      subscriber: { email: "a@b.com" },
      topics: [],
      articles: subscriberArticles,
    } as unknown as SubscriberFeed);

    const { result } = renderHook(() => useUserFeed(null, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getSubscriberFeed).toHaveBeenCalledWith("tok-abc");
    expect(getUserFeed).not.toHaveBeenCalled();
    expect(result.current.articles).toEqual(subscriberArticles);
  });

  it("clears the feed token and falls back to user feed when token resolves to null", async () => {
    vi.mocked(getFeedToken).mockReturnValue("tok-bad");
    vi.mocked(getSubscriberFeed).mockResolvedValue(null);
    const fallback = [makeArticle("f1")];
    vi.mocked(getUserFeed).mockResolvedValue(fallback);

    const { result } = renderHook(() => useUserFeed(null, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(clearFeedToken).toHaveBeenCalledTimes(1);
    expect(getUserFeed).toHaveBeenCalledWith("user-xyz");
    expect(result.current.articles).toEqual(fallback);
  });

  it("fetches by topic slugs when an active group resolves to one", async () => {
    vi.mocked(findGroupByLabel).mockReturnValue({
      label: "Macro",
      slugs: ["macro", "fed"],
    } as ReturnType<typeof findGroupByLabel>);
    const byTopic = [makeArticle("t1")];
    vi.mocked(getArticlesByTopicSlugs).mockResolvedValue(byTopic);

    const { result } = renderHook(() => useUserFeed("Macro", true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getArticlesByTopicSlugs).toHaveBeenCalledWith(["macro", "fed"]);
    expect(getUserFeed).not.toHaveBeenCalled();
    expect(getSubscriberFeed).not.toHaveBeenCalled();
    expect(result.current.articles).toEqual(byTopic);
  });

  it("returns empty articles when the active group is unknown", async () => {
    vi.mocked(findGroupByLabel).mockReturnValue(undefined);

    const { result } = renderHook(() => useUserFeed("Bogus", true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getArticlesByTopicSlugs).not.toHaveBeenCalled();
    expect(result.current.articles).toEqual([]);
  });

  it("exposes an error message when the fetch throws", async () => {
    vi.mocked(getUserFeed).mockRejectedValue(new Error("network down"));
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useUserFeed(null, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network down");
    expect(result.current.firstLoadDone).toBe(true);
    consoleErr.mockRestore();
  });
});
