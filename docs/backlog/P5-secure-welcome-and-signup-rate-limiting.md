# P5 — Secure welcome email and signup rate limiting

**Filed**: 2026-04-10 (migrated from Notion 2026-04-18)
**Status**: open

## Summary

Two current exposures:

1. The `send-welcome` edge function is deployed with
   `verify_jwt=false` and the anon key can INSERT into
   `digest_subscribers`. A bad actor could POST thousands of
   signups with throwaway emails, each triggering a welcome email
   and burning the Resend quota (100 emails/day on current plan).
2. The `digest_subscribers` INSERT RLS policy is fully open.

## Proposed design

- Move welcome email trigger to a Postgres `AFTER INSERT` trigger
  using `pg_net` and Supabase Vault for the service role key.
- Add a `signup_attempts` table recording attempts per
  `user_id` with timestamps.
- Rate limit: 5 signups per `user_id` per hour.
- Make `send-welcome` internal-only (no public HTTP route).

## Blockers before execution

- P3-client-generated-user-id-authz fix should land first,
  since this design assumes server-validated `user_id`.

## Acceptance

- Welcome email trigger is internal-only.
- Rate limiting enforced in Postgres.
- Service role key in Vault, not env.

## Priority

P5 — not urgent at current subscriber volume. Escalate to P3 if
we observe signup spam or hit Resend quota.
