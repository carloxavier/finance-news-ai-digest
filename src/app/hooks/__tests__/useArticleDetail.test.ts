import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ArticleDetail } from "../../utils/supabase";

vi.mock("../../utils/supabase", async () => {
  const actual = await vi.importActual<typeof import("../../utils/supabase")>(
    "../../utils/supabase",
  );
  return {
    ...actual,
    getArticleDetail: vi.fn(),
  };
});

import { getArticleDetail } from "../../utils/supabase";
import { useArticleDetail } from "../useArticleDetail";

const MOCK_ARTICLE = {
  id: "abc-123",
  headline: "A headline",
  publication: "Bloomberg",
  published_at: "2026-04-10T00:00:00Z",
  brief: "point one. point two.",
  extracted_tickers: ["AAPL"],
  consensus_signal: "BUY",
  citations: [],
  analyst_data: {},
  inference_watch: [],
  inference_risks: [],
  inference_questions: [],
} as unknown as ArticleDetail;

describe("useArticleDetail", () => {
  beforeEach(() => {
    vi.mocked(getArticleDetail).mockReset();
  });

  it("skips the fetch when id is undefined", () => {
    const { result } = renderHook(() => useArticleDetail(undefined));
    expect(result.current.loading).toBe(true);
    expect(result.current.article).toBeNull();
    expect(getArticleDetail).not.toHaveBeenCalled();
  });

  it("fetches the article when an id is supplied", async () => {
    vi.mocked(getArticleDetail).mockResolvedValue(MOCK_ARTICLE);

    const { result } = renderHook(() => useArticleDetail("abc-123"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.article).toEqual(MOCK_ARTICLE);
    expect(getArticleDetail).toHaveBeenCalledWith("abc-123");
  });

  it("re-fetches when id changes", async () => {
    const second = { ...MOCK_ARTICLE, id: "def-456" } as ArticleDetail;
    vi.mocked(getArticleDetail)
      .mockResolvedValueOnce(MOCK_ARTICLE)
      .mockResolvedValueOnce(second);

    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useArticleDetail(id),
      { initialProps: { id: "abc-123" as string | undefined } },
    );

    await waitFor(() => expect(result.current.article?.id).toBe("abc-123"));

    rerender({ id: "def-456" });
    await waitFor(() => expect(result.current.article?.id).toBe("def-456"));
    expect(getArticleDetail).toHaveBeenCalledTimes(2);
  });

  it("swallows errors and exposes null article", async () => {
    vi.mocked(getArticleDetail).mockRejectedValue(new Error("boom"));
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useArticleDetail("abc-123"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.article).toBeNull();
    consoleErr.mockRestore();
  });
});
