# P5 — Decide fate of news_sources table

**Filed**: 2026-04-18
**Status**: open

## Summary

The `news_sources` table exists in the schema with 12 manually-seeded rows from 2026-03-11 (Reuters, CNBC, EIA, CNBC, etc., tiered tier1/tier2). **Nothing writes to it. Nothing reads from it.** It's been sitting unused for ~5 weeks.

Decision needed: either wire it in or drop it.

## Options

### Option A: Make it the canonical source registry

Use `news_sources` as the single source of truth for source policy across the product. Would require:

- Add an `is_restricted` boolean column (for the Bloomberg/Reuters/WSJ/etc. list currently hardcoded in the seeder skill).
- Migrate the skill's restricted-domain constant to query this table.
- Auto-insert new domains as they appear in article citations (via a trigger or seeder skill hook).
- Increment `article_count` when articles cite a source.
- Optionally drive UI badges ("Source: tier 1 · verified") from this table.

**Benefit**: one place to change source policy. Today the seeder skill has its own list; if we later add server-side article processing, that would need its own copy. Centralizing prevents drift.

**Cost**: real engineering work. The skill needs to be restructured to read live data. The auto-insert logic needs to live somewhere (DB trigger or application code).

### Option B: Drop it

If we're not going to use it, drop the table to reduce schema surface area.

```sql
DROP TABLE news_sources;
```

Skill's hardcoded list remains the authoritative source policy.

**Benefit**: less unused schema confusing future readers.

**Cost**: if we ever want a source registry later, we start from scratch.

## Recommendation

**Option B for now.** The seeder skill's hardcoded list is working fine for the prototype validation phase. Adding a DB-backed source registry is solving a problem we don't yet have (multi-pipeline source policy coordination) at the cost of complexity we don't need.

Revisit if/when:
- An automated article-processing pipeline is built (so there are now two consumers of the source policy — skill + pipeline — and keeping them in sync becomes painful).
- The restricted-domain list grows beyond ~20 items and becomes awkward in code.
- A content-quality audit workflow emerges that would benefit from tracking `article_count` per source.

## Priority justification

P5. Zero product impact either way. Worth deciding explicitly so the table doesn't sit in schema limbo forever.

## Acceptance

- Decision made (Option A or B) and documented here as a `## Decision` section.
- Corresponding code / schema change shipped.
- [`docs/data-model/reference-tables.md`](../data-model/reference-tables.md) updated to either describe the wired-up table OR remove the `news_sources` section.
