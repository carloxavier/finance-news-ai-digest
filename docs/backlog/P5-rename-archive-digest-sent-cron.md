# P5 — Rename misleading cron job `archive-digest-sent`

**Filed**: 2026-04-18
**Status**: open

## Summary

The cron job `archive-digest-sent` (runs daily @ 04:00 UTC) is named misleadingly. Despite the "archive" verb, it performs a hard `DELETE FROM digest_sent_articles WHERE sent_at < now() - interval '90 days'`. There is no archive table for this data.

The name implies data is preserved somewhere; it is not. Anyone reading `SELECT jobname FROM cron.job` would reasonably infer we retain 90+ day delivery history in an archive. We don't.

## Fix

Rename to `delete-old-digest-sent-records` or `prune-digest-sent`:

```sql
SELECT cron.unschedule('archive-digest-sent');
SELECT cron.schedule(
  'prune-digest-sent',
  '0 4 * * *',
  $$DELETE FROM digest_sent_articles WHERE sent_at < now() - interval '90 days'$$
);
```

## Priority justification

Trivial cosmetic. P5 because the cognitive cost compounds — every future reader of cron config has to think through what "archive" means here. Fix when touching cron config for any reason.

## Acceptance

- Cron job renamed.
- `docs/architecture.md` cron section (once it exists) documents the new name.
- [`docs/data-model/`](../data-model/README.md) reference to this cron updated.
