import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedModeToggle } from "../FeedModeToggle";

describe("FeedModeToggle", () => {
  it("renders as an ARIA tablist with the active tab marked aria-selected", () => {
    render(<FeedModeToggle mode="brief" onModeChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Your Brief" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Explore" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("fires onModeChange for the inactive tab but not the active one", () => {
    const onChange = vi.fn();
    render(<FeedModeToggle mode="brief" onModeChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Your Brief" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Explore" }));
    expect(onChange).toHaveBeenCalledWith("explore");
  });
});
