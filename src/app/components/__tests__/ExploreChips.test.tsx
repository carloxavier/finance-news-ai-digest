import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExploreChips } from "../ExploreChips";
import type { TopicGroup } from "../../utils/topicGroups";

const GROUPS: TopicGroup[] = [
  { label: "Macro", slugs: ["macro"] },
  { label: "Crypto", slugs: ["crypto"] },
  { label: "Tech & AI", slugs: ["technology"] },
];

describe("ExploreChips", () => {
  it("renders one button per visible group", () => {
    render(
      <ExploreChips
        visibleGroups={GROUPS}
        selectedGroups={new Set()}
        onToggle={() => {}}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(GROUPS.length);
  });

  it("reflects selection state via aria-pressed", () => {
    render(
      <ExploreChips
        visibleGroups={GROUPS}
        selectedGroups={new Set(["Macro"])}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Macro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Crypto" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onToggle with the label when a chip is clicked", () => {
    const onToggle = vi.fn();
    render(
      <ExploreChips
        visibleGroups={GROUPS}
        selectedGroups={new Set()}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Crypto" }));
    expect(onToggle).toHaveBeenCalledWith("Crypto");
  });

  it("supports independent multi-select (each click toggles one chip)", () => {
    const onToggle = vi.fn();
    render(
      <ExploreChips
        visibleGroups={GROUPS}
        selectedGroups={new Set(["Macro"])}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Crypto" }));
    fireEvent.click(screen.getByRole("button", { name: "Macro" }));
    expect(onToggle).toHaveBeenNthCalledWith(1, "Crypto");
    expect(onToggle).toHaveBeenNthCalledWith(2, "Macro");
  });
});
