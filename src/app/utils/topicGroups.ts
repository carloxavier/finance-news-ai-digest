// High-level topic groupings for the feed's tab bar.
//
// The `topics` table has ~20 granular slugs (technology, ai-infrastructure,
// semiconductors, biotech, etc). Rendering one tab per slug is noisy, so we
// fuse related slugs into a small number of human-readable groups.
//
// If you add or rename a topic slug in the database, update this file — any
// active slug that isn't referenced here will still show up via the "All"
// tab, but won't have its own group tab. A console warning is logged at
// runtime when uncategorised slugs are seen so they're easy to spot.

export interface TopicGroup {
  label: string;
  slugs: string[];
}

// Separator used to encode a Set<label> as a stable string for effect
// dependencies (see useUserFeed). Must be a character that cannot appear in
// any TopicGroup label. We use U+001F (Unit Separator), an unprintable ASCII
// control character that no human would ever type into a label.
//
// DO NOT change this to ',' or '|' — labels like "Commodities, Futures" or
// "Crypto | DeFi" would silently corrupt chip selection state.
// The `topicGroups.test.ts` guard will fail if any label contains this char.
export const CHIP_KEY_SEPARATOR = "\u001F";

export const TOPIC_GROUPS: TopicGroup[] = [
  {
    label: "Tech & AI",
    slugs: ["technology", "ai-infrastructure", "semiconductors", "cloud-saas"],
  },
  {
    label: "Markets",
    slugs: ["financials", "earnings", "ipo-markets", "mergers-acquisitions"],
  },
  {
    label: "Macro",
    slugs: ["macro", "geopolitics", "regulation"],
  },
  {
    label: "Energy",
    slugs: ["energy", "esg-climate"],
  },
  {
    label: "Health",
    slugs: ["healthcare", "biotech"],
  },
  {
    label: "Consumer",
    slugs: ["consumer", "real-estate", "industrials"],
  },
  {
    label: "Crypto",
    slugs: ["crypto"],
  },
];

// Return the subset of TOPIC_GROUPS that have at least one slug present in
// `activeSlugs`. Preserves the declared order. Also logs any active slug that
// isn't referenced in any group, so new DB slugs are easy to notice.
export function resolveVisibleGroups(activeSlugs: string[]): TopicGroup[] {
  const active = new Set(activeSlugs);
  const knownSlugs = new Set(TOPIC_GROUPS.flatMap((g) => g.slugs));
  const uncategorised = activeSlugs.filter((s) => !knownSlugs.has(s));
  if (uncategorised.length > 0) {
    console.warn(
      "[topicGroups] Uncategorised active slugs (add to TOPIC_GROUPS):",
      uncategorised,
    );
  }
  return TOPIC_GROUPS.filter((g) => g.slugs.some((s) => active.has(s)));
}

// Find a group by its label. Returns null if no such group.
export function findGroupByLabel(label: string): TopicGroup | null {
  return TOPIC_GROUPS.find((g) => g.label === label) ?? null;
}
