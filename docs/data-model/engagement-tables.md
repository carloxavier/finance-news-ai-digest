# Engagement & Telemetry Tables

Four tables capture how users interact with articles and emails. Each has a clear writer and a clear consumer.

## `article_clicks`

Every click on an article link gets a row.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `subscriber_id` | uuid | NO | — | FK → `digest_subscribers.id`. **CASCADE** on delete — clicks are meaningless without the subscriber. |
| `article_id` | uuid | NO | — | FK → `ai_articles.id`. **CASCADE** on delete. |
| `clicked_at` | timestamptz | NO | `now()` | |
| `source` | text | NO | `'email'` | Enum: `'email'`, `'web'`, `'push'`. See note below. |
| `sent_article_id` | uuid | YES | — | FK → `digest_sent_articles.id`. **SET NULL** on delete (historical clicks survive digest-record pruning). Populated when the click came through the email-click-tracking flow; NULL for direct-web clicks. |

**How rows are written**: exclusively by the `track-click` edge function. That function receives `?a=<article_id>&t=<feed_token>` in the URL, identifies the subscriber by looking up `digest_subscribers.feed_token`, attaches the most recent `digest_sent_articles.id` for the (subscriber, article) pair as `sent_article_id` (or NULL if no matching row), and inserts an `article_clicks` row with `source='email'` hardcoded — all fire-and-forget — then 302-redirects the user to `/article/<article_id>?t=<feed_token>`.

**`source` enum reality**: `'web'` and `'push'` are allowed by the CHECK constraint but **no code writes them today**. Web-side click tracking hasn't been built (no instrumentation on in-app article navigation), and there's no push-notification infrastructure. If `source` values other than `'email'` appear in production, something has changed that should be documented here.

## `digest_sent_articles`

One row per (subscriber, article) pair included in a digest email. The authoritative record of "what was emailed to whom."

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `subscriber_id` | uuid | NO | — | FK → `digest_subscribers.id`. **CASCADE** on delete. |
| `article_id` | uuid | NO | — | FK → `ai_articles.id`. **CASCADE** on delete. |
| `sent_at` | timestamptz | NO | `now()` | |
| `digest_batch` | text | YES | — | Identifier for the delivery batch this article was part of (e.g., a timestamp or job ID). Used to group "all articles sent to all subscribers in this run." |
| `click_token` | text | YES | — | **Legacy / dead column.** Was an opaque per-(subscriber × article) rotating token embedded in email links until April 2026, when the token model was dropped in favor of `?a=<article_id>&t=<feed_token>`. Not populated by current code; left in place until a future schema cleanup pass drops the column. See [P3 — simplify email-link tokens](../backlog/done/P3-simplify-email-link-tokens.md). |

**Unique constraint**: `(subscriber_id, article_id)` — a given subscriber should not receive the same article twice. `send-digest` uses `upsert` with `onConflict="subscriber_id,article_id"` and `ignoreDuplicates: false` so re-sends keep `sent_at` and `digest_batch` reflecting the most recent delivery.

**Cleanup**: the `archive-digest-sent` cron job (daily @ 04:00 UTC) hard-deletes rows older than 90 days. Despite its name, this is a DELETE, not an archive (no archive table exists for this data) — see [P5 — Rename misleading cron job archive-digest-sent](../backlog/P5-rename-archive-digest-sent-cron.md). Historical clicks are preserved via the `SET NULL` rule on `article_clicks.sent_article_id` — deleting a digest-sent record does not orphan the clicks.

## `email_events`

Webhook events from Resend (the transactional email provider). Records delivery, open, bounce, and complaint events at the per-email level.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `subscriber_id` | uuid | YES | — | FK → `digest_subscribers.id`. **CASCADE** on delete. Nullable because some event types can arrive before subscriber lookup succeeds (rare). |
| `digest_batch` | text | YES | — | Same batch identifier as `digest_sent_articles.digest_batch`, so events can be correlated to a specific delivery run. |
| `event_type` | text | NO | — | Enum: `'delivered'`, `'opened'`, `'bounced'`, `'complained'`. See [enums](./references.md#email_eventsevent_type). |
| `occurred_at` | timestamptz | NO | `now()` | |
| `raw_payload` | jsonb | YES | — | The full Resend webhook payload. Kept for debugging and for event types we don't yet have columns for. |

**How rows are written**: by the `digest-webhook` edge function, which receives webhook POSTs from Resend and inserts a row per event.

**Consumer**: the `churn_risk` and `subscriber_retention` views (see [reporting-views.md](./reporting-views.md)) read `last_open_at` behavior out of this table to identify disengaged subscribers.

## `ai_agent_waitlist`

Originally a beta-waitlist capture for a hypothetical in-product "AI agent" feature. On **2026-04-21** the "Ask AI about this article" button was repurposed to deep-link into [Grok](https://grok.com) with the article's content preloaded. The table stays, with an added column, and now serves a dual purpose:

- **Click-intent events** (new, majority of new rows): one row per click on the Ask-AI CTA, recording which provider was used.
- **Legacy beta-waitlist rows** (historical): pre-2026-04-21 rows where users opted into a beta that never shipped. Distinguishable by `ai_provider IS NULL`.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | Client-generated user_id (see [P3](../backlog/P3-client-generated-user-id-authz.md)). |
| `email` | text | YES | — | Optional. For known subscribers (feed_token present or user_id-matched digest_subscriber row), populated automatically at click time. For anonymous visitors, populated if they provide one in the interstitial modal. |
| `article_id` | uuid | YES | — | FK → `ai_articles.id`. **NO ACTION** on delete. The article context is informational; the user's intent survives the article being archived or deleted. |
| `signed_up_at` | timestamptz | YES | `now()` | Kept for legacy naming; effectively the click timestamp on new rows. |
| `ai_provider` | text | YES | — | Provider the user was sent to: `'grok'` today; future values may include `'gemini'`, `'chatgpt'`, `'claude'`. `NULL` on legacy beta-waitlist rows. Added 2026-04-21. |

**Why `NO ACTION` on the article FK**: the user's intent to understand this story is independent of the article's later lifecycle. Cascading the article delete would discard real user signal. The article_id is retained as historical context and goes stale (FK becomes a dangling reference) if the article is ever hard-deleted. Intentional.

**No dedupe**: the API inserts one row per click. Multiple clicks on the same article by the same user = multiple rows. The behavioural signal is strongest at per-click granularity and "same user asked again" is information we want to keep.

**Written by**: `logAiClickIntent` in `src/app/utils/supabase.ts`, called from the article detail page's Ask-AI button (fire-and-forget — a log failure never blocks the user's redirect to the AI).

**Read by**: no frontend consumer today. Analytics only.

**Eventual cleanup**: the table name still says "waitlist" while the content is mostly click events. If the mismatch becomes a read-path confusion source, split: new `ai_click_intents` table for the click events, keep `ai_agent_waitlist` for any future actual waitlist. For now we tolerate the overload — schema churn costs more than the ambiguity.
