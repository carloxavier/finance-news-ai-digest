import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logAiClickIntent } from "../supabase";

// The contract these tests lock in:
//   1. Happy path — POSTs to /rest/v1/ai_agent_waitlist with the right fields.
//   2. Never throws. The CTA redirect must never be blocked by a log failure.
//
// The CTA handler calls `void logAiClickIntent(...)` before opening the AI
// in a new tab. If logAiClickIntent starts throwing, that `void` swallows
// the rejection at runtime but the user experience degrades (redirect races
// the unhandled rejection). These tests guard the contract.

describe("logAiClickIntent", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs user_id, article_id, ai_provider, and email to ai_agent_waitlist", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await logAiClickIntent("user-1", "article-1", "grok", "  You@Example.com  ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/rest\/v1\/ai_agent_waitlist$/);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      user_id: "user-1",
      article_id: "article-1",
      ai_provider: "grok",
      // Email is lowercased + trimmed.
      email: "you@example.com",
    });
    vi.unstubAllGlobals();
  });

  it("omits email when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await logAiClickIntent("user-1", "article-1", "grok");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.email).toBeUndefined();
    expect(body.user_id).toBe("user-1");
    vi.unstubAllGlobals();
  });

  it("resolves (never throws) when the server returns a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }),
    );
    await expect(logAiClickIntent("u", "a", "grok")).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("resolves (never throws) when fetch rejects (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(logAiClickIntent("u", "a", "grok")).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("resolves (never throws) for malformed inputs that might break JSON encoding", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
    // Upstream callers could plausibly pass odd values. The contract is
    // resilience, not strict validation.
    await expect(logAiClickIntent("", "", "grok", "")).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});
