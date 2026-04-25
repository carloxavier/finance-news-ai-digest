# Digest relevance ranking

The web feed and digest email both pull articles through
`get_subscriber_feed`. Until v14 the RPC returned articles ordered by
`published_at DESC`; v14 replaces that with a three-dimension relevance
score so that "important + fresh + relevant to me" wins over "newest".

## The three dimensions

```
relevance = personal × market × temporal
```

Each factor is independent and intuitive on its own. Multiplication
means a near-zero on any axis kills the score — a brilliant story for
someone else, a stale story, or a tiny no-name event all sink.

### Personal — `(topic_match + ticker_match)`

Range: 0.1 .. 1.5

- `topic_match`: 1.0 if any of the article's topics is in the user's
  `user_interests`, else **0.1 soft floor**. The soft floor is what
  lets cross-cutting mega-stories (Fed cut, NVDA blowout) reach a
  subscriber who didn't tick "monetary policy" in onboarding.
- `ticker_match`: 0.5 if any of the user's followed tickers appears in
  `primary_entities`, else 0.0. Additive on top of `topic_match`.

### Market — `cap_tier × (magnitude / 5)`

Range: 0.04 .. 1.0

`cap_tier` is the max across the article's `primary_entities`:

- `mega` → 1.0, `large` → 0.7, `mid` → 0.4, `small`/unknown → 0.2
- macro/regulatory entities → 0.9 (treated like a high-cap story)

`magnitude` is the LLM's 1–5 judgment from seed time, normalized to
0.2 .. 1.0.

### Temporal — `exp(-age_hours / half_life)`

Range: 0 (asymptotic) .. 1.0

Half-life depends on `story_type`:

- `breaking` → 18h (earnings, M&A, rate decisions decay fast)
- `thematic` → 72h (analysis, trend pieces stay relevant longer)

A `GREATEST(half_life, 1.0)` guard in the SQL keeps the exponent
defined when bad data slips through.

## Why fuzzy judgment at write time, arithmetic at read time

The seeder skill (Claude) is the only component with the context to
say "this is a magnitude-4 event because mega-cap earnings beat
expectations by Y%, not just a routine print." Calling an LLM at
`get_subscriber_feed` time would be cripplingly slow and expensive.
So fuzzy judgment is materialized once, at seed time, into scalar
columns; SQL just does the arithmetic on read.

This is also why the formula is intentionally simple. Tuning it
requires only changing weights in two places: the per-magnitude
constants in `calculate_relevance` (rare) and the cap-tier weights in
`get_subscriber_feed` (rarer). The expensive judgment is in seeded
data, not in code.

## Formula reference

Implemented in `supabase/migrations/<ts>_create_calculate_relevance.sql`:

```sql
SELECT
  (p_topic_match + p_ticker_match)
  * (p_cap_tier_weight * (p_magnitude::float / 5.0))
  * exp(-1.0 * p_age_hours / GREATEST(p_half_life_hours, 1.0));
```

Tests in `supabase/functions/__tests__/calculate_relevance_test.sql`
pin six properties of this formula (peak score, bottom score,
freshness-vs-cap, thematic-vs-breaking decay, ticker-match lift,
zero-half-life guard).

## Cluster dedup on top

> **v1 scope:** v1 stores `story_cluster_id` but does not consume it.
> Cross-bundle dedup at send time is deferred to a follow-up PR.

When two bundles cover the same underlying story (different angles,
different sources, same event), `send-digest`'s `selection.ts` will
eventually drop all but the highest-scored bundle per
`story_cluster_id`. The column ships in v1 to give us data to study
duplication patterns before we write the dedup rule.

## New product feature: Follow tickers

> **v1 scope:** v1 ships the `subscriber_tickers` table empty. The
> onboarding/dashboard UX that populates it is a separate follow-up PR.
> Ranking works without it — `ticker_match` degrades to 0 when empty.

The follow-tickers UX adds:

- An onboarding step (after topics) where a subscriber picks the
  tickers they actively follow.
- A dashboard control to add/remove follows.
- Inline "Follow TSLA" buttons in the digest email's article cards.

Once populated, `ticker_match` contributes a 0.5 boost per matching
article — meaningful but not dominant. A subscriber following AAPL
will see Apple stories rank higher than non-Apple mega-caps, but a
truly huge non-Apple story (Fed cut, NVDA blowout) can still beat a
modest Apple print.

## Out of scope for v1

- Click-based personalization (CTR-weighted topic scores)
- Per-subscriber magnitude calibration ("this user only wants
  mag-4+ stories")
- A/B framework for weight tuning
- Cap-tier expansion past the initial ~90 hand-curated tickers

These are filed in `docs/backlog/` as separate items.
