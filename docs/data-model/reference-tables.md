# Reference Tables

Two tables exist in the schema but are **not wired into the current system**. They're documented here for completeness and so future work doesn't accidentally rediscover them without context.

## `news_sources`

Intended as a registry of source domains for credibility scoring. Contains 12 manually-seeded rows (Reuters, CNBC, EIA, biopharmadive.com, fiercepharma.com, etc.) tiered as tier1/tier2/blog/unknown.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `domain` | text | NO | — | e.g. `cnbc.com`. |
| `display_name` | text | YES | — | Human label for the source. |
| `tier` | text | YES | — | `'tier1'`, `'tier2'`, `'blog'`, or `'unknown'`. See [enums](./references.md#news_sourcestier). |
| `is_verified` | boolean | YES | `false` | Whether the tier assignment was manually reviewed. |
| `first_seen_at` | timestamptz | YES | `now()` | When the source first appeared (or was seeded). |
| `article_count` | integer | YES | `0` | Running count of articles citing this source. Intended to be incremented by the article pipeline. |
| `notes` | text | YES | — | Free-form editorial notes about the source. |

**Current status: unused.**

- **No writer in the codebase.** Articles don't update `article_count`; new sources don't get auto-inserted.
- **No reader in the codebase.** Nothing queries this table to make decisions about which sources to trust, prioritize, or exclude.
- The 12 existing rows were seeded on 2026-03-11 and haven't been touched since.

**Conceptual relationship to the seeder skill**: the skill currently maintains its own list of restricted source domains (Bloomberg, Reuters, WSJ, Barron's, etc.) as a hardcoded constant. That list could logically live in `news_sources` with a new `is_restricted` column — and then both the seeder skill and future content pipelines would share a single source of truth for source policy. See [P5 — Decide fate of news_sources table](../backlog/P5-decide-fate-of-news-sources.md) for that decision.

## `stats_weekly_snapshots`

Intended as a weekly rollup of product metrics (subscribers, clicks, churn risk, etc.) for historical tracking.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid | PK |
| `week_start` | date | Start of the reporting week |
| `snapshot_taken_at` | timestamptz | When the snapshot was computed |
| `total_subscribers` | integer | — |
| `active_subscribers` | integer | `is_active = true` count |
| `inactive_subscribers` | integer | `is_active = false` count |
| `new_subscribers_this_week` | integer | — |
| `total_clicks_alltime` | integer | — |
| `clicks_this_week` | integer | — |
| `unique_clickers_alltime` | integer | Distinct subscribers who ever clicked |
| `active_clickers_this_week` | integer | Distinct subscribers who clicked this week |
| `unique_articles_clicked_alltime` | integer | — |
| `subscriber_breakdown` | jsonb | Per-segment subscriber details. Default `'[]'`. |
| `churn_risk_count` | integer | Count from the `churn_risk` view |
| `churn_risk_details` | jsonb | Per-at-risk-subscriber details. Default `'[]'`. |
| `subscribers_never_received_digest` | integer | — |
| `subscribers_missing_welcome` | integer | — |

**Current status: empty. No writer exists.**

**Conceptual relationship to the `churn_risk` and `subscriber_retention` views**: those views compute the same kinds of numbers on-demand from live data. `stats_weekly_snapshots` would give historical time-series of those numbers (you can't do week-over-week comparison from a point-in-time view).

The table exists but nothing populates it. Either a scheduled snapshot job needs to be written, or the table should be dropped. See [P5 — Decide fate of stats_weekly_snapshots](../backlog/P5-decide-fate-of-stats-weekly-snapshots.md).
