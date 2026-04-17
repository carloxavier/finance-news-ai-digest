import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getUserInterestTopicNames, getUserTrackedTickers } from "../supabase";

// Helper: mock global fetch with a sequence of responses.
function mockFetch(responses: Array<{ ok: boolean; body: unknown }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      json: async () => r.body,
    });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("getUserInterestTopicNames", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns display names when topics come back as singular objects", async () => {
    mockFetch([
      {
        ok: true,
        body: [
          { topics: { display_name: "Macro" } },
          { topics: { display_name: "Technology" } },
        ],
      },
    ]);
    const names = await getUserInterestTopicNames("u-1");
    expect(names).toEqual(["Macro", "Technology"]);
  });

  it("tolerates topics arriving as arrays (PostgREST to-many shape)", async () => {
    mockFetch([
      {
        ok: true,
        body: [
          { topics: [{ display_name: "Macro" }] },
          { topics: [{ display_name: "Technology" }] },
        ],
      },
    ]);
    const names = await getUserInterestTopicNames("u-1");
    expect(names).toEqual(["Macro", "Technology"]);
  });

  it("skips rows with null topics", async () => {
    mockFetch([
      {
        ok: true,
        body: [
          { topics: { display_name: "Macro" } },
          { topics: null },
          { topics: { display_name: "Crypto" } },
        ],
      },
    ]);
    const names = await getUserInterestTopicNames("u-1");
    expect(names).toEqual(["Macro", "Crypto"]);
  });

  it("returns [] when response is not ok", async () => {
    mockFetch([{ ok: false, body: { code: "PGRST116" } }]);
    const names = await getUserInterestTopicNames("u-1");
    expect(names).toEqual([]);
  });

  it("returns [] when body is an error object instead of an array", async () => {
    // PostgREST can return 200 with a non-array payload for some edge cases.
    mockFetch([{ ok: true, body: { code: "PGRST116", message: "not found" } }]);
    const names = await getUserInterestTopicNames("u-1");
    expect(names).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network")),
    );
    const names = await getUserInterestTopicNames("u-1");
    expect(names).toEqual([]);
  });
});

describe("getUserTrackedTickers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns tickers from a well-formed response", async () => {
    mockFetch([
      {
        ok: true,
        body: [{ ticker: "NVDA" }, { ticker: "AAPL" }],
      },
    ]);
    const tickers = await getUserTrackedTickers("u-1");
    expect(tickers).toEqual(["NVDA", "AAPL"]);
  });

  it("returns [] when response is not ok", async () => {
    mockFetch([{ ok: false, body: {} }]);
    const tickers = await getUserTrackedTickers("u-1");
    expect(tickers).toEqual([]);
  });

  it("returns [] when body is a non-array error object", async () => {
    mockFetch([{ ok: true, body: { code: "PGRST116" } }]);
    const tickers = await getUserTrackedTickers("u-1");
    expect(tickers).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network")),
    );
    const tickers = await getUserTrackedTickers("u-1");
    expect(tickers).toEqual([]);
  });
});
