import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Article } from "../../utils/supabase";

vi.mock("../../utils/supabase", async () => {
  const actual = await vi.importActual<typeof import("../../utils/supabase")>(
    "../../utils/supabase",
  );
  return {
    ...actual,
    getPublicPreview: vi.fn(),
  };
});

import { getPublicPreview } from "../../utils/supabase";
import { usePublicPreview } from "../usePublicPreview";

function makeArticle(id: string): Article {
  return {
    id,
    headline: `Headline ${id}`,
    publication: "Reuters",
    published_at: "2026-04-10T00:00:00Z",
    ai_preview: `preview ${id}`,
    consensus_signal: "MIXED",
    extracted_tickers: [],
  } as unknown as Article;
}

describe("usePublicPreview", () => {
  beforeEach(() => {
    vi.mocked(getPublicPreview).mockReset();
  });

  it("fetches the preview on first mount and exposes articles", async () => {
    const batch = [makeArticle("1"), makeArticle("2")];
    vi.mocked(getPublicPreview).mockResolvedValue(batch);

    const { result } = renderHook(() => usePublicPreview("All", null, 5));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toEqual(batch);
    expect(getPublicPreview).toHaveBeenCalledWith(null);
  });

  it("slices results to the requested limit", async () => {
    vi.mocked(getPublicPreview).mockResolvedValue([
      makeArticle("1"),
      makeArticle("2"),
      makeArticle("3"),
      makeArticle("4"),
      makeArticle("5"),
      makeArticle("6"),
    ]);

    const { result } = renderHook(() =>
      usePublicPreview("macro", "macro", 3),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toHaveLength(3);
    expect(result.current.articles.map((a) => a.id)).toEqual(["1", "2", "3"]);
  });

  it("re-fetches when cacheKey changes to an unseen key", async () => {
    const firstBatch = [makeArticle("A1")];
    const secondBatch = [makeArticle("B1")];
    vi.mocked(getPublicPreview)
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch);

    const { result, rerender } = renderHook(
      ({ key, slug }: { key: string; slug: string | null }) =>
        usePublicPreview(key, slug, 5),
      { initialProps: { key: "All", slug: null as string | null } },
    );

    await waitFor(() => expect(result.current.articles).toEqual(firstBatch));

    rerender({ key: "Technology", slug: "technology" });

    await waitFor(() => expect(result.current.articles).toEqual(secondBatch));
    expect(getPublicPreview).toHaveBeenCalledTimes(2);
    expect(getPublicPreview).toHaveBeenNthCalledWith(1, null);
    expect(getPublicPreview).toHaveBeenNthCalledWith(2, "technology");
  });

  it("serves from cache without re-fetching when returning to a seen key", async () => {
    const firstBatch = [makeArticle("A1")];
    const secondBatch = [makeArticle("B1")];
    vi.mocked(getPublicPreview)
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch);

    const { result, rerender } = renderHook(
      ({ key, slug }: { key: string; slug: string | null }) =>
        usePublicPreview(key, slug, 5),
      { initialProps: { key: "All", slug: null as string | null } },
    );

    await waitFor(() => expect(result.current.articles).toEqual(firstBatch));

    rerender({ key: "Technology", slug: "technology" });
    await waitFor(() => expect(result.current.articles).toEqual(secondBatch));

    // Back to "All" — should hit cache
    rerender({ key: "All", slug: null });
    await waitFor(() => expect(result.current.articles).toEqual(firstBatch));
    expect(getPublicPreview).toHaveBeenCalledTimes(2);
  });

  it("caches an empty array on fetch failure so we don't retry indefinitely", async () => {
    vi.mocked(getPublicPreview).mockRejectedValueOnce(new Error("boom"));
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => usePublicPreview("All", null, 5));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toEqual([]);
    consoleErr.mockRestore();
  });
});
