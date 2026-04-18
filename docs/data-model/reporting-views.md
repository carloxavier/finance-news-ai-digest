# Reporting Views

Four Postgres views expose pre-computed analytics over the base tables. They are read-only (you cannot INSERT/UPDATE against them) and always reflect current data — no caching. All four are used for ad-hoc inspection today; none are consumed by a frontend surface.

## `article_engagement`

Per-article send and click counts, with computed CTR.

| Column | Derived from |
|---|---|
| `article_id` | `ai_articles.id` |
| `headline` | `ai_articles.headline` |
| `published_at` | `ai_articles.published_at` |
| `times_sent` | `COUNT(DISTINCT digest_sent_articles.id)` |
| `times_clicked` | `COUNT(DISTINCT article_clicks.id)` where `article_clicks.subscriber_id = digest_sent_articles.subscriber_id` |
| `ctr_pct` | `100 * times_clicked / times_sent`, rounded to 1 decimal. Zero when `times_sent = 0`. |

**Click attribution scope**: an article_click only counts toward `times_clicked` if the click matches a subscriber who also received this article in a digest. Direct web clicks (which don't exist yet anyway, see the `source` enum note on `article_clicks` in [engagement-tables.md](./engagement-tables.md)) would NOT increment this counter.

Useful for spotting which headlines resonate and which topics keep driving clicks.

## `churn_risk`

Active subscribers whose last email-open was >14 days ago (or who have never opened any email). Ordered by `days_since_last_open DESC` (most disengaged first).

| Column | Derived from |
|---|---|
| `subscriber_id` | `digest_subscribers.id` |
| `email` | `digest_subscribers.email` |
| `subscribed_at` | `digest_subscribers.subscribed_at` |
| `last_sent_at` | `digest_subscribers.last_sent_at` |
| `last_open_at` | `max(email_events.occurred_at)` where `event_type = 'opened'`. NULL if the subscriber has never opened. |
| `days_since_last_open` | `EXTRACT(day FROM (now() - last_open_at))`. NULL when last_open_at is NULL. |

**Only includes `is_active = true` subscribers** — unsubscribed users are already lost and don't need a churn-risk designation.

**Known false positive**: a subscriber who signed up less than 14 days ago and hasn't yet had time to open an email appears in this view. When using it to prioritize retention outreach, filter by `subscribed_at < now() - interval '14 days'` to avoid chasing subscribers who haven't had a real chance to engage.

## `subscriber_retention`

Weekly cohort retention table — for each signup week, how many subscribers opened an email in the last 7/14/30 days.

| Column | Derived from |
|---|---|
| `cohort_week` | `date_trunc('week', digest_subscribers.subscribed_at)` |
| `cohort_size` | `COUNT(DISTINCT subscriber_id)` for that cohort |
| `active_7d` | Distinct subscribers who opened in the last 7 days |
| `active_14d` | Same, last 14 days |
| `active_30d` | Same, last 30 days |
| `retention_7d_pct` | `100 * active_7d / cohort_size`, rounded to 1 decimal |
| `retention_14d_pct` | Same, 14-day window |

**Only includes `is_active = true`**, so the cohort numerator and denominator both exclude unsubscribed users. That's a design choice that makes "retention" mean "of still-active subscribers, who is opening" — it does not capture churn from unsubscribes. Keep that in mind when interpreting: a cohort with 10 original signups and 3 unsubscribes will show `cohort_size = 7`, not 10.

## `topic_engagement`

Per-topic send and click counts, ordered by CTR descending.

| Column | Derived from |
|---|---|
| `slug` | `topics.slug` |
| `display_name` | `topics.display_name` |
| `times_sent` | Distinct digest_sent_articles rows across all articles tagged with this topic |
| `times_clicked` | Distinct article_clicks rows, same join conditions as `article_engagement` |
| `ctr_pct` | Same computation |

**Articles with multiple topic tags count toward each topic separately**, so `sum(times_sent)` across all topics in this view will be higher than the total digest_sent_articles row count. This is a feature for comparing topics, but means the view is not a partition of the sends.
