# Architecture Overview

## Deployment

- **Frontend**: Vite + React + TypeScript, deployed at `https://finnopolis.com`
- **Backend**: Supabase (Postgres, Edge Functions, pg_cron)
- **Email**: Resend API (transactional email delivery)
- **Project ID**: `kamfamwjswkncftsdgxi`

## System Diagram

```
                        ┌─────────────────────────────────┐
                        │         Email Digest             │
                        │  (article links use track-click) │
                        └──────────┬──────────────────────┘
                                   │ click
                                   v
                        ┌──────────────────────┐
                        │  track-click (Edge)   │
                        │  ?a=<article_id>       │
                        │  &t=<feed_token>       │
                        │  - logs click (async)  │
                        │  - 302 redirect to     │
                        │    /article/<a>?t=<t>  │
                        └──────────┬─────────────┘
                                   │
                          /article/:id?t=TOKEN
                          ArticleDetail.tsx
                                   │
                                   │  stores feed_token
                                   │  + marks onboarding complete
                                   v
                                /feed
                               Feed.tsx
                                   │
                           getFeedToken()
                                   │
                                   v
                          getSubscriberFeed()
                       (RPC: get_subscriber_feed)
                                   │
                                   v
                          normalizeArticle()
                                   │
                                   v
                         ArticleCard rendering


  Direct visitor (no email)
            │
            v
          /  (Landing.tsx)
            │  email signup  ──► saveDigestSubscription (no interests yet)
            │
            │  "Customize" / CTA
            v
   /onboarding (Onboarding.tsx)
            │  also: receives email `/onboarding?t=TOKEN` —
            │  if token valid, skips onboarding and navigates /feed
            │
            │  4-step flow; on final "Save & continue":
            │    saveOnboardingSurvey → saveUserInterests
            │    → saveUserTickers → saveDigestSubscription
            │    → setOnboardingComplete → /feed
            v
          /feed
         Feed.tsx
            │
      getUserId() (no feed_token in localStorage)
            │
            v
       getUserFeed()
     (RPC: get_user_feed)
            │
            v
      normalizeArticle()
            │
            v
     ArticleCard rendering
```

## Frontend (Vite + React + TypeScript)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Landing.tsx` | Marketing/landing page. Hosts the email-signup form that creates a `digest_subscribers` row without `user_interests`. |
| `/onboarding` | `Onboarding.tsx` | 4-step personalization flow (survey → topics → tickers → email). Also parses `?t=` feed token from email links and redirects to `/feed` on success. |
| `/feed` | `Feed.tsx` | Main feed. Uses subscriber feed if `feed_token` is in localStorage, else user feed. |
| `/digest` | `Feed.tsx` (alias) | Canonical public-facing URL for the feed; kept alongside `/feed` for older email links. |
| `/explore` | `ExploreFeed.tsx` | Topic-browsing surface. |
| `/article/:id` | `ArticleDetail.tsx` | Full article view. Parses `?t=` feed token from track-click redirects and persists it. |
| `/unsubscribe` | `Unsubscribe.tsx` | Email unsubscribe flow. |
| `/privacy` | `Privacy.tsx` | Privacy policy. |
| `/terms` | `Terms.tsx` | Terms of service. |

**Base path**: `/` (configured in `vite.config.ts` and `routes.ts`). The app is served from the root of `finnopolis.com`.

## Backend (Supabase Edge Functions — Deno)

| Function | Trigger | JWT | Description |
|----------|---------|-----|-------------|
| `send-digest` | pg_cron hourly, timezone-aware / manual POST | No | Sends personalized email digests. Uses `get_digest_recipients(target_hour)` to pick subscribers whose local delivery time matches, then `get_subscriber_feed` RPC for articles. |
| `track-click` | Email link click (GET) | No | Logs click, redirects to app with feed token. |
| `send-welcome` | Called from frontend | No | Sends welcome email after subscription. |
| `digest-webhook` | Resend webhook POST | No | Records email events (delivered, opened, bounced). |
| `handle-unsubscribe` | HTTP GET/POST | No | One-click email unsubscribe. |

**Deployment**: Edge Functions are deployed via Supabase MCP (`deploy_edge_function`). The local files in `supabase/functions/` are the source of truth.

### Digest delivery cadence

`send-digest` runs on an hourly cron. Each invocation calls `get_digest_recipients(target_hour)` which returns only the subscribers whose local-time delivery hour matches `target_hour` (default: the current UTC hour). This means the cron fires ~24 times per UTC day, but any individual subscriber is contacted at most once per day (based on their stored timezone).

See [`user-tables.md`](./data-model/user-tables.md) for the `timezone` column. Double-sends within a day are prevented by `get_digest_recipients(target_hour)`: each subscriber's timezone-local delivery hour matches only one of the 24 hourly cron invocations. `last_sent_at` is updated after every send for analytics/observability but does not gate delivery.

## Data Flow: Email → App (Critical Path)

This is the most important flow to understand. Every link in a digest email goes through this path:

