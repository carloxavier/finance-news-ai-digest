import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Mock the routing navigation to observe redirects.
const navigateMock = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>(
    "react-router",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../utils/userId", () => ({
  getUserId: vi.fn().mockReturnValue("u-1"),
  hasCompletedOnboarding: vi.fn().mockReturnValue(true),
  setOnboardingComplete: vi.fn(),
  setFeedToken: vi.fn(),
}));

vi.mock("../../utils/supabase", async () => {
  const actual = await vi.importActual<typeof import("../../utils/supabase")>(
    "../../utils/supabase",
  );
  return {
    ...actual,
    getTopics: vi.fn().mockResolvedValue([]),
    getUserDigestEmail: vi.fn().mockResolvedValue(null),
    getSubscriberFeed: vi.fn().mockResolvedValue(null),
    saveUserInterests: vi.fn(),
    saveUserTickers: vi.fn(),
    saveDigestSubscription: vi.fn(),
    saveOnboardingSurvey: vi.fn(),
    triggerWelcomeEmail: vi.fn(),
  };
});

import { Onboarding } from "../Onboarding";

describe("Onboarding redirect guard", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects an already-onboarded user to /feed by default", async () => {
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Onboarding />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/feed");
    });
  });

  it("does NOT redirect when entering /onboarding?edit=true (edit-interests flow)", async () => {
    render(
      <MemoryRouter initialEntries={["/onboarding?edit=true"]}>
        <Onboarding />
      </MemoryRouter>,
    );
    // Give the effect a chance to fire; assert it never navigates away.
    await new Promise((r) => setTimeout(r, 50));
    expect(navigateMock).not.toHaveBeenCalledWith("/feed");
  });
});
