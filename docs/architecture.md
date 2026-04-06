# Architecture Overview

## Deployment

- **Frontend**: Vite + React + TypeScript, deployed to GitHub Pages at `https://carloxavier.github.io/finance-news-ai-digest/`
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
           ┌───────────────────────┼────────────────────────┐
           │                       │                        │
           v                       v                        v
   /article/:id?t=TOKEN      /?t=TOKEN              / (no token)
   ArticleDetail.tsx        Onboarding.tsx          Onboarding.tsx
           │                       │                        │
           │  stores feed_token    │  validates token        │  normal onboarding
           │  + marks onboarding   │  via getSubscriberFeed  │  flow
           │  complete             │  then → /feed           │
           │                       │                        │
           └───────────┬───────────┘                        │
                       │                                    │
                       v                                    v
                    /feed                                /feed
                    Feed.tsx                             Feed.tsx
                       │                                    │
               getFeedToken()                         getUserId()
                       │                                    │
                       v                                    v
              getSubscriberFeed()                    getUserFeed()
           (RPC: get_subscriber_feed)           (RPC: get_user_feed)
                       │                                    │
                       └──────────┬─────────────────────────┘
                                  v
                          normalizeArticle()
                                  │
                                  v
                         ArticleCard rendering
```

## Frontend (Vite + React + TypeScript)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Onboarding.tsx` | Topic/ticker selection, email signup. Parses `?t=` feed token from email links. |
| `/feed` | `Feed.tsx` | Main feed. Uses subscriber feed (if token in localStorage) or user feed. |
| `/article/:id` | `ArticleDetail.tsx` | Full article view. Parses `?t=` feed token from track-click redirects. |
| `/unsubscribe` | `Unsubscribe.tsx` | Email unsubscribe flow. |

**Base path**: `/finance-news-ai-digest/` (configured in `vite.config.ts` and `routes.ts`).

## Backend (Supabase Edge Functions — Deno)

| Function | Trigger | JWT | Description |
|----------|---------|-----|-------------|
| `send-digest` | pg_cron daily 07:00 UTC / manual POST | No | Sends personalized email digests. Uses `get_subscriber_feed` RPC. |
| `track-click` | Email link click (GET) | No | Logs click, redirects to app with feed token. |
| `send-welcome` | Called from frontend | No | Sends welcome email after subscription. |
| `digest-webhook` | Resend webhook POST | No | Records email events (delivered, opened, bounced). |
| `handle-unsubscribe` | HTTP GET/POST | No | One-click email unsubscribe. |

**Deployment**: Edge Functions are deployed via Supabase MCP (`deploy_edge_function`). The local files in `supabase/functions/` are the source of truth.

## Data Flow: Email → App (Critical Path)

This is the most important flow to understand. Every link in a digest email goes through this path:

1. **Email link**: `https://<supabase>/functions/v1/track-click?t=<click_token>`
2. **track-click** looks up `click_token` in `digest_sent_articles`, joins to `digest_subscribers` to get the subscriber's `feed_token`.
3. **Redirect**: `302` to `https://carloxavier.github.io/finance-news-ai-digest/article/<article_id>?t=<feed_token>`
4. **ArticleDetail.tsx** reads `?t=` from URL, calls `setFeedToken()` + `setOnboardingComplete()` in localStorage.
5. **"Back to Feed"** navigates to `/feed`, which reads `getFeedToken()` from localStorage and loads `getSubscriberFeed()`.

### Invariants

- **Click tokens must match**: `send-digest` generates a click token per article, stores it in `digest_sent_articles`, and embeds it in the email. `track-click` looks it up. If the upsert uses `ignoreDuplicates: true`, re-sending a digest for the same articles will create a mismatch. **Always use `ignoreDuplicates: false`** so the DB token matches the latest email.
- **Feed token must be passed through**: `track-click` must append `?t=<feed_token>` to the redirect URL. Without it, the user lands on the app with no session and sees onboarding.
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
| `src/app/utils/supabase.ts` | API functions, `Article` interface, `normalizeArticle`, `formatArticleDate` | All Supabase communication. Normalize all RPC responses here. |
| `src/app/utils/userId.ts` | `getUserId`, `getFeedToken`, `setFeedToken`, `setOnboardingComplete`, etc. | localStorage-based session management. |

## Important Patterns

### Feed token persistence
Once a user visits via `?t=token`, the token is saved to `localStorage` permanently. This means the subscriber feed path is used for ALL subsequent visits, even without the query param. See `getFeedToken()` / `setFeedToken()` in `userId.ts`.

### Date formatting
Always use `formatArticleDate()` from `supabase.ts`. Never call `new Date()` directly on article date fields — they can be `null`, `undefined`, or malformed.

### Article normalization
Always pass RPC response data through `normalizeArticle()`. Supabase RPC functions return JSONB and field names may differ from the TypeScript `Article` interface.

### Base URL
All URLs pointing to the app must use `https://carloxavier.github.io/finance-news-ai-digest`. This is configured in:
- `vite.config.ts` (`base`)
- `routes.ts` (`basename`)
- `track-click/index.ts` (`FALLBACK_URL`)
- `send-digest/index.ts` (`SITE_BASE_URL`)
