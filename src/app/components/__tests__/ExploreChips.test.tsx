import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExploreChips } from "../ExploreChips";
import type { TopicGroup } from "../../utils/topicGroups";

const GROUPS: TopicGroup[] = [
  { label: "Macro", slugs: ["macro"] },
  { label: "Crypto", slugs: ["crypto"] },
];

describe("ExploreChips", () => {
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

  it("calls onToggle with the chip's label when clicked", () => {
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
});
