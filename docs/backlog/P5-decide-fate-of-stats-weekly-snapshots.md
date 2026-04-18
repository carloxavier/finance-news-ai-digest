# P5 — Decide fate of stats_weekly_snapshots table

**Filed**: 2026-04-18
**Status**: open

## Summary

The `stats_weekly_snapshots` table exists in the schema with 17 columns (total_subscribers, active_subscribers, clicks_this_week, churn_risk_count, jsonb breakdowns, etc.) but **has zero rows and no writer**. It was designed for weekly historical rollups but the snapshot-computation job was never built.

Decision needed: either implement the snapshotting or drop the table.

## Options

### Option A: Build the weekly snapshot job

Add a new cron job that runs weekly (e.g., Sunday @ 23:00 UTC) and computes one row's worth of metrics:

```sql
SELECT cron.schedule(
  'compute-weekly-stats',
  '0 23 * * 0',
  $$INSERT INTO stats_weekly_snapshots (
    week_start, total_subscribers, active_subscribers, inactive_subscribers,
    new_subscribers_this_week, total_clicks_alltime, clicks_this_week,
    unique_clickers_alltime, active_clickers_this_week,
    unique_articles_clicked_alltime, churn_risk_count, churn_risk_details,
    subscribers_never_received_digest, subscribers_missing_welcome,
    subscriber_breakdown
  )
  SELECT ...$$
);
```

The SQL for each column would draw from `digest_subscribers`, `article_clicks`, `email_events`, and the `churn_risk` view.

**Benefit**: real historical time-series for product health. Week-over-week comparison becomes possible (views can't do this since they only reflect current state).

**Cost**: a non-trivial SQL query to write and test. Will drift if table structure changes in either direction.

### Option B: Drop the table

Historical reporting can wait until the product has enough subscribers for weekly rollups to be meaningful. With ~14 subscribers, weekly variance is dominated by noise.

```sql
DROP TABLE stats_weekly_snapshots;
```

When historical reporting becomes valuable, rebuild from scratch (data loss is fine — there are no rows to preserve anyway).

**Benefit**: less unused schema.

**Cost**: will need to be rebuilt eventually, and the original schema design intent is lost.

## Recommendation

**Option B for now, revisit at ~500 subscribers.** Below that scale, weekly rollups don't tell you anything the live views don't already show. At ~500+ subscribers and multiple months of history, the week-over-week signal becomes statistically useful and worth building.

## Priority justification

P5. Zero product impact. Worth deciding explicitly so the table doesn't sit in schema limbo forever.

## Acceptance

- Decision made (Option A or B) and documented here as a `## Decision` section.
- If A: cron job shipped, first snapshot row verified after a week's run, `docs/architecture.md` cron section updated.
- If B: `DROP TABLE stats_weekly_snapshots;` migration shipped, [`docs/data-model/reference-tables.md`](../data-model/reference-tables.md) updated to remove the section.