1. **Email link**: `https://<supabase>/functions/v1/track-click?a=<article_id>&t=<feed_token>`
2. **track-click** reads `a` and `t` from the query. It looks up the subscriber by `feed_token` (for click logging only — fire-and-forget) and proceeds immediately to the redirect.
3. **Redirect**: `302` to `https://finnopolis.com/article/<article_id>?t=<feed_token>`. If `t` is missing or the subscriber lookup fails, the redirect still goes to `/article/<article_id>` without a token (user lands on the article; the app may show onboarding if they have no prior session).
4. **ArticleDetail.tsx** reads `?t=` from URL, calls `setFeedToken()` + `setOnboardingComplete()` in localStorage.
5. **"Back to Feed"** navigates to `/feed`, which reads `getFeedToken()` from localStorage and loads `getSubscriberFeed()`.

### Invariants

- **Feed token is the subscriber identity**: `feed_token` is per-subscriber, stable, and NOT NULL at the schema level. The email URL carries it directly. `track-click` uses it to identify the subscriber for click logging; the redirect includes it so the frontend can load the personalized feed.
- **Article IDs are public**: `article_id` travels in the URL in the clear. That's fine — it's the same identifier that appears in `/article/:id` URLs throughout the app.
- **Single RPC, digest is a subset**: `get_subscriber_feed` is the single source of article selection for both the web feed and the digest email. The digest additionally filters against `digest_sent_articles` post-RPC (14-day dedup window, see `send-digest` v13), so the digest is a strict subset of the web feed — newly-novel articles only. The RPC itself must never be modified to apply the dedup; that filter is digest-email-only.

> **Historical note**: the email URL previously used a rotating per-(subscriber × article) `click_token` instead of `article_id` + `feed_token`. That design was replaced because the `(subscriber_id, article_id)` unique upsert in `send-digest` rotated the token on every re-send, silently breaking older emails. The `digest_sent_articles.click_token` column still exists but is no longer populated. See [P3 — simplify email-link tokens](./backlog/done/P3-simplify-email-link-tokens.md).

## Data Flow: Feed Loading

1. **Email users**: Visit via `?t=<feed_token>` link in digest email or track-click redirect.
   - Token is validated via `get_subscriber_feed` RPC.
   - On success, token is persisted to `localStorage` and onboarding is skipped.
   - All future visits use the subscriber feed path (token is sticky).

2. **Direct users**: Complete onboarding, get a random UUID, interests saved to DB.
   - Feed loaded via `get_user_feed` RPC.

3. **All paths**: Article objects are normalized via `normalizeArticle()` before rendering.

## Key Utilities

| File | Exports | Notes |
|------|---------|-------|
| `src/app/utils/supabase.ts` | API functions, `Article` interface, `normalizeArticle`, `formatArticleDate` | All Supabase communication. Normalize all RPC responses here. `normalizeArticle` is currently module-private — call it indirectly via the exported API fns. |
| `src/app/utils/userId.ts` | `getUserId`, `getFeedToken`, `setFeedToken`, `setOnboardingComplete`, etc. | localStorage-based session management. |

## Important Patterns

### Feed token persistence
Once a user visits via `?t=token`, the token is saved to `localStorage` permanently. This means the subscriber feed path is used for ALL subsequent visits, even without the query param. See `getFeedToken()` / `setFeedToken()` in `utils/userId.ts`.

### Date formatting
Always use `formatArticleDate()` from `utils/supabase.ts`. Never call `new Date()` directly on article date fields — they can be `null`, `undefined`, or malformed.

### Article normalization
RPC response data is always passed through `normalizeArticle()` inside `utils/supabase.ts`. Supabase RPC functions return JSONB and field names may differ from the TypeScript `Article` interface. Callers outside `supabase.ts` receive already-normalized `Article` objects from the exported API functions (`getSubscriberFeed`, `getUserFeed`, etc.) and should not re-normalize.

### Base URL

All URLs pointing to the app must use `https://finnopolis.com`. This is the production domain.

Where it's used:
- `track-click/index.ts` (`FALLBACK_URL`) — absolute redirect target for 302 responses.
- `send-digest/index.ts` (`SITE_BASE_URL`) — absolute URLs in email HTML.
- `send-welcome/index.ts` (`SITE_BASE_URL`) — absolute URLs in welcome email.

Where it's NOT needed / should stay relative:
- Frontend links/navigation. `routes.ts` uses `basename: '/'` and the Vite `base` is `/`. All in-app routing is relative (`/article/:id`, `/feed`, etc.).

**Ideally** `SITE_BASE_URL` would be read from a Supabase secret so a future domain change is a single secret update, not a code change across three files. See the backlog.

### Digest relevance ranking (v14+)

`get_subscriber_feed` no longer sorts by recency. Each article is scored
on three dimensions:

- **Personal** (topic match + ticker match, 0.1–1.5 range)
- **Market** (cap tier × story_magnitude/5, 0.04–1.0 range)
- **Temporal** (exponential decay, half-life varies by story_type)

The score is computed by the `calculate_relevance` pure SQL function
called inline in the RPC. Fuzzy inputs (magnitude, story type, entity
extraction) are LLM-tagged by the seeder at write time and persisted
as columns on `ai_articles`. SQL only does the arithmetic.

See `docs/design/digest-relevance-ranking.md` for the formula rationale
and the three-dimension framework.
