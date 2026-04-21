import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Observe navigation.
const navigateMock = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>(
    "react-router",
  );
  return { ...actual, useNavigate: () => navigateMock };
});

// Keep the Feed focused on the integration points we care about.
vi.mock("../../utils/userId", () => ({
  getUserId: vi.fn().mockReturnValue("local-user"),
  hasCompletedOnboarding: vi.fn().mockReturnValue(true),
  resetOnboarding: vi.fn(),
  getFeedToken: vi.fn(),
  clearFeedToken: vi.fn(),
}));

vi.mock("../../utils/supabase", async () => {
  const actual = await vi.importActual<typeof import("../../utils/supabase")>(
    "../../utils/supabase",
  );
  return {
    ...actual,
    getActiveTopics: vi.fn().mockResolvedValue([
      { id: "1", slug: "macro", display_name: "Macro", dimension: "theme" },
      { id: "2", slug: "crypto", display_name: "Crypto", dimension: "theme" },
    ]),
    getUserDigestEmail: vi.fn().mockResolvedValue("you@example.com"),
    getUserInterestTopicNames: vi.fn(),
    getUserTrackedTickers: vi.fn(),
    getSubscriberByToken: vi.fn(),
    // Still used by useUserFeed for article loading when feed_token is present.
    // Default to an empty feed so article-loading never blocks the render.
    getSubscriberFeed: vi.fn().mockResolvedValue({
      subscriber: { email: "", frequency: "daily" },
      topics: [],
      articles: [],
    }),
    getUserFeed: vi.fn().mockResolvedValue([]),
    getGeneralFeed: vi.fn().mockResolvedValue([]),
    getArticlesByTopicSlugs: vi.fn().mockResolvedValue([]),
  };
});

// Avoid hitting the user_interests REST endpoint used to decide WelcomeCard.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "x" }], // pretend interests exist → no WelcomeCard
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

import { Feed } from "../Feed";
import {
  getUserDigestEmail,
  getUserInterestTopicNames,
  getUserTrackedTickers,
  getSubscriberByToken,
} from "../../utils/supabase";
import { getFeedToken } from "../../utils/userId";

function renderFeed() {
  return render(
    <MemoryRouter initialEntries={["/feed"]}>
      <Feed />
    </MemoryRouter>,
  );
}

describe("Feed — context strip data source", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(getFeedToken).mockReset();
    // mockClear (not mockReset) preserves the default mockResolvedValue
    // from the module-level vi.mock factory; mockReset wipes it and then
    // subsequent tests in other describe blocks that rely on the default
    // start getting undefined from the mock.
    vi.mocked(getUserDigestEmail).mockClear();
    vi.mocked(getUserInterestTopicNames).mockReset();
    vi.mocked(getUserTrackedTickers).mockReset();
    vi.mocked(getSubscriberByToken).mockReset();
  });

  it("resolves topic names via user_interests when there is no feed_token", async () => {
    vi.mocked(getFeedToken).mockReturnValue(null);
    vi.mocked(getUserDigestEmail).mockResolvedValue("you@example.com");
    vi.mocked(getUserInterestTopicNames).mockResolvedValue(["Macro"]);
    vi.mocked(getUserTrackedTickers).mockResolvedValue(["NVDA"]);

    renderFeed();

    await waitFor(() => {
      expect(screen.getByText(/Curated from:/)).toBeInTheDocument();
    });
    expect(screen.getByText("Macro")).toBeInTheDocument();
    expect(screen.getByText("NVDA")).toBeInTheDocument();
    expect(getSubscriberByToken).not.toHaveBeenCalled();
    // Direct-signup path: email comes from the local-user-id query.
    expect(getUserDigestEmail).toHaveBeenCalledWith("local-user");
  });

  it("resolves topic names from getSubscriberByToken (not local user_id) when a feed_token exists", async () => {
    // Regression guard for the "context strip lies to email-link subscribers"
    // bug. The local user_id on this device may not match the subscriber's
    // original user_id, so user_interests must NOT be queried.
    vi.mocked(getFeedToken).mockReturnValue("tok-42");
    vi.mocked(getSubscriberByToken).mockResolvedValue({
      email: "sub@example.com",
      frequency: "daily",
      timezone: "America/New_York",
      topics: [
        { slug: "macro", display_name: "Macro" },
        { slug: "crypto", display_name: "Crypto" },
      ],
    });

    renderFeed();

    await waitFor(() => {
      expect(screen.getByText(/Curated from:/)).toBeInTheDocument();
    });
    expect(screen.getByText("Macro, Crypto")).toBeInTheDocument();
    // Crucial: we must NOT have queried user_interests by localStorage user_id.
    expect(getUserInterestTopicNames).not.toHaveBeenCalled();
    expect(getUserTrackedTickers).not.toHaveBeenCalled();
    // Regression guard for the "avatar shows ? for email-link subscribers"
    // bug. The local user_id on this device won't map to any subscriber
    // row, so getUserDigestEmail must NOT be called here — email comes
    // from the subscriber feed's subscriber.email instead.
    expect(getUserDigestEmail).not.toHaveBeenCalled();
  });
});

