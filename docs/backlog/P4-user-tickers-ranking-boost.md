# P4 — Use user_tickers for ranking boost, not just email highlighting

**Filed**: 2026-04-18
**Status**: open

## Summary

`user_tickers` is currently used only for visual highlighting in
the digest email — articles that mention a tracked ticker get a
blue-highlighted chip. The articles themselves are selected by
`user_interests` (topics), not by tickers.

The product intent was broader: tickers as a real personalization
signal. Refined intent: tracked tickers should **boost the
ranking** of articles that mention them, not filter the feed.

## Target behavior

- Ranking boost: articles whose `extracted_tickers` intersect
  with the user's `user_tickers` get a relevance boost in the
  final ordering.
- Not filtering: a user tracking AAPL still sees macro/Fed/oil
  stories.
- Highlighting stays: the current blue-chip styling is good UX;
  keep as a secondary signal after ranking applies.

## Implementation

After feed RPC consolidation, the ranking math lives in
`get_subscriber_feed`. Add a `has_user_ticker_match` term to
the rank score with tunable weight.

## Acceptance

- `get_subscriber_feed` ranking incorporates ticker match.
- Feed ordering visibly changes when a subscriber has tracked
  tickers vs. when they don't.
- Email highlighting continues to work as today.
- `docs/data-model/article-lifecycle.md` updated.

## Priority

P4 — pair with `P4-consolidate-feed-rpcs.md` since both touch
the same ranking code path.
