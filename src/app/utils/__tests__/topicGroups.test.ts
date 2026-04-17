import { describe, it, expect } from "vitest";
import {
  TOPIC_GROUPS,
  CHIP_KEY_SEPARATOR,
  findGroupByLabel,
  resolveVisibleGroups,
} from "../topicGroups";

describe("TOPIC_GROUPS", () => {
  it("exposes a dedicated chip-key separator that is not a human-typable character", () => {
    // If CHIP_KEY_SEPARATOR is ever changed to a printable char like ',' or '|',
    // labels containing that char will silently corrupt chip selection state.
    expect(CHIP_KEY_SEPARATOR).not.toMatch(/[\w\s,|;:/\\-]/);
  });

  it("has no label that contains the chip-key separator", () => {
    // Invariant: labels must not contain the chip-key separator because
    // the Feed encodes selected chip labels as a single string joined by it.
    const offenders = TOPIC_GROUPS.filter((g) =>
      g.label.includes(CHIP_KEY_SEPARATOR),
    );
    expect(offenders).toEqual([]);
  });

  it("has unique labels across all groups", () => {
    const labels = TOPIC_GROUPS.map((g) => g.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

describe("findGroupByLabel", () => {
  it("returns the group for a known label", () => {
    expect(findGroupByLabel("Crypto")).toEqual({
      label: "Crypto",
      slugs: ["crypto"],
    });
  });

  it("returns null for an unknown label", () => {
    expect(findGroupByLabel("NopeNotAGroup")).toBeNull();
  });
});

describe("resolveVisibleGroups", () => {
  it("returns only groups that have at least one active slug", () => {
    const groups = resolveVisibleGroups(["crypto", "macro"]);
    const labels = groups.map((g) => g.label);
    expect(labels).toContain("Crypto");
    expect(labels).toContain("Macro");
    expect(labels).not.toContain("Health");
  });

  it("preserves declared order", () => {
    const groups = resolveVisibleGroups([
      "crypto",
      "technology",
      "macro",
      "biotech",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Tech & AI",
      "Macro",
      "Health",
      "Crypto",
    ]);
  });
});
