import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

// Mocks must be declared before importing the module under test.

const navigateMock = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../utils/userId", () => ({
  getUserId: vi.fn().mockReturnValue("local-user"),
  getFeedToken: vi.fn(),
  setFeedToken: vi.fn(),
  setOnboardingComplete: vi.fn(),
}));

vi.mock("../../hooks/useArticleDetail", () => ({
  useArticleDetail: (id: string | undefined) => ({
    article: id
      ? {
          id,
          headline: "Test Headline",
          publication: "Test Pub",
          published_at: "2026-04-21T00:00:00Z",
          ai_preview: "preview",
          consensus_signal: "BUY",
          extracted_tickers: [],
          brief_bullets: [],
          brief: null,
          citations: null,
          analyst_data: null,
          inference_watch: null,
          inference_risks: null,
          inference_questions: null,
        }
      : null,
    loading: false,
  }),
}));

vi.mock("../../utils/supabase", async () => {
  const actual = await vi.importActual<typeof import("../../utils/supabase")>(
    "../../utils/supabase",
  );
  return {
    ...actual,
    getSubscriberByToken: vi.fn(),
    getUserDigestEmail: vi.fn(),
    logAiClickIntent: vi.fn().mockResolvedValue(undefined),
    formatArticleDate: vi.fn().mockReturnValue("Apr 21"),
  };
});

import { ArticleDetail } from "../ArticleDetail";
import {
  getSubscriberByToken,
  getUserDigestEmail,
  logAiClickIntent,
} from "../../utils/supabase";
import { getFeedToken } from "../../utils/userId";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/article/:id" element={<ArticleDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ArticleDetail — Ask AI branching", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.mocked(getFeedToken).mockReset();
    vi.mocked(getSubscriberByToken).mockReset();
    vi.mocked(getUserDigestEmail).mockReset();
    vi.mocked(logAiClickIntent).mockClear();
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("opens Grok in a new tab (no modal) when a feed_token is present, auto-attaching the subscriber's email", async () => {
    vi.mocked(getFeedToken).mockReturnValue("tok-42");
    vi.mocked(getSubscriberByToken).mockResolvedValue({
      email: "sub@example.com",
      frequency: "daily",
      timezone: "UTC",
      topics: [],
    });

    renderAt("/article/abc-123");

    // Wait for the subscriber-by-token fetch to resolve so the component
    // has the email before we click.
    await waitFor(() => expect(getSubscriberByToken).toHaveBeenCalledWith("tok-42"));

    fireEvent.click(await screen.findByRole("button", { name: /Ask AI about this article/i }));

    // Regression guard for the "anonymous path fires on subscribers" bug.
    // The interstitial modal must NOT appear — going through it with a
    // captured email when we already know the email would be noisy UX.
    expect(screen.queryByText(/Continue to Grok/i)).not.toBeInTheDocument();

    // Grok was opened in a new tab with noopener+noreferrer.
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [grokUrl, target, features] = openSpy.mock.calls[0];
    expect(String(grokUrl).startsWith("https://grok.com/?q=")).toBe(true);
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");

    // Click logged with the subscriber's email auto-attached.
    expect(logAiClickIntent).toHaveBeenCalledWith(
      "local-user",
      "abc-123",
      "grok",
      "sub@example.com",
    );
  });

  it("shows the interstitial modal (no Grok open yet) when there is no feed_token", async () => {
    vi.mocked(getFeedToken).mockReturnValue(null);
    vi.mocked(getUserDigestEmail).mockResolvedValue(null);

    renderAt("/article/abc-123");

    // Wait for mount-effects to settle.
    await waitFor(() => expect(getUserDigestEmail).toHaveBeenCalledWith("local-user"));

    fireEvent.click(await screen.findByRole("button", { name: /Ask AI about this article/i }));

    // The interstitial should be visible; Grok should NOT have been opened yet.
    expect(await screen.findByText(/Continue to Grok/i)).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
    // And nothing logged until the user confirms via "Continue to Grok".
    expect(logAiClickIntent).not.toHaveBeenCalled();
  });

  it("logs + opens Grok when the anonymous visitor clicks Continue to Grok, with optional email honoured", async () => {
    vi.mocked(getFeedToken).mockReturnValue(null);
    vi.mocked(getUserDigestEmail).mockResolvedValue(null);

    renderAt("/article/abc-123");

    await waitFor(() => expect(getUserDigestEmail).toHaveBeenCalledWith("local-user"));

    fireEvent.click(await screen.findByRole("button", { name: /Ask AI about this article/i }));

    // Type an email into the modal's input and continue.
    const input = (await screen.findByPlaceholderText(/you@example\.com/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "visitor@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue to Grok/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toMatch(/^https:\/\/grok\.com\/\?q=/);
    expect(logAiClickIntent).toHaveBeenCalledWith(
      "local-user",
      "abc-123",
      "grok",
      "visitor@example.com",
    );
  });

  it("anonymous path: pre-fills the modal when getUserDigestEmail finds a same-device landing-page subscriber", async () => {
    // Regression guard for the third subscriber type: signed up via the
    // landing form on this device, no feed_token yet, but user_id → email
    // resolves. Email input should come pre-filled.
    vi.mocked(getFeedToken).mockReturnValue(null);
    vi.mocked(getUserDigestEmail).mockResolvedValue("landing@example.com");

    renderAt("/article/abc-123");

    await waitFor(() => expect(getUserDigestEmail).toHaveBeenCalledWith("local-user"));

    fireEvent.click(await screen.findByRole("button", { name: /Ask AI about this article/i }));
    const input = (await screen.findByPlaceholderText(/you@example\.com/i)) as HTMLInputElement;

    await waitFor(() => expect(input.value).toBe("landing@example.com"));
  });
});
