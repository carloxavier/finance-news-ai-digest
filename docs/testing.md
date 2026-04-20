# Testing Strategy

This document describes how Finnopolis approaches automated testing today. The intention is to keep the test layering lean, prototype-appropriate, and directly tied to the kinds of regressions we've actually seen.

## Layering

Three layers, ordered by surface and cost:

| Layer | Runner | What it asserts | Cost |
|---|---|---|---|
| **Unit tests** | Vitest (Node) | Pure logic, component behaviour with mocked I/O, utility correctness | Fast (< 2s for the whole suite). Run on every change. |
| **Frontend smoke** | Playwright (real Chromium) against `npm run dev` | That the actual SPA renders and persists state correctly on the handful of routes that are load-bearing for users | ~10s. Run on frontend-touching PRs. |
| **Edge Function contract tests** | Vitest (Node, re-implementing the Deno handler with mocks) | That the Edge Function's critical branches behave as specified (e.g., `getSubscriberArticles` falls back correctly for landing-only subscribers) | Fast. Run when the corresponding Edge Function changes. |

Anything below that — full e2e across prod, visual-regression, load, a11y sweeps — is **explicitly out of scope** at the prototype stage. When the product justifies them, we add them.

## Unit tests (Vitest)

Colocated under `__tests__/` directories next to the source (e.g., `src/app/components/__tests__/Feed.test.tsx`, `src/app/utils/__tests__/splitBrief.test.ts`).

Runs: `npm test` (single run) or `npm run test:watch`.

Design principle: **don't test what the framework already tests**. Focus on:

- Branches with real business logic (feed-token vs user_id resolution, fallback paths, upsert invariants).
- Regression guards for bugs we've actually shipped — each regression guard carries a comment linking to the original incident.
- Component wiring that a refactor could silently break (e.g., `Feed.test.tsx` guards that the context strip's topic names come from the right source depending on whether a `feed_token` is present).

A good unit test either **documents a contract** or **locks in a bug fix**. If it does neither, it's decoration.

## Frontend smoke (Playwright)

Script: [`scripts/smoke-frontend.mjs`](../scripts/smoke-frontend.mjs). Invoked via `npm run smoke`.

**Why this layer exists.** `npm test` covers component logic in jsdom; `npm run build` catches type and compile errors. Neither catches:

- "Route renders but the screen is blank" — e.g., a hook that throws on first render only in a real browser.
- "localStorage side-effects missing" — e.g., the feed_token isn't persisted after arriving via `?t=<token>`.
- "Navigation loops" — the app bounces between `/` and `/onboarding` forever because an `onboarded` flag isn't read correctly.

These are the exact bugs we've shipped and had to repair post-merge. The smoke catches them before they merge.

### What the smoke covers today

1. **`/article/:id?t=<feed_token>`** — the article detail page renders the right headline **and** `fad_feed_token` + `fad_onboarding_complete` are persisted to `localStorage`. This is the final landing of the email → `track-click` → redirect flow.
2. **`/article/:id`** (no token) — the article still renders, but **no session is written** (specifically validated after the PR #10 simplification where `track-click` can now legitimately redirect without a `t` param).
3. **`/`** — the landing page loads and has the right page title. Catches "full white screen on `/`" class bugs.

Six discrete assertions across the three surfaces. Each one lives because a real bug would slip past unit tests but the smoke would catch it.

### How to run

```bash
npm run dev &     # start Vite (required — the smoke drives a real browser)
npm run smoke
```

Non-zero exit if any assertion fails. Intended for the author before pushing; not currently wired into CI (no CI pipeline today — single-developer prototype). When we add CI, `npm run smoke` is the natural first check to add alongside `npm test && npm run build`.

### Fixtures

The article_id, feed_token, and headline fragment are hardcoded defaults captured against real Supabase data on 2026-04-20. They **will go stale** — articles can be archived or re-seeded, subscribers can be deactivated.

Override when they break:

```bash
SMOKE_ARTICLE_ID=<uuid> \
SMOKE_FEED_TOKEN=<token> \
SMOKE_HEADLINE_FRAGMENT="substring" \
npm run smoke
```

Pull fresh values from the DB with the query documented at the top of `scripts/smoke-frontend.mjs`. If the hardcoded defaults rot for everyone, update them in the script — one-line change.

### Why Playwright

- **Ships its own Chromium**, so behaviour is deterministic across machines and macOS system-Chrome upgrades can't silently break CI later.
- **Already battle-tested** for this exact use case (dev-server smoke). Alternatives (Puppeteer, Cypress) are also fine; Playwright was the simplest install with the cleanest `localStorage` / `storageState` API for our needs.
- **One dev dependency**, single binary download. ~90 MB in `~/.cache/ms-playwright`, not in `node_modules`.

### When to extend the smoke (vs add a unit test)

Add a smoke check when:

- The failure mode only manifests in a real browser (DOM APIs, `localStorage`, React effects racing with router).
- The route interacts with a real backend response shape we want to validate end-to-end (use live Supabase data, not mocks).

Prefer a unit test when:

- The branch can be exercised by mocking a module boundary (React component with a mocked fetch).
- The assertion is about internal behaviour, not "what a user sees."

Keep the smoke set small. Every check pays ongoing maintenance cost as fixtures drift.

## Edge Function contract tests

Edge Functions run on Deno and can't be imported into Vitest. The compromise: for each Edge Function with non-trivial branches, re-implement the critical logic in a `.test.ts` file with mocked `supabase-js` clients. This is what `src/app/__tests__/digest-subscriber-flow.test.ts` does for `send-digest`'s `getSubscriberArticles`.

These tests are **contract** tests — they validate the *specified behaviour* rather than the actual deployed code. That means:

- If you change the Edge Function, you must update the contract test. Drift is a real risk.
- The test's value is documenting "here's how this function is supposed to behave across subscriber types," which is more durable than the exact code.

For simple Edge Functions (like the simplified `track-click` post-PR-#10), the branches are trivial enough that an inline-reviewed code read plus a post-deploy `curl` check is more cost-effective than a contract test. Don't build contract tests for every Edge Function — build them where the branching is rich enough to hide bugs.

## Post-deploy manual verification

Edge Functions ship separately from the frontend (via Supabase MCP, not git). After deploying an Edge Function change:

1. `curl -I "<live-url>?<params>"` to confirm the response / redirect target.
2. For `send-digest`, trigger a manual test digest: `POST /functions/v1/send-digest` with `{"email": "you@example.com"}`. Inspect the received email's link format in a client (Gmail, Outlook).
3. Click through to confirm the full email → `track-click` → `/article/:id` flow.

The `docs/deploy-edge-functions.md` playbook documents the exact commands.

## What's deliberately missing

These are not in the current strategy — not because they're bad, but because we don't have the user volume to justify the upkeep:

- **Full e2e against prod.** Too flaky, too slow, too expensive for a prototype. The smoke covers the SPA in isolation; the Edge Function deploy-and-curl covers the server half; stitching them together in automation would buy little.
- **Visual regression** (Chromatic, Percy). Design is still iterating weekly; locked-in screenshots would be constant noise.
- **Accessibility audits.** Deferred until we have a production launch target; manual a11y passes on design handoffs are currently sufficient.
- **Load testing.** ~14 subscribers. Not a load problem.

If you add a test layer beyond the three above, update this doc so future contributors (and Claude sessions) understand the intent.
