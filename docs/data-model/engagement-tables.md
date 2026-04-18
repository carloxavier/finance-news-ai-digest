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

**How rows are written**: exclusively by the `track-click` edge function. That function takes a `click_token` (embedded in email links), looks up the corresponding `digest_sent_articles` row, and inserts an `article_clicks` row with `source='email'` hardcoded, then 302-redirects the user to the article detail page.

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
| `click_token` | text | YES | — | Opaque per-article token. Each article link in the email encodes this token; `track-click` resolves it back to the (subscriber, article) pair. |

**Unique constraint**: `(subscriber_id, article_id)` — a given subscriber should not receive the same article twice. `send-digest` uses `upsert` with `onConflict="subscriber_id,article_id"` to enforce this even across retries.

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

Signups for the eventual "AI agent" upsell feature. Users click a CTA on the article detail page to join; their intent is recorded here.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | Client-generated user_id (see [P3](../backlog/P3-client-generated-user-id-authz.md)). |
| `email` | text | YES | — | Optional — populated if the user provides one via the waitlist form. |
| `article_id` | uuid | YES | — | FK → `ai_articles.id`. **NO ACTION** on delete. The article that triggered the signup is informational context; the user's waitlist intent survives the article being archived or deleted. |
| `signed_up_at` | timestamptz | YES | `now()` | |

**Why `NO ACTION` on the article FK**: the user's intent to access the AI agent is independent of the specific article they happened to be reading when they joined the waitlist. Cascading the article delete would discard real user signal. The article_id is retained as historical context — "which story motivated this signup" — and the column goes stale (FK becomes a dangling reference) if the article is ever hard-deleted. This is intentional.

**Written by**: `joinAiAgentWaitlist` in `src/app/utils/supabase.ts`, called from the article detail page's CTA.
**Read by**: the waitlist status check on the same page (`checkWaitlistStatus`) to avoid showing the CTA twice to users who have already joined.
