# P4 — Lean subscriber-by-token RPC (stop overfetching `get_subscriber_feed` for email)

**Filed**: 2026-04-21
**Status**: done
**Closed**: 2026-04-21 (PR #12)

## Summary

Two frontend code paths call `get_subscriber_feed(token)` solely to extract
`subscriber.email` from the response:

- `src/app/components/Feed.tsx` — for the avatar initial (PR #9).
- `src/app/components/ArticleDetail.tsx` — for the Ask-AI click-intent log
  (PR #12, after the P3 Grok deep-link work).

`get_subscriber_feed` returns a full JSONB payload: subscriber fields plus
topics plus up to N normalized articles. Current callers pass `p_limit: 1`
as a mitigation, but the RPC still runs the feed-ranking + article-assembly
SQL server-side — wasted work for a call that only wants the email.

Both `getSubscriberFeed` consumers also inherit two `console.log` raw-
article dumps inside `getSubscriberFeed()` that were added for debugging
and never cleaned up, which compounds the problem: every article-detail
page load for a subscriber now dumps article JSON to the console.

## Target

New RPC: `get_subscriber_by_token(p_token text) → { email, frequency, timezone, topics[] }`

- Returns subscriber fields + topic display names only — no articles.
- O(1) lookup on `digest_subscribers.feed_token` + single left-join to
  `user_interests → topics`.
- Replaces both call-sites.

Also at the same time: delete the two `console.log` dumps in
`getSubscriberFeed` — they belong to the 2026-04 debug era and there's no
reason they're still shipping.

## Scope

- Supabase migration creating `get_subscriber_by_token` (SECURITY DEFINER,
  same auth posture as `get_subscriber_feed`).
- `src/app/utils/supabase.ts` — new `getSubscriberByToken(token)` fn.
- Migrate `Feed.tsx` and `ArticleDetail.tsx` to call the new fn.
- Remove the `p_limit: 1` mitigation from `ArticleDetail.tsx`.
- Remove the two `console.log` dumps from `getSubscriberFeed`.
- Document in `docs/supabase-rpc.md`.

## Out of scope

- Caching subscriber lookups across components. If it becomes an issue,
  file a separate ticket.

## Acceptance

- Both consumers pull email via the new lean RPC.
- No `console.log` noise on article-detail page load for subscribers.
- `npm test`, `npm run build`, `npm run smoke` all green.

## Priority

P4 — internal consistency, page-load hygiene, and a prerequisite for
cleaner telemetry. Not user-visible.

## Progress log

- **2026-04-21** — Filed during the PR #12 review cycle after the
  reviewer flagged `getSubscriberFeed`-overfetch on every article-detail
  page load. Initially deferred to a follow-up PR for scope reasons.
- **2026-04-21** — Pulled into PR #12 in-session when the user pushed
  back on the deferral. Completed.
  - Migration `20260421010000_add_get_subscriber_by_token_rpc.sql`
    applied (`CREATE OR REPLACE FUNCTION`, additive; grants EXECUTE to
    anon + authenticated matching `get_subscriber_feed`'s posture).
  - `getSubscriberByToken(token)` + `SubscriberInfo` type added to
    `src/app/utils/supabase.ts`.
  - `Feed.tsx` and `ArticleDetail.tsx` migrated off `getSubscriberFeed`
    for the subscriber-identity lookup. `useUserFeed` still calls
    `getSubscriberFeed` for actual article loading — that's correct.
  - Three debug `console.log` dumps deleted from `getSubscriberFeed` —
    they were leaking raw article JSON on every page load since PR #9.
  - `Feed.test.tsx` updated: regression guard now asserts topics
    resolve via `getSubscriberByToken` (not `getSubscriberFeed`) when
    feed_token is present.
  - `docs/supabase-rpc.md` updated with the new RPC's contract.
  - `npm test` 82/82, `npm run build` clean, `npm run smoke` 10/10.
