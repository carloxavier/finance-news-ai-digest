# P4 — Morning digest contains stale articles (>24h old)

**Filed**: 2026-04-20
**Status**: open

## Summary

Reported by Carlo on 2026-04-20: the digest email received this
morning contained articles published the day before, with some
articles 2–3 days old further down the list. Users expect the
morning digest to reflect today's news, not a week's worth of
lag.

## Root cause (as understood today)

Two contributing factors:

1. **Seeding cadence is too low.** Articles are seeded ~once per
   day (via the Cowork task). The digest is sent on an hourly
   timezone-aware cron; subscribers in later timezones get
   deliveries 12+ hours after the last seed. Between seeds, new
   articles don't exist in the DB to select from.
2. **`send-digest` recency filter is 30 days.** In
   `supabase/functions/send-digest/index.ts`, the fallback path
   on `ai_articles` applies:
   `.gt("published_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())`
   The filter is so loose that if topic coverage is thin for a
   subscriber's interests, articles from 2–3 days ago rank into
   the top-10 slice. The ORDER BY published_at DESC isn't enough
   to push stale-but-still-eligible articles out when the
   eligible pool is small.

## Proposed direction

Two parallel fixes; do both, not one:

### Fix A — Increase seeding cadence

At minimum 3x/day seeding runs:
- 06:00 UTC — overnight US news sweep
- 13:00 UTC — pre-digest top-up for European/US morning deliveries
- 20:00 UTC — US afternoon catch-up

Options for implementation (see also the retired Notion item #13):

- Short term: duplicate the existing Cowork automation for each
  slot. Zero engineering, immediate improvement.
- Medium term: migrate seeding to Managed Agents via the API,
  triggered by pg_cron (see the retired Notion item #14 for
  design). Cheaper per-run at 3x/day volume.

### Fix B — Tighten digest recency filter

Change `send-digest` recency filter from 30 days to something
more aggressive, e.g. 72 hours (or 48 — TBD based on coverage
sufficiency per topic). Combine with a minimum coverage guard:
if fewer than N articles in the 72h window match the subscriber's
interests, gracefully fall back to the next widest window rather
than ship an empty email.

This requires validating — on real subscriber data — that
tightening the window doesn't starve subscribers with niche
topic sets. Run a dry pass against current subscribers before
shipping.

## Scope

- Implement Fix A (seeding cadence increase). Measure
  improvement in "median article age per digest" for one week.
- If Fix A alone doesn't bring median article age below 24 hours,
  implement Fix B with the coverage-guard fallback.
- Add a query to the analytics surface: "median age of articles
  shipped per subscriber per day, last 7 days."

## Acceptance

- Median age of articles shipped in the morning digest (as seen
  by the subscriber) is under 24 hours.
- No subscriber receives an empty digest (zero articles) as a
  side effect of the fix.
- `docs/data-model/article-lifecycle.md` updated with new
  seeding cadence.

## Priority

P4 — user-visible, content quality, but not a blocker to any
launch. Reported during active tester usage, so escalate if more
subscribers flag it.
