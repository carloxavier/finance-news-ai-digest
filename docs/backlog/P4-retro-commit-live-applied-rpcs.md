# P4 — Retroactively commit all live-applied Supabase RPCs to migrations

**Filed**: 2026-04-21
**Status**: open

## Summary

The Supabase project currently has nine user-defined functions in the
`public` schema; only one (`get_subscriber_by_token`, added in PR #12)
has its SQL committed to the repo. The other eight were applied live and
their DDL exists only as Supabase project state:

- `archive_stale_articles(p_max_age_days integer)` — `INVOKER`, `plpgsql`
- `get_digest_recipients(target_hour integer)` — `DEFINER`, `plpgsql`
- `get_general_feed(p_limit integer)` — `DEFINER`, `plpgsql`
- `get_public_preview(p_topic_slug text)` — `DEFINER`, `plpgsql`
- `get_subscriber_feed(p_token text, p_limit integer)` — `DEFINER`, `plpgsql`
- `get_user_feed(p_user_id uuid, p_limit integer)` — `INVOKER`, `plpgsql`
- `invalidate_stale_user_caches()` — `INVOKER`, `plpgsql`
- `rebuild_topic_feed(p_topic_id uuid)` — `INVOKER`, `plpgsql`

Plus: pg_cron schedules (at minimum `archive-digest-sent` + the hourly
`send-digest` trigger), RLS policies, and any triggers associated with
the above. None of these are in the repo either.

## Why this matters

1. **Schema history is unrebuildable.** A fresh Supabase project from
   this repo alone would have tables + `get_subscriber_by_token` and
   nothing else. Every other RPC breaks.
2. **No review for the auth posture of eight RPCs.** Five are
   `SECURITY DEFINER` (including `get_subscriber_feed` and
   `get_digest_recipients` which are granted to `anon`). Nobody on the
   team has eyeballed their SQL in a PR review context.
3. **Drift risk.** Someone can tweak `get_subscriber_feed` live via
   Supabase Studio and nothing in git will catch it.

This was flagged during the PR #12 round-2 review (N2) but was too big
to pull into that PR — proper review of eight function bodies is its
own work.

## Scope

1. For each of the eight functions, query `pg_get_functiondef(oid)` and
   capture the authoritative DDL.
2. Sanity-read each. Flag any surprises (unused params, dead branches,
   unexpected grants, unsafe `search_path`, missing `STABLE`/`IMMUTABLE`,
   etc.).
3. Write one migration per function with a timestamp that predates the
   current state (e.g. `20260101000000_baseline_rpcs.sql` or individual
   files by observed-creation-date).
4. Also capture: pg_cron jobs (query `cron.job`), RLS policies (query
   `pg_policies`), triggers (query `pg_trigger`).
5. For each new migration: verify that re-running it is a no-op against
   the live DB (idempotent DDL via `CREATE OR REPLACE` / `CREATE IF NOT
   EXISTS`).
6. Document in `docs/supabase-rpc.md` any RPC whose behavior was opaque
   until this capture.

## Approach

Do this in a single dedicated PR. One file per function keeps review
tractable (eight diffs of ~50 lines each vs one diff of 400 lines). CI
shouldn't apply these migrations — they're retroactive capture, the
functions are already live.

Consider adding a CI lint (or a `supabase db diff` step) that fails when
Supabase state diverges from the repo, so this drift doesn't rebuild.

## Out of scope

- Refactoring any RPC during capture. This is archaeology, not
  redesign. File a follow-up if you spot real bugs.
- The `supabase db pull` / `supabase migration repair` CLI workflow as
  an alternative approach — worth exploring but orthogonal to having
  the content in the repo.

## Acceptance

- All eight live RPCs have committed migration SQL.
- pg_cron jobs, RLS policies, and triggers captured.
- `supabase/migrations/` alone, applied to a fresh DB, reproduces the
  current schema + function surface.
- `docs/supabase-rpc.md` updated where behavior was previously opaque.

## Priority

P4 — nothing is broken today, but the longer we wait, the more
functions accumulate and the bigger the archaeology job gets. File now,
do within the next few weeks before the next round of schema churn.
