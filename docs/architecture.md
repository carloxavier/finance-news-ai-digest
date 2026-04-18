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
                        │  - looks up click_token│
                        │  - logs click          │
                        │  - 302 redirect with   │
                        │    ?t=<feed_token>     │
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

See [`user-tables.md`](./data-model/user-tables.md) for the `timezone` column and [`engagement-tables.md`](./data-model/engagement-tables.md) for the `last_sent_at` guard that prevents double-sends within the same day.

## Data Flow: Email → App (Critical Path)

This is the most important flow to understand. Every link in a digest email goes through this path:

1. **Email link**: `https://<supabase>/functions/v1/track-click?t=<click_token>`
2. **track-click** looks up `click_token` in `digest_sent_articles`, joins to `digest_subscribers` to get the subscriber's `feed_token`.
3. **Redirect**: `302` to `https://finnopolis.com/article/<article_id>?t=<feed_token>`
4. **ArticleDetail.tsx** reads `?t=` from URL, calls `setFeedToken()` + `setOnboardingComplete()` in localStorage.
5. **"Back to Feed"** navigates to `/feed`, which reads `getFeedToken()` from localStorage and loads `getSubscriberFeed()`.

### Invariants

- **Click tokens must match**: `send-digest` generates a click token per article, stores it in `digest_sent_articles`, and embeds it in the email. `track-click` looks it up. If the upsert uses `ignoreDuplicates: true`, re-sending a digest for the same articles will create a mismatch. **Always use `ignoreDuplicates: false`** so the DB token matches the latest email.
- **Feed token must be passed through**: `track-click` must append `?t=<feed_token>` to the redirect URL. Without it, the user lands on the app with no session and (if they haven't completed onboarding yet) sees Landing instead.
- **Both RPCs must return the same articles**: `send-digest` and the web feed must use `get_subscriber_feed` so the email articles match the web feed. Never use a different RPC for the digest.

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
