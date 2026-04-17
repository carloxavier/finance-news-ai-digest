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

// NOTE on test scope: `getUserInterestTopicNames` and `getUserTrackedTickers`
// share the same defensive guards (!res.ok → [], non-array body → [], fetch
// throws → []). We exercise those guards thoroughly on the more complex
// function (topics, which also has the object/array embed shape) and only
// cover the happy + non-array body cases on tickers to avoid duplicate
// coverage of identical code paths.

describe("getUserInterestTopicNames", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("extracts display_name from singular `topics` objects and skips nulls", async () => {
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
    expect(await getUserInterestTopicNames("u-1")).toEqual(["Macro", "Crypto"]);
  });

  it("tolerates topics arriving as arrays (PostgREST to-many shape)", async () => {
    // Regression guard: if the FK relationship is ever inferred as to-many,
    // `topics` comes through as an array — silent empty results otherwise.
    mockFetch([
      {
        ok: true,
        body: [
          { topics: [{ display_name: "Macro" }] },
          { topics: [{ display_name: "Technology" }] },
        ],
      },
    ]);
    expect(await getUserInterestTopicNames("u-1")).toEqual(["Macro", "Technology"]);
  });

  it("returns [] when the body is a non-array PostgREST error payload", async () => {
    // PostgREST can return 200 with an object like {code, message} in edge cases.
    mockFetch([{ ok: true, body: { code: "PGRST116", message: "not found" } }]);
    expect(await getUserInterestTopicNames("u-1")).toEqual([]);
  });

  it("returns [] on HTTP error and on fetch rejection", async () => {
    mockFetch([{ ok: false, body: {} }]);
    expect(await getUserInterestTopicNames("u-1")).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await getUserInterestTopicNames("u-1")).toEqual([]);
  });
});

describe("getUserTrackedTickers", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("returns tickers from a well-formed response", async () => {
    mockFetch([{ ok: true, body: [{ ticker: "NVDA" }, { ticker: "AAPL" }] }]);
    expect(await getUserTrackedTickers("u-1")).toEqual(["NVDA", "AAPL"]);
  });

  it("returns [] when the body is a non-array PostgREST error payload", async () => {
    mockFetch([{ ok: true, body: { code: "PGRST116" } }]);
    expect(await getUserTrackedTickers("u-1")).toEqual([]);
  });
});
