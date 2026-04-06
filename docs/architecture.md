# Architecture Overview

## System Diagram

```
[Email Link (?t=token)]    [Direct Visit]
         |                       |
         v                       v
   Onboarding.tsx ──> localStorage (fad_feed_token, fad_user_id)
         |                       |
         v                       v
      Feed.tsx ────────────── Feed.tsx
         |                       |
   getFeedToken()          getUserId()
         |                       |
         v                       v
  getSubscriberFeed()      getUserFeed()
   (RPC: get_subscriber_feed)  (RPC: get_user_feed)
         |                       |
         +── normalizeArticle() ─+
                    |
                    v
            Article interface
                    |
                    v
         ArticleCard rendering
```

## Frontend (Vite + React + TypeScript)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Onboarding.tsx` | Topic/ticker selection, email signup. Parses `?t=` token. |
| `/feed` | `Feed.tsx` | Main feed. Uses subscriber feed (if token in localStorage) or user feed. |
| `/article/:id` | `ArticleDetail.tsx` | Full article view with brief, citations, analyst data, AI inference. |
| `/unsubscribe` | `Unsubscribe.tsx` | Email unsubscribe flow. |

## Backend (Supabase Edge Functions - Deno)

| Function | Trigger | Description |
|----------|---------|-------------|
| `send-digest` | Cron / manual | Sends personalized email digests to subscribers. |
| `send-welcome` | Called from frontend | Sends welcome email after subscription. |
| `digest-webhook` | Resend webhook POST | Records email events (delivered, opened, bounced). |
| `handle-unsubscribe` | HTTP GET/POST | One-click email unsubscribe. |

## Data Flow: Feed Loading

1. **Email users**: Visit via `?t=<feed_token>` link in digest email.
   - Token is validated via `get_subscriber_feed` RPC.
   - On success, token is persisted to `localStorage` and onboarding is skipped.
   - All future visits use the subscriber feed path (token is sticky).

2. **Direct users**: Complete onboarding, get a random UUID, interests saved to DB.
   - Feed loaded via `get_user_feed` RPC (falls back to `get_articles_by_topics`, then direct query).

3. **All paths**: Article objects are normalized via `normalizeArticle()` before rendering.

## Key Utilities

| File | Exports | Notes |
|------|---------|-------|
| `src/app/utils/supabase.ts` | API functions, `Article` interface, `normalizeArticle`, `formatArticleDate` | All Supabase communication. Normalize all RPC responses here. |
| `src/app/utils/userId.ts` | `getUserId`, `getFeedToken`, `setFeedToken`, etc. | localStorage-based session management. |

## Important Patterns

### Feed token persistence
Once a user visits via `?t=token`, the token is saved to `localStorage` permanently. This means the subscriber feed path is used for ALL subsequent visits, even without the query param. See `getFeedToken()` / `setFeedToken()` in `userId.ts`.

### Date formatting
Always use `formatArticleDate()` from `supabase.ts`. Never call `new Date()` directly on article date fields — they can be `null`, `undefined`, or malformed.

### Article normalization
Always pass RPC response data through `normalizeArticle()`. Supabase RPC functions return JSONB and field names may differ from the TypeScript `Article` interface.
