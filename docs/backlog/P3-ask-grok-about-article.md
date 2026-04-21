# P3 — Replace "AI Deep Dive" waitlist with real Grok deep-link + click-intent tracking

**Filed**: 2026-04-21
**Status**: open

## Summary

The "Ask AI about this article" button on the article detail page today opens a
modal that offers to join a closed-beta "AI Deep Dive" waitlist. No AI is
actually invoked. The feature behind the waitlist isn't being built and the
CTA is effectively dead.

Before we promote the product on Reddit / LinkedIn / StockTwits / X next
(tier 1 of the launch plan), we want the button to deliver real value: a
deep-link into [Grok](https://grok.com) with the article's content preloaded
as a prompt, so the user gets a working AI consultation in one click.

## Why Grok

Shortlisted three anonymous-friendly options: Google Search AI Mode (Gemini),
Grok, and ChatGPT. Criteria:

- **No signup wall** — essential; signup friction drops conversion hard.
- **Closest UX to "AI agent" rather than "search engine"** — the mental model
  we want to set.

Grok wins on UX (full chat interface from the first message), is anonymous-
friendly for the initial query, and rate-limits gracefully instead of
hard-gating. Gemini via Search AI Mode is the safer fallback if Grok's
signup posture changes; deferred. ChatGPT and Claude are too inconsistent /
gated today.

## Target behavior

Two code paths based on whether the visitor is a known subscriber (has
`fad_feed_token` in localStorage):

1. **Known subscriber (feed_token present).** Click "Ask AI" → open Grok in
   a new tab immediately. Click-intent logged with the subscriber's email
   (resolved via `getSubscriberFeed(feed_token).subscriber.email`).

2. **Anonymous visitor (no feed_token).** Click "Ask AI" → interstitial modal
   explaining what happens next and offering optional email capture for the
   eventual first-party AI Deep Dive feature. On Continue → click-intent
   logged (with email if entered) + open Grok. On Cancel → nothing.

The existing modal is repurposed as the anonymous-visitor interstitial. The
"join the beta waitlist" framing is dropped; the copy becomes honest about
what the button does.

## Grok URL and prompt

```
https://grok.com/?q=<urlEncoded(prompt)>
```

Prompt template:

```
Explain this finance news article for a retail investor in 3 short points:
(1) core takeaway, (2) tickers/sectors affected, (3) what to watch next.

Headline: "<article.headline>"
URL: https://finnopolis.com/article/<article.id>
```

The URL lets Grok fetch full article body when it can; the headline is the
fallback signal. Total encoded length ~300 chars — well under URL limits.

## Click-intent tracking

Reuse `ai_agent_waitlist` (retained name, new semantics) with a small
schema tweak:

```sql
ALTER TABLE ai_agent_waitlist ADD COLUMN ai_provider text;
```

- Pre-existing rows (hypothetical beta-waitlist signups) retain `ai_provider
  = NULL` — legacy intent preserved.
- New rows from click events populate `ai_provider` (`'grok'` today; future
  entries could be `'gemini'`, `'chatgpt'`, etc.).
- No dedupe. Each click is a separate row — the behavioral signal is
  strongest at per-click granularity, and users asking the same article
  twice is information we want.

Query future intent: `SELECT ... WHERE ai_provider IS NOT NULL`. Query legacy
waitlist intent: `WHERE ai_provider IS NULL`.

If the overloaded table name starts causing confusion, split it later.
Documented in `docs/data-model/engagement-tables.md`.

## Scope

- Schema migration: `ai_agent_waitlist.ai_provider text` (nullable).
- `src/app/utils/supabase.ts`: new `logAiClickIntent(userId, articleId,
  provider, email?)` fn. Drop `checkWaitlistStatus`, `joinAiAgentWaitlist`
  from the ArticleDetail consumption path (keep the underlying fn if still
  imported elsewhere — otherwise delete).
- `src/app/components/ArticleDetail.tsx`: rewrite the Ask-AI button + modal.
- `scripts/smoke-frontend.mjs`: add a smoke check for the Ask-AI new-tab
  behaviour (both subscriber and anonymous paths).
- `docs/data-model/engagement-tables.md`: update the `ai_agent_waitlist`
  section describing the column + dual semantics.

## Out of scope

- Multi-provider picker (Gemini / ChatGPT / Claude). If Grok underperforms
  or gets gated, swap the single-provider URL. Multi-provider UX is a
  follow-up ticket.
- Renaming `ai_agent_waitlist` to something more honest. File a separate P5
  if it starts to bite.
- First-party AI Deep Dive implementation. The email-capture in the
  interstitial keeps the option open; building the feature is a bigger
  initiative.

## Acceptance

- Clicking "Ask AI about this article" on a feed_token article detail page
  opens Grok with the prompt prefilled, in a new tab.
- Clicking the same button as an anonymous visitor shows the interstitial
  modal.
- Both paths insert a row into `ai_agent_waitlist` with `ai_provider='grok'`.
- `npm test`, `npm run build`, `npm run smoke` all green.

## Priority

P3 — ships a dead button as a working feature before we start driving
strangers to it.
