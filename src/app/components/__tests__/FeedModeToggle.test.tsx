import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedModeToggle } from "../FeedModeToggle";

describe("FeedModeToggle", () => {
  it("exposes a tablist role with two tabs", () => {
    render(<FeedModeToggle mode="brief" onModeChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("marks the active tab with aria-selected", () => {
    render(<FeedModeToggle mode="brief" onModeChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Your Brief" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Explore" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("fires onModeChange when clicking the inactive tab", () => {
    const onChange = vi.fn();
    render(<FeedModeToggle mode="brief" onModeChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Explore" }));
    expect(onChange).toHaveBeenCalledWith("explore");
  });

  it("does NOT fire onModeChange when clicking the already-active tab", () => {
    const onChange = vi.fn();
    render(<FeedModeToggle mode="brief" onModeChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Your Brief" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
