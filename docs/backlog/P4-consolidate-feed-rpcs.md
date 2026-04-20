# P4 — Consolidate feed RPCs from four to two

**Filed**: 2026-04-18
**Status**: open

## Summary

The feed architecture currently has four RPCs where the design calls
for two:

- `get_user_feed` — anonymous web users (legacy)
- `get_subscriber_feed` — canonical authenticated/tokenized feed
- `get_articles_by_topics` — used by Explore
- `get_general_feed` — public fallback

Target shape:

- `get_subscriber_feed(p_token, p_limit)` — remains; serves anyone
  with a valid feed_token (email link, logged-in app, authenticated
  web).
- `get_public_feed(p_limit)` — public fallback for unauthenticated
  direct site visitors. Merges the responsibilities of
  `get_user_feed`, `get_articles_by_topics`, and `get_general_feed`.

## Scope

- Implement `get_public_feed` with caching parity to
  `get_subscriber_feed`.
- Migrate `Landing.tsx`, `ExploreFeed.tsx`, and any remaining
  `Feed.tsx` anonymous paths to call `get_public_feed`.
- Drop the three deprecated RPCs in a follow-up migration after a
  grace period (2 weeks, monitor Postgres logs for external callers).
- Bundle in the ranking-alignment work previously filed as
  "P4-align-get_subscriber-feed-ranking-with-get_user_feed" — the
  consolidation makes that trivial since ranking lives in one place.

## Acceptance

- Exactly two active feed RPCs: `get_subscriber_feed`,
  `get_public_feed`.
- Ranking logic defined once; both RPCs apply consistent rules.
- `docs/data-model/article-lifecycle.md` updated (Feed RPCs section).
- All five frontend feed-fetch sites wired to the correct RPC.
- Legacy RPCs marked deprecated for 2 weeks, then dropped.

## Priority

P4 — not user-visible; internal consistency and future-change
velocity. Pair with P4-user-tickers-ranking-boost since they touch
the same ranking code path.