describe("Feed — Edit button navigation", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(getFeedToken).mockReturnValue(null);
    vi.mocked(getUserInterestTopicNames).mockResolvedValue(["Macro"]);
    vi.mocked(getUserTrackedTickers).mockResolvedValue([]);
  });

  it("navigates to /onboarding?edit=true so the onboarded guard does not bounce back", async () => {
    renderFeed();
    const editBtn = await screen.findByRole("button", { name: /Edit/ });
    fireEvent.click(editBtn);
    expect(navigateMock).toHaveBeenCalledWith("/onboarding?edit=true");
  });
});

describe("Feed — article card publication guard", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(getFeedToken).mockReturnValue(null);
    vi.mocked(getUserInterestTopicNames).mockResolvedValue([]);
    vi.mocked(getUserTrackedTickers).mockResolvedValue([]);
  });

  it("omits the publication + separator block when an article has no publication", async () => {
    // Regression guard for hand-seeded bundles where `publication` is null:
    // the original code rendered "• date" with a dangling bullet.
    const { getUserFeed } = await import("../../utils/supabase");
    vi.mocked(getUserFeed).mockResolvedValue([
      {
        id: "a1",
        headline: "Rates up",
        publication: null as unknown as string,
        published_at: "2026-04-10T00:00:00Z",
        ai_preview: "preview",
        consensus_signal: "NO_RATING",
        extracted_tickers: [],
      },
    ]);

    renderFeed();
    await screen.findByText("Rates up");
    // The bullet separator only exists when publication renders; if it appears
    // with a null publication we'd have a dangling "• date" in the UI.
    expect(screen.queryByText("•")).not.toBeInTheDocument();
  });
});

describe("Feed — mode switching + chip toggle", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(getFeedToken).mockReturnValue(null);
    vi.mocked(getUserInterestTopicNames).mockResolvedValue([]);
    vi.mocked(getUserTrackedTickers).mockResolvedValue([]);
  });

  it("shows FeedContextStrip in Brief mode and ExploreChips in Explore mode", async () => {
    renderFeed();

    // Brief mode by default
    await screen.findByRole("button", { name: /Set up your interests/i });
    expect(screen.queryByRole("button", { name: "Macro" })).not.toBeInTheDocument();

    // Switch to Explore
    fireEvent.click(screen.getByRole("tab", { name: "Explore" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Macro" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /Set up your interests/i }),
    ).not.toBeInTheDocument();
  });

  it("toggles chip selection state independently (multi-select)", async () => {
    renderFeed();
    // Wait for initial load to finish so the tablist is rendered.
    const exploreTab = await screen.findByRole("tab", { name: "Explore" });
    fireEvent.click(exploreTab);

    const macro = await screen.findByRole("button", { name: "Macro" });
    const crypto = screen.getByRole("button", { name: "Crypto" });
    expect(macro).toHaveAttribute("aria-pressed", "false");
    expect(crypto).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(macro);
    expect(macro).toHaveAttribute("aria-pressed", "true");
    expect(crypto).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(crypto);
    expect(macro).toHaveAttribute("aria-pressed", "true");
    expect(crypto).toHaveAttribute("aria-pressed", "true");

    // Re-clicking deselects without affecting the other chip.
    fireEvent.click(macro);
    expect(macro).toHaveAttribute("aria-pressed", "false");
    expect(crypto).toHaveAttribute("aria-pressed", "true");
  });
});
