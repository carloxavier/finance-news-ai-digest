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
    getGeneralFeed: vi.fn(),
  };
});

vi.mock("../../utils/userId", () => ({
  getUserId: vi.fn(),
  getFeedToken: vi.fn(),
  clearFeedToken: vi.fn(),
}));

vi.mock("../../utils/topicGroups", async () => {
  const actual = await vi.importActual<typeof import("../../utils/topicGroups")>(
    "../../utils/topicGroups",
  );
  return {
    ...actual,
    findGroupByLabel: vi.fn(),
  };
});

import {
  getUserFeed,
  getSubscriberFeed,
  getArticlesByTopicSlugs,
  getGeneralFeed,
} from "../../utils/supabase";
import { getUserId, getFeedToken, clearFeedToken } from "../../utils/userId";
import { findGroupByLabel, CHIP_KEY_SEPARATOR } from "../../utils/topicGroups";
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
    vi.mocked(getGeneralFeed).mockReset();
    vi.mocked(getUserId).mockReset().mockReturnValue("user-xyz");
    vi.mocked(getFeedToken).mockReset().mockReturnValue(null);
    vi.mocked(clearFeedToken).mockReset();
    vi.mocked(findGroupByLabel).mockReset();
  });

  it("does nothing when disabled", () => {
    renderHook(() => useUserFeed("brief", "", false));
    expect(getUserFeed).not.toHaveBeenCalled();
    expect(getSubscriberFeed).not.toHaveBeenCalled();
    expect(getArticlesByTopicSlugs).not.toHaveBeenCalled();
    expect(getGeneralFeed).not.toHaveBeenCalled();
  });

  it("fetches user feed by id when mode is brief and no token", async () => {
    const articles = [makeArticle("u1")];
    vi.mocked(getUserFeed).mockResolvedValue(articles);

    const { result } = renderHook(() => useUserFeed("brief", "", true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getUserFeed).toHaveBeenCalledWith("user-xyz");
    expect(result.current.articles).toEqual(articles);
    expect(result.current.firstLoadDone).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("fetches subscriber feed when a token is present in brief mode", async () => {
    vi.mocked(getFeedToken).mockReturnValue("tok-abc");
    const subscriberArticles = [makeArticle("s1")];
    vi.mocked(getSubscriberFeed).mockResolvedValue({
      subscriber: { email: "a@b.com" },
      topics: [],
      articles: subscriberArticles,
    } as unknown as SubscriberFeed);

    const { result } = renderHook(() => useUserFeed("brief", "", true));

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

    const { result } = renderHook(() => useUserFeed("brief", "", true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(clearFeedToken).toHaveBeenCalledTimes(1);
    expect(getUserFeed).toHaveBeenCalledWith("user-xyz");
    expect(result.current.articles).toEqual(fallback);
  });

  it("fetches general feed in explore mode when no chips are selected", async () => {
    const general = [makeArticle("g1")];
    vi.mocked(getGeneralFeed).mockResolvedValue(general);

    const { result } = renderHook(() => useUserFeed("explore", "", true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getGeneralFeed).toHaveBeenCalledWith(40);
    expect(getUserFeed).not.toHaveBeenCalled();
    expect(getSubscriberFeed).not.toHaveBeenCalled();
    expect(result.current.articles).toEqual(general);
  });

  it("combines slugs from multiple selected groups in explore mode", async () => {
    vi.mocked(findGroupByLabel).mockImplementation((label) => {
      if (label === "Macro") return { label: "Macro", slugs: ["macro", "fed"] };
      if (label === "Crypto") return { label: "Crypto", slugs: ["crypto"] };
      return null;
    });
    const byTopic = [makeArticle("t1")];
    vi.mocked(getArticlesByTopicSlugs).mockResolvedValue(byTopic);

    const chipKey = ["Crypto", "Macro"].join(CHIP_KEY_SEPARATOR);
    const { result } = renderHook(() => useUserFeed("explore", chipKey, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getArticlesByTopicSlugs).toHaveBeenCalledWith(["crypto", "macro", "fed"], 40);
    expect(getUserFeed).not.toHaveBeenCalled();
    expect(getGeneralFeed).not.toHaveBeenCalled();
    expect(result.current.articles).toEqual(byTopic);
  });

  it("treats a comma inside a label as part of the label (does not split)", async () => {
    // Regression: a label with a comma must not corrupt chip resolution.
    vi.mocked(findGroupByLabel).mockImplementation((label) => {
      if (label === "Commodities, Futures") {
        return { label: "Commodities, Futures", slugs: ["commodities"] };
      }
      return null;
    });
    vi.mocked(getArticlesByTopicSlugs).mockResolvedValue([makeArticle("c1")]);

    const { result } = renderHook(() =>
      useUserFeed("explore", "Commodities, Futures", true),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(findGroupByLabel).toHaveBeenCalledWith("Commodities, Futures");
    expect(getArticlesByTopicSlugs).toHaveBeenCalledWith(["commodities"], 40);
  });

  it("returns empty articles when selected groups resolve to no slugs", async () => {
    vi.mocked(findGroupByLabel).mockReturnValue(null);

    const { result } = renderHook(() => useUserFeed("explore", "Bogus", true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getArticlesByTopicSlugs).not.toHaveBeenCalled();
    expect(getGeneralFeed).not.toHaveBeenCalled();
    expect(result.current.articles).toEqual([]);
  });

  it("exposes an error message when the fetch throws", async () => {
    vi.mocked(getUserFeed).mockRejectedValue(new Error("network down"));
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useUserFeed("brief", "", true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network down");
    expect(result.current.firstLoadDone).toBe(true);
    consoleErr.mockRestore();
  });
});
