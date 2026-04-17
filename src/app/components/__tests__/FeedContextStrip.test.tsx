import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedContextStrip } from "../FeedContextStrip";

describe("FeedContextStrip", () => {
  it("shows a loading placeholder when loading", () => {
    render(
      <FeedContextStrip
        topicNames={[]}
        tickers={[]}
        onEdit={() => {}}
        loading
      />,
    );
    expect(screen.getByText(/loading your preferences/i)).toBeInTheDocument();
  });

  it('renders "Curated from" when only topics are set', () => {
    render(
      <FeedContextStrip
        topicNames={["Macro", "Technology"]}
        tickers={[]}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText(/Curated from:/)).toBeInTheDocument();
    expect(screen.getByText("Macro, Technology")).toBeInTheDocument();
    expect(screen.queryByText(/Tracking:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });

  it('renders "Tracking" when only tickers are set', () => {
    render(
      <FeedContextStrip
        topicNames={[]}
        tickers={["NVDA", "AAPL"]}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText(/Tracking:/)).toBeInTheDocument();
    expect(screen.getByText("NVDA, AAPL")).toBeInTheDocument();
    expect(screen.queryByText(/Curated from:/)).not.toBeInTheDocument();
  });

  it('shows empty-state copy and "Set up your interests" CTA when nothing is set', () => {
    render(
      <FeedContextStrip
        topicNames={[]}
        tickers={[]}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText(/Showing latest articles/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Set up your interests/i }),
    ).toBeInTheDocument();
  });

  it("truncates more than 5 items", () => {
    render(
      <FeedContextStrip
        topicNames={["A", "B", "C", "D", "E", "F"]}
        tickers={[]}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("A, B, C, D + 2 more")).toBeInTheDocument();
  });

  it("calls onEdit when the CTA is clicked", () => {
    const onEdit = vi.fn();
    render(
      <FeedContextStrip
        topicNames={["Macro"]}
        tickers={[]}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
