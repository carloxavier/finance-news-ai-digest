# The Article Lifecycle

Every row in `ai_articles` has a `processing_status` that determines where it appears in the product. This is the single most important concept in the data model — most visibility bugs come from misunderstanding these states.

## States

| Status | Visible in feeds? | Meaning |
|--------|-------------------|---------|
| `pending` | No | Row exists but hasn't been processed yet. Reserved for a future automated pipeline; not used in manual seeds. |
| `brief_done` | No | Intermediate state reserved for a future automated pipeline. Not used in manual seeds. |
| `complete` | **Yes** | Article has full content (`brief_bullets`, `citations`, etc.) and is shown to users. The only state RPCs expose. |
| `archived` | No | Article is hidden from all user-facing surfaces but preserved in the database. Used for aged-out content (>30 days) and for content-quality archives (e.g., the April 2026 bulk archive). Restorable in place via UPDATE. |
| `failed` | No | A processing pipeline hit an error. `processing_error` column should describe what went wrong. |

## "Visible" is enforced at the RPC layer, not the row layer

Visibility is not a column on the row — it's the combination of `processing_status = 'complete'` AND the 30-day recency filter, applied by every RPC that serves user-facing content. Direct `SELECT FROM ai_articles` queries do NOT apply these filters. Always use the RPCs for anything a user will see.

See the [Feed RPCs](#feed-rpcs) section for the four RPCs and how they differ.

## Transitions

```
                          manual seeding (via the seeder skill)
                                      │
                                      v
                              ┌──── complete ────┐
                              │                  │
  archive_stale_articles(30)  │                  │  (future: automated pipeline)
  (daily cron @ 03:00 UTC)    v                  v
                          archived            failed
                              │
                              │  manual restore (UPDATE back to 'complete')
                              │  see seeder skill: "Reseeding / unarchiving" section
                              v
                            complete
```

Active transitions today:
1. **Seeding** — a new row enters as `complete` via the `finance-ai-digest-seeder` skill.
2. **Auto-archive** — the `archive_stale_articles(30)` cron flips `complete → archived` for any article older than 30 days.

Manual transitions used during operational work:
- **Bulk-archive** — `UPDATE ai_articles SET processing_status='archived' WHERE processing_status='complete'`. Used in April 2026 content-quality pass; mass-hides articles before a schema migration or content pivot.
- **Restore** — `UPDATE ai_articles SET processing_status='complete', brief_bullets=..., ... WHERE id=$1` — used when bringing an archived article back under updated rules.

## Cache invalidation after state changes

The `topic_feeds` and `user_feed_cache` tables both cache article-ID arrays. Any UPDATE that changes which articles are `complete` must be followed by:

```sql
SELECT rebuild_topic_feed(at.topic_id)
FROM article_topics at
WHERE at.article_id = $your_article_id;

UPDATE user_feed_cache SET is_valid = false;
```

The `archive_stale_articles` RPC already handles both internally; manual UPDATEs must do this themselves.

---

# Feed RPCs

Four RPCs surface `ai_articles` to users. All four filter on `processing_status = 'complete'` AND `published_at > now() - interval '30 days'`.

> **Intended end state: two feed RPCs.** The current four-RPC design is unintentional accrual, not deliberate. See [P4 — Consolidate feed RPCs from four to two](../backlog/P4-consolidate-feed-rpcs.md). This section documents both the current state and the target shape so that anyone touching feed code understands the direction of travel.

## Target state (two RPCs)

- **`get_subscriber_feed(p_token, p_limit)`** — the canonical authenticated/personalized feed. Any surface that serves a known user (web via `?t=TOKEN` link, email digest, the main web app) uses this.
- **`get_public_feed(p_topic_slug, p_limit)`** — the canonical unauthenticated feed. Any surface for a visitor without a subscription (landing page, `/explore`, fallback for direct-site-visitors without a token) uses this. Optional topic filter.

Both return the same response shape. The `user_feed_cache` table stays — caching moves to `get_subscriber_feed` as part of the consolidation.

**Identity decision**: direct-site visitors who haven't subscribed fall through to `get_public_feed`. There is no anonymous-token pattern. You either have a subscriber token (personalized) or you don't (public).

## Current state (four RPCs)

### `get_user_feed(p_user_id uuid, p_limit int) → TABLE(article_id uuid)` *(to be removed)*
- **Consumed by**: `Feed.tsx` via `useUserFeed`, when the user has no `feed_token`.
- **Identity**: anonymous local-storage user ID (this is the part that shouldn't exist — subscribers should always use tokens; direct visitors should get the public feed).
- **Personalization**: reads `user_interests` for `p_user_id`; falls back to latest-across-all if none.
- **Ranking**: `is_primary DESC, relevance DESC, published_at DESC`.
- **Output**: article IDs only (the caller does a second query to fetch hydrated rows). The two-hop pattern doesn't match the other RPCs.
- **Caches**: writes to `user_feed_cache`. **This caching behavior should migrate to `get_subscriber_feed` during consolidation**; the cache table itself stays.

### `get_subscriber_feed(p_token text, p_limit int) → jsonb` *(canonical — survives consolidation)*
- **Consumed by**: `Feed.tsx` when a `feed_token` is present, and `send-digest` for email delivery.
- **Identity**: resolves token to `digest_subscribers.user_id`.
- **Personalization**: reads `user_interests` via the resolved user_id; falls back to top articles across all topics when the subscriber has no interests.
- **Ranking**: `published_at DESC` only (should be relevance-weighted — this alignment is rolled into the broader consolidation ticket).
- **Output**: jsonb `{subscriber, topics, articles}`.
- **Caches**: none today (should cache via `user_feed_cache` after consolidation).

### `get_general_feed(p_limit int) → jsonb` *(to be merged into `get_public_feed`)*
- **Consumed by**: `/explore` page.
- No personalization, no auth, flat latest-across-all.
- Functionally identical to `get_public_feed(NULL, p_limit)` in the target state.

### `get_public_preview(p_topic_slug text) → jsonb` *(to be merged into `get_public_feed`)*
- **Consumed by**: the landing page's topic preview cards.
- Filters to a single topic's `topic_feeds.article_ids` when slug given.
- Hardcoded `LIMIT 5` (ignores a `p_limit` parameter — there isn't one).
- Functionally identical to `get_public_feed(p_topic_slug, 5)` in the target state.

## Guidance while four RPCs still exist

If you are adding a new consumer before the P4 consolidation lands, use `get_subscriber_feed` for anything authenticated and `get_general_feed`/`get_public_preview` for anything unauthenticated — avoid adding new callers to `get_user_feed`. This minimizes the rewiring surface when consolidation happens.
