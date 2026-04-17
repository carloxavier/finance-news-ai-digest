import { describe, it, expect } from "vitest";
import {
  TOPIC_GROUPS,
  CHIP_KEY_SEPARATOR,
  findGroupByLabel,
  resolveVisibleGroups,
} from "../topicGroups";

describe("TOPIC_GROUPS invariants", () => {
  it("uses a chip-key separator that cannot appear in a human-typed label", () => {
    // If CHIP_KEY_SEPARATOR is ever changed to a printable char like ',' or '|',
    // labels containing that char will silently corrupt chip selection state.
    expect(CHIP_KEY_SEPARATOR).not.toMatch(/[\w\s,|;:/\\-]/);
  });

  it("has no label that contains the chip-key separator", () => {
    const offenders = TOPIC_GROUPS.filter((g) =>
      g.label.includes(CHIP_KEY_SEPARATOR),
    );
    expect(offenders).toEqual([]);
  });

  it("has unique labels across all groups", () => {
    const labels = TOPIC_GROUPS.map((g) => g.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("findGroupByLabel", () => {
  it("returns the matching group or null when unknown", () => {
    expect(findGroupByLabel("Crypto")?.slugs).toEqual(["crypto"]);
    expect(findGroupByLabel("NopeNotAGroup")).toBeNull();
  });
});

describe("resolveVisibleGroups", () => {
  it("returns only groups with an active slug, in declared order", () => {
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
