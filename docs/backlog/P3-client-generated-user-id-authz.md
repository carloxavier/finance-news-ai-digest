# P3 — Client-generated user_id is an authZ bypass

**Filed**: 2026-04-18
**Status**: open

## Summary

`user_id` is generated client-side via `crypto.randomUUID()` in
`src/app/utils/userId.ts` and persisted to localStorage. The Supabase
RLS policies on `user_interests`, `user_tickers`, and
`digest_subscribers` trust whatever `user_id` the client presents.

Any client can therefore read, write, or delete another user's
interests/tickers/subscription by presenting that user's UUID. UUIDs
are not secrets in this architecture — they appear in request bodies,
network logs, and (through error surfacing) occasionally in logs.

## Impact

- **Privacy**: a bad actor with a known user_id can enumerate that
  user's tracked tickers and topics.
- **Integrity**: they can delete the user's preferences or subscribe
  them to arbitrary topic sets.
- **Not exploitable at scale today** because user_ids aren't publicly
  exposed anywhere. But "not currently exposed" is not the same as
  "secure"; any future feature that displays user_id (e.g. share
  links, referral codes) turns this into an incident.

## Proposed direction

Two realistic options:

1. **Lightweight token pattern.** Server issues an opaque session
   token on first signup, stored as httpOnly cookie. RLS policies
   validate the token → user_id mapping in Postgres rather than
   trusting client input. No signup flow changes.
2. **Supabase Auth anonymous sign-in.** Promotes client UUIDs to
   real Supabase JWTs. More invasive but positions us for a future
   authenticated flow.

Recommend option 1 for now — minimal surface change, fully closes the
bypass, doesn't introduce auth UX.

## Acceptance

- `user_id` cannot be spoofed from the client.
- RLS policies on `user_interests`, `user_tickers`,
  `digest_subscribers` verify server-issued identity.
- Existing subscribers migrate seamlessly (no mass re-signup).
- Security note in `docs/architecture.md` updated.
- `docs/backlog/P5-secure-welcome-and-signup-rate-limiting.md`
  reviewed for overlap; bundle fix if cheap, split if not.

## Priority

P3 — should be fixed before any public marketing push. Not blocking
current tester cohort (trust within known group).
