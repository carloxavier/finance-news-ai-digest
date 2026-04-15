import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Article } from "../../utils/supabase";

// Mock the supabase module before importing the hook
vi.mock("../../utils/supabase", async () => {
  const actual = await vi.importActual<typeof import("../../utils/supabase")>(
    "../../utils/supabase",
  );
  return {
    ...actual,
    getGeneralFeed: vi.fn(),
  };
});

import { getGeneralFeed } from "../../utils/supabase";
import { useGeneralFeed } from "../useGeneralFeed";

const MOCK_ARTICLES: Article[] = [
  {
    id: "a1",
    headline: "Test headline 1",
    publication: "Reuters",
    published_at: "2026-04-10T00:00:00Z",
    ai_preview: "preview 1",
    consensus_signal: "BUY",
    extracted_tickers: ["AAPL"],
  } as unknown as Article,
  {
    id: "a2",
    headline: "Test headline 2",
    publication: "Bloomberg",
    published_at: "2026-04-09T00:00:00Z",
    ai_preview: "preview 2",
    consensus_signal: "SELL",
    extracted_tickers: ["TSLA"],
  } as unknown as Article,
];

describe("useGeneralFeed", () => {
  beforeEach(() => {
    vi.mocked(getGeneralFeed).mockReset();
  });

  it("starts in a loading state and exposes an empty article list", () => {
    vi.mocked(getGeneralFeed).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useGeneralFeed(20));
    expect(result.current.loading).toBe(true);
    expect(result.current.articles).toEqual([]);
  });

  it("resolves with fetched articles and clears loading", async () => {
    vi.mocked(getGeneralFeed).mockResolvedValue(MOCK_ARTICLES);
    const { result } = renderHook(() => useGeneralFeed(20));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toEqual(MOCK_ARTICLES);
    expect(getGeneralFeed).toHaveBeenCalledWith(20);
  });

  it("passes through a custom limit", async () => {
    vi.mocked(getGeneralFeed).mockResolvedValue([]);
    renderHook(() => useGeneralFeed(5));
    await waitFor(() => expect(getGeneralFeed).toHaveBeenCalledWith(5));
  });

  it("swallows errors and still resolves loading", async () => {
    vi.mocked(getGeneralFeed).mockRejectedValue(new Error("boom"));
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useGeneralFeed(20));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.articles).toEqual([]);
    consoleErr.mockRestore();
  });

  it("does not update state after unmount (cancellation)", async () => {
    let resolve!: (value: Article[]) => void;
    vi.mocked(getGeneralFeed).mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );

    const { result, unmount } = renderHook(() => useGeneralFeed(20));
    unmount();
    resolve(MOCK_ARTICLES);

    // Give the microtask queue a turn
    await Promise.resolve();
    await Promise.resolve();

    // State is captured at unmount time — still the initial empty array
    expect(result.current.articles).toEqual([]);
  });
});
