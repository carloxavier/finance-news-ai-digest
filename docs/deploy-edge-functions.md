# Supabase Edge Function Deployment Guide

## Overview

Edge Functions are deployed via **Supabase MCP** (the `deploy_edge_function` tool). The local files in `supabase/functions/` are the source of truth.

All functions use `verify_jwt=false` (they are public endpoints used in email links and webhooks).

**Supabase Project ID:** `kamfamwjswkncftsdgxi`

**App Base URL:** `https://finnopolis.com`

---

## Functions

### track-click

**File:** `supabase/functions/track-click/index.ts`

**Purpose:** Logs email article clicks and redirects to the app's article detail page with the subscriber's feed token.

**Flow:**
1. Receives `GET ?a=<article_id>&t=<feed_token>`
2. If `a` is present, computes the redirect target: `<APP_BASE_URL>/article/<article_id>?t=<feed_token>` (or without `?t=` when `t` is missing).
3. If `t` is present, looks up `digest_subscribers` by `feed_token` and inserts into `article_clicks` (fire-and-forget). No blocking on the click log.
4. Redirects `302` to the computed target. Falls back to `<APP_BASE_URL>` only when `a` is missing.

**Critical:** `a` is the public article identifier. `t` is the subscriber's `feed_token`. Clicks from unknown/missing tokens still land the user on the article — click logging is best-effort.

### send-digest

**File:** `supabase/functions/send-digest/index.ts`

**Purpose:** Sends personalized email digests. Triggered by pg_cron hourly (each run calls `get_digest_recipients(target_hour)` and only sends to subscribers whose local delivery time matches the current UTC hour). Can also be triggered manually via POST with `{"email": "user@example.com"}` (targets one subscriber regardless of timezone) or `{"target_hour": 7}` (overrides the hour used to pick recipients). See [architecture.md](./architecture.md#digest-delivery-cadence).

**Required secret:** `RESEND_API_KEY`

**Article source:** Uses `get_subscriber_feed` RPC with `p_limit: 8`. This is the same RPC the web feed uses, ensuring email and web show the same articles.

**Email link pattern:**
1. Each article card links to `<SUPABASE_URL>/functions/v1/track-click?a=<article_id>&t=<feed_token>`
2. `digest_sent_articles` is upserted per article with `ignoreDuplicates: false` (still used: keeps `sent_at` / `digest_batch` fresh for the most recent delivery). The row's `click_token` column is left NULL — the column is legacy and will be dropped in a future schema cleanup.

### send-welcome

**File:** `supabase/functions/send-welcome/index.ts`

**Purpose:** Sends a welcome email after a user subscribes to the digest.

### digest-webhook

**File:** `supabase/functions/digest-webhook/index.ts`

**Purpose:** Receives Resend webhook events (delivered, opened, bounced) and records them.

### handle-unsubscribe

**File:** `supabase/functions/handle-unsubscribe/index.ts`

**Purpose:** One-click email unsubscribe. Sets `is_active = false` on the subscriber.

---

## Pre-deploy gate

Before deploying any Edge Function, run:

```bash
./scripts/pre-deploy-check.sh send-digest   # or the function you're about to deploy
```

This runs the tests colocated with that function. Non-zero exit code means DO NOT deploy. The GitHub Actions pipeline will catch anything that slips past, but locally verifying saves a round trip.

If no tests exist for the function (e.g. `handle-unsubscribe` doesn't have a test file), the script prints a warning and exits 0. Add tests for non-trivial Edge Functions as they grow.

---

## Deploying

Deploy via Supabase MCP:

```
mcp deploy_edge_function(
  project_id: "kamfamwjswkncftsdgxi",
  name: "<function-name>",
  entrypoint_path: "index.ts",
  verify_jwt: false,
  files: [{ name: "index.ts", content: "<file contents>" }]
)
```

Or via CLI (requires `supabase login`):

```bash
supabase functions deploy <function-name> --project-ref kamfamwjswkncftsdgxi
```

---

## Testing

Trigger a test digest (no auth needed — `verify_jwt=false`):

```bash
curl -X POST 'https://kamfamwjswkncftsdgxi.supabase.co/functions/v1/send-digest' \
  -H 'Content-Type: application/json' \
  -d '{"email": "carlo.xavier.lopez@gmail.com"}'
```

**Expected response:**
```json
{ "sent": 1, "failed": 0, "skipped": 0, "errors": [], "message": "..." }
```

`skipped` counts subscribers picked up by the recipient query but rejected during per-subscriber checks (e.g. `last_sent_at` within the same day). `message` is a human-readable summary used by manual invocations.

**Validation checklist:**
1. Email received with 8 articles matching the web feed
2. Click an article link — should redirect to `<APP_BASE_URL>/article/<id>?t=<feed_token>`
3. Article detail page loads (not onboarding)
4. "Back to Feed" shows the personalized feed
5. "View Full Feed" link in email goes to the web feed with the feed token

---

## Common Pitfalls

| Pitfall | What goes wrong | Prevention |
|---------|----------------|------------|
| `ignoreDuplicates: true` on upsert | `sent_at` / `digest_batch` on `digest_sent_articles` would stay stale on re-sends, hiding the latest delivery from history | Always use `ignoreDuplicates: false` |
| Email URL missing `?a=<article_id>` | track-click has no destination and redirects to the home page | `send-digest` must embed `a=<article.id>` on every link |
| Using `get_user_feed` for digest | Different ranking + stale cache → email articles don't match web | Always use `get_subscriber_feed` for digest |
| Drifted `SITE_BASE_URL` between functions | `send-digest`, `send-welcome`, and `track-click` each hardcode the base URL; if one is updated and the others aren't, links break across surfaces | Keep the three `SITE_BASE_URL`/`FALLBACK_URL` constants aligned, or promote the value to a Supabase secret |
| `DISTINCT ON` with wrong `ORDER BY` | `LIMIT` applied before date sort → misses newest articles | Deduplicate with subquery, then sort by date, then limit |
