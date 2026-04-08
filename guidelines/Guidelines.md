# Finance AI Digest — Project Guidelines

## General

- All frontend code lives in `src/app/`. Backend Edge Functions live in `supabase/functions/`.
- There is no auth — users are identified by a UUID stored in `localStorage` (`fad_user_id`).
- The Supabase project ID is `kamfamwjswkncftsdgxi`. RPC functions live in Supabase (not in this repo).
- Never trust the shape of data from RPC or REST responses. Always normalize at the boundary (see `normalizeArticle` in `supabase.ts`).
- When adding a new RPC call, document its response shape in `docs/supabase-rpc.md` and validate with `normalizeArticle` or an equivalent.

## Architecture

See detailed docs in `/docs/`:
- [architecture.md](../docs/architecture.md) — System diagram, email-to-app flow, invariants
- [supabase-rpc.md](../docs/supabase-rpc.md) — RPC response shapes, DB schema
- [deploy-edge-functions.md](../docs/deploy-edge-functions.md) — Edge Function deployment, testing, pitfalls

## Testing

- Test runner: **Vitest** (`npm test` to run, `npm run test:watch` for watch mode).
- Tests live next to source code in `__tests__/` directories (e.g. `src/app/__tests__/`, `src/app/utils/__tests__/`).
- Run `npm test` before pushing any change that touches routes, utilities, or Edge Functions.

### What to test

| Area | What to verify | Why |
|------|---------------|-----|
| **Route config** | Landing at `/`, Onboarding at `/onboarding`, all paths exist | Prevents accidentally swapping the landing page with onboarding |
| **User ID / state utils** | `getUserId` persistence, `hasCompletedOnboarding` lifecycle | Core user identity — if broken, all personalization fails |
| **Digest subscriber flow** | Articles returned for ALL subscriber types (see below) | Prevents silent digest skipping for certain user segments |

### Subscriber types to always test

There are **three distinct subscriber types**, each with different data states. New features must work for all three:

| Type | How they arrive | `feed_token` | `user_interests` | Expected digest behavior |
|------|----------------|--------------|-------------------|--------------------------|
| **Landing-page-only** | Email signup on `/`, never completes onboarding | NULL | None | Falls back to latest articles |
| **Onboarded, no email** | Completes onboarding via `/onboarding`, skips email | NULL | Has topics | Web feed works, no digest sent |
| **Fully onboarded** | Completes onboarding + provides email | Has token | Has topics | Personalized digest via RPC |

When adding any feature that touches the feed or digest pipeline, verify it works for the landing-page-only subscriber — this is the most common blind spot.

## Data Flow Invariants

### Landing page signup → digest delivery

```
Landing.tsx (email form)
  → saveDigestSubscription(userId, email, 'daily')
    → INSERT into digest_subscribers (user_id, email, frequency)
    → feed_token = NULL, no user_interests rows

send-digest cron (07:00 UTC)
  → SELECT active subscribers due for send
  → getSubscriberArticles(supabase, feed_token)
    → IF feed_token exists: try get_subscriber_feed RPC
    → IF RPC returns empty OR feed_token is NULL:
       → FALLBACK: fetch latest 8 articles from ai_articles
  → Render and send email
```

**Invariant:** Every active subscriber in `digest_subscribers` MUST receive a digest email, regardless of whether they completed onboarding. The fallback to latest articles ensures this.

### Onboarding → personalized feed

```
Onboarding.tsx (4 steps)
  → Step 1: saveOnboardingSurvey(userId, style, density)
  → Step 3: saveUserInterests(userId, topicIds)
  → Step 4: saveUserTickers(userId, tickers)
  → Step 4: saveDigestSubscription(userId, email, frequency)
  → setOnboardingComplete() in localStorage
  → navigate('/feed')
```

**Invariant:** After onboarding, `user_interests` rows exist for the user. The `get_subscriber_feed` RPC joins through these rows to build a personalized feed.

## Critical Rules

### Email Digest & Feed Consistency
1. **Both the web feed and email digest must use `get_subscriber_feed` RPC.** Never use `get_user_feed` for digest emails — it has different ranking and caching.
2. **Upserts to `digest_sent_articles` must use `ignoreDuplicates: false`.** Otherwise re-sent digests have mismatched click tokens and tracking breaks.
3. **`track-click` must pass `?t=<feed_token>` in the redirect URL.** Without it, users land on onboarding instead of their feed.

### Base URL
All app URLs must use `https://carloxavier.github.io/finance-news-ai-digest`. This is configured in:
- `vite.config.ts` (`base`)
- `routes.ts` (`basename`)
- `track-click/index.ts` (`FALLBACK_URL`)
- `send-digest/index.ts` (`SITE_BASE_URL`)

Never hardcode `finnopolis.com` as a redirect target.

### SQL / RPC
- Never use `DISTINCT ON` with a `LIMIT` unless the `ORDER BY` matches the intended sort. Use a subquery to deduplicate first, then sort and limit.
- Always pass article data through `normalizeArticle()` before rendering — field names vary between RPCs.

### Edge Functions
- All Edge Functions use `verify_jwt=false` (public endpoints for email links/webhooks).
- Deploy via Supabase MCP (`deploy_edge_function`). Local files in `supabase/functions/` are source of truth.
- Required secret for send-digest: `RESEND_API_KEY`.
- Edge Functions run on Deno, so they can't be directly imported into Vitest. Critical logic (like `getSubscriberArticles` fallback) is contract-tested by re-implementing the function with mocks in `src/app/__tests__/digest-subscriber-flow.test.ts`. When modifying Edge Function logic, update the corresponding contract test.

## Design System

- Background: `#0D1B2A` (navy)
- Citation markers `[N]`: `#2563EB` (citation blue)
- Layer 1 (analyst data): Blue — sourced, trust-positive
- Layer 2 (AI inference): Amber — always labelled "AI INFERENCE - not sourced"
- Headlines: Instrument Serif
- Data / tickers / citations: IBM Plex Mono
- Body: Plus Jakarta Sans
- Date formats: always relative ("2h ago", "3d ago"), using `formatArticleDate()` from `supabase.ts`

## Frontend Patterns

- **Feed token persistence**: Once a user visits via `?t=token`, the token is saved to localStorage permanently. All subsequent visits use the subscriber feed path.
- **Date formatting**: Always use `formatArticleDate()` from `supabase.ts`. Never call `new Date()` directly on article date fields.
- **Null safety on arrays**: Always use `(array ?? [])` before `.slice()`, `.map()`, etc. — fields like `extracted_tickers` can be null.
