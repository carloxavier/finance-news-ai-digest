# Finance AI Digest — Project Guidelines

## General

- All frontend code lives in `src/app/`. Backend Edge Functions live in `supabase/functions/`.
- There is no auth — users are identified by a UUID stored in `localStorage` (`fad_user_id`).
- The Supabase project ID is `kamfamwjswkncftsdgxi`. RPC functions live in Supabase (not in this repo).
- Never trust the shape of data from RPC or REST responses. Always normalize at the boundary (see `normalizeArticle` in `src/app/utils/supabase.ts`).
- When adding a new RPC call, document its response shape in `docs/supabase-rpc.md` and validate with `normalizeArticle` or an equivalent.

## Architecture

See detailed docs in `/docs/`:
- [architecture.md](../docs/architecture.md) — System diagram, email-to-app flow, invariants
- [supabase-rpc.md](../docs/supabase-rpc.md) — RPC response shapes
- [deploy-edge-functions.md](../docs/deploy-edge-functions.md) — Edge Function deployment, testing, pitfalls
- [data-model/](../docs/data-model/README.md) — Database schema: tables, enums, FK cascade rules, JSONB shapes
- [backlog/](../docs/backlog/README.md) — Deferred work (P3/P4/P5 tickets)

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

There are **three distinct subscriber states**, each with different data. New features must work for all three:

| State | How they arrive | `digest_subscribers` row | `user_interests` | Expected behavior |
|------|----------------|--------------------------|-------------------|--------------------------|
| **Landing-page-only** | Email signup on `/`, never completes onboarding | Yes (with `feed_token`) | None | Digest falls back to latest 8 articles (no topic match possible) |
| **Onboarded, no email** | Completes onboarding via `/onboarding`, skips email | No | Yes | Web feed works via `get_user_feed`; no digest to send |
| **Fully onboarded** | Completes onboarding + provides email | Yes (with `feed_token`) | Yes | Personalized digest via `get_subscriber_feed` |

> `feed_token` is NOT NULL at the DB level (defaulted at INSERT via `encode(gen_random_bytes(18), 'base64')`), so every `digest_subscribers` row has one. The real distinguishing fact between landing-only and fully-onboarded is whether the user has any `user_interests` rows — that's what controls whether `get_subscriber_feed` can return personalized articles or the fallback path fires.

When adding any feature that touches the feed or digest pipeline, verify it works for the landing-page-only subscriber — this is the most common blind spot.

## Data Flow Invariants

### Landing page signup → digest delivery

```
Landing.tsx (email form)
  → saveDigestSubscription(userId, email, 'daily')
    → INSERT into digest_subscribers (user_id, email, frequency)
    → feed_token auto-populated by DB default; no user_interests rows yet

send-digest cron (hourly, timezone-aware)
  → get_digest_recipients(target_hour)
      returns subscribers whose local delivery hour == target_hour
      AND last_sent_at is NULL or older than today
  → for each subscriber:
      getSubscriberArticles(supabase, feed_token)
        → try get_subscriber_feed RPC
        → IF RPC returns empty (no user_interests → no topic match):
           → FALLBACK: fetch latest 8 complete articles from ai_articles
  → Render and send email
```

**Invariant:** Every active subscriber in `digest_subscribers` MUST receive a digest email at their local morning hour, regardless of whether they completed onboarding. The fallback to latest articles ensures landing-page-only users still receive a meaningful email.

### Onboarding → personalized feed

`Onboarding.tsx` has 4 UI steps, but **all DB writes happen on the final "Save & continue"** in a single sequential batch (see `handleSaveAndContinue` in `src/app/components/Onboarding.tsx`):

```
User progresses through steps 1–4 in memory (no writes yet)
  → Final "Save & continue":
      await saveOnboardingSurvey(userId, { investing_style, content_density })
      await saveUserInterests(userId, topicIds)
      if tickers: await saveUserTickers(userId, tickers)
      if email && email !== existingEmail:
         await saveDigestSubscription(userId, email, frequency)
         triggerWelcomeEmail(subscriber.id)
      setOnboardingComplete() in localStorage
      navigate('/feed')
```

**Invariant:** After onboarding, `user_interests` rows exist for the user. The `get_subscriber_feed` RPC joins through these rows to build a personalized feed. If any of the `await`s throws, earlier writes are NOT rolled back — design error handling accordingly.

## Critical Rules

### Email Digest & Feed Consistency
1. **Both the web feed and email digest must use `get_subscriber_feed` RPC.** Never use `get_user_feed` for digest emails — it has different ranking and caching.
2. **Upserts to `digest_sent_articles` must use `ignoreDuplicates: false`.** Otherwise re-sent digests have mismatched click tokens and tracking breaks.
3. **`track-click` must pass `?t=<feed_token>` in the redirect URL.** Without it, users land on onboarding instead of their feed.

### Base URL

Production domain: `https://finnopolis.com`.

- `vite.config.ts` (`base`) and `routes.ts` (`basename`) are both `/` — the app is served from the domain root, and **in-app navigation is always relative** (`/feed`, `/article/:id`). Don't hardcode the full origin in frontend code; relative paths resolve correctly in dev, preview, and prod.
- Absolute URLs are only required **outside the SPA**, where there is no `window.location` to anchor against:
  - `supabase/functions/_shared/email.ts` → `SITE_BASE_URL` (used by welcome + digest emails)
  - `supabase/functions/track-click/index.ts` → `FALLBACK_URL` (302 redirect target)

These three Edge Function constants currently hardcode `https://finnopolis.com`. Keep them aligned. Ideally promote to a Supabase secret so a future domain change is a single secret update.

### SQL / RPC
- Never use `DISTINCT ON` with a `LIMIT` unless the `ORDER BY` matches the intended sort. Use a subquery to deduplicate first, then sort and limit.
- Article data is normalized via `normalizeArticle()` inside `src/app/utils/supabase.ts`. `normalizeArticle` is module-private; callers of the exported API fns (`getSubscriberFeed`, `getUserFeed`, `getArticleById`, etc.) receive already-normalized `Article` objects and must not re-normalize. If you add a new RPC, normalize inside `supabase.ts` before returning.

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
