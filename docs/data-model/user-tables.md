# User & Subscriber Tables

Five tables capture user identity, preferences, and feed personalization.

> **Identity model has known security issues.** User identity today is established client-side via `crypto.randomUUID()` in `src/app/utils/userId.ts` and stored in localStorage; the server trusts whatever `user_id` the client sends without validation. This is an authZ bypass — see [P3 — Client-generated user_id is an authZ bypass](../backlog/P3-client-generated-user-id-authz.md). The column descriptions below document what the fields mean today; they do NOT imply the current identity mechanism is correct.

## `digest_subscribers`

The canonical subscriber record. One row per email address that has completed subscription. Source of truth for the `feed_token`, which is the only server-validated identity currently in use.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | Mirrors the client-generated `user_id` from localStorage. Stuffed into this column at signup so pre-subscription `user_interests` carry over. (Target state: server-managed; see P3.) |
| `email` | text | NO | — | Delivery address. |
| `frequency` | text | NO | `'daily'` | `'daily'` or `'weekly'`. See [enums](./references.md#digest_subscribersfrequency). |
| `is_active` | boolean | YES | `true` | When false, no digests are sent. Set by the unsubscribe flow. |
| `subscribed_at` | timestamptz | YES | `now()` | |
| `last_sent_at` | timestamptz | YES | — | Updated by `send-digest` after each successful delivery. |
| `unsubscribe_token` | text | YES | `gen_random_uuid()::text` | Opaque token used in the unsubscribe link. |
| `feed_token` | text | NO | `encode(gen_random_bytes(18), 'base64')` | Opaque token for authenticated feed access. Sent in digest emails as `?t=TOKEN` on article links. **This is the only server-validated identity in the current system** — see the P3 ticket for why the `user_id` path isn't. |
| `welcome_sent_at` | timestamptz | YES | — | When `send-welcome` successfully delivered. |
| `timezone` | text | YES | `'America/Chicago'` | IANA timezone. The hourly digest cron delivers to each subscriber at 7am local. |
| `signup_source` | text | YES | — | Informational provenance string (e.g. landing page vs. article click vs. explore). See code for current values — treated as free-form. |

## `user_interests`

Many-to-many join between user_ids and topics. The primary personalization signal.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | Client-generated user_id (see P3). Same uuid carries across to the subscriber row after subscription. |
| `topic_id` | uuid | NO | — | FK → `topics.id`. |
| `added_at` | timestamptz | YES | `now()` | |

Read by `get_user_feed` and `get_subscriber_feed` to filter personalized feeds to subscribed topics. Written by the onboarding flow and the settings page.

## `user_tickers`

Tickers the user has marked as interesting.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | Client-generated user_id (see P3). |
| `ticker` | text | NO | — | US-style ticker symbol. |
| `added_at` | timestamptz | YES | `now()` | |

**Today's behavior (partial)**: the table is **only used for email highlighting**, not for feed ranking.

- `send-digest` passes the user's ticker list into the email renderer; articles that mention those tickers get a blue-highlighted ticker chip vs. muted grey for non-tracked tickers. The article set itself is not filtered or ranked by ticker.
- `send-welcome` renders the ticker list as a text string in the welcome email ("Your tickers: AAPL, NVDA, MSFT") — no article interaction.
- The web feed does not use `user_tickers` at all.

**Intended behavior**: tickers should provide a **ranking boost**, not filtering — an article mentioning a tracked ticker ranks higher, but nothing is excluded. See [P4 — Use user_tickers for ranking boost](../backlog/P4-user-tickers-ranking-boost.md).

## `user_feed_cache`

Per-user cache of ranked article IDs, populated by `get_user_feed`. Avoids recomputing the feed on every page load.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | One row per user_id (unique constraint). |
| `article_ids` | uuid[] | NO | `'{}'` | Pre-ranked array of article IDs. |
| `topic_ids` | uuid[] | NO | `'{}'` | The user's topic interests at the time the cache was built. Informational — used for debugging. |
| `built_at` | timestamptz | NO | `now()` | When the cache was last populated. |
| `is_valid` | boolean | NO | `true` | When false, the cache is ignored and recomputed on next read. |

**How invalidation works**: any operation that changes which articles are `complete` (seeding, archiving, restoring, content UPDATEs) must set `is_valid = false` across this table. The `archive_stale_articles` RPC handles this internally; manual SQL must do it explicitly: `UPDATE user_feed_cache SET is_valid = false`.

**Scope for future work**: when the [P4 feed RPC consolidation](../backlog/P4-consolidate-feed-rpcs.md) lands, the caching behavior moves from `get_user_feed` to `get_subscriber_feed`. The `user_feed_cache` table itself stays — only its writer changes.

## `onboarding_survey`

Per-user onboarding responses. **Write-only today** — captured at signup but not yet consumed by any feed, email, or personalization logic.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | Client-generated user_id (see P3). |
| `investing_style` | text | YES | — | `'buy_and_hold'`, `'active_trader'`, `'passive_index'`, or `'beginner'`. See [enums](./references.md#onboarding_surveyinvesting_style). |
| `content_density` | text | YES | — | `'quick_hits'`, `'essentials'`, or `'deep_coverage'`. See [enums](./references.md#onboarding_surveycontent_density). |
| `completed_at` | timestamptz | YES | `now()` | |

No RPC, edge function, or frontend surface currently reads from this table. The intent is eventual personalization of content depth and recommendation tone based on these answers, but the feature hasn't been built.

This is still valuable to collect — these answers will be the highest-quality signal we have when personalization beyond topic filtering gets built. They're also useful for segmentation during the WTP validation experiment (e.g., does the "beginner" segment convert at different rates?).
