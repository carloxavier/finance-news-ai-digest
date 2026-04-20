# P3 — Simplify email-link tokens (drop click_token, use article_id + feed_token)

**Filed**: 2026-04-20
**Status**: open

## Summary

Article links in the digest email go through `track-click` using an
opaque per-(subscriber × article) `click_token`. When the same
article is re-sent to the same subscriber (even once — the upsert in
`send-digest` rotates tokens per the `(subscriber_id, article_id)`
unique constraint with `ignoreDuplicates: false`), the old email's
click_token is overwritten and the old link dies: `track-click`
can't find the token → falls back to `Response.redirect(FALLBACK_URL)`
→ user lands on `finnopolis.com/` instead of the article.

Observed live on 2026-04-20: two of three recent `track-click`
requests hit the fallback path because the click_tokens had been
overwritten.

## Why this is the wrong model

The token indirection was presumably added so the email URL wouldn't
leak the subscriber identity. That anonymity is illusory because
`track-click` immediately 302-redirects to
`/article/:id?t=<feed_token>` — the feed_token lands in the browser
URL, history, referrer headers, localStorage, and any analytics
pixel on the page. Forwarding the email gives a third party
everything the click_token supposedly protected.

Architecturally:

- **`article_id`** is a public identifier (it's in the URL path). It
  should stay in the clear.
- **`feed_token`** is the per-subscriber long-lived identity. That's
  where tokenization belongs.
- **`click_token`** was tokenizing *articles* per-delivery, which is
  redundant with article_id and paid the cost of a rotating lookup
  for no security gain.

## Target design

Email URL pattern:

```
https://<supabase>/functions/v1/track-click?a=<article_id>&t=<feed_token>
```

`track-click`:

1. Read `a` and `t` from query.
2. Look up subscriber by `feed_token = t` to get `subscriber_id`.
3. If subscriber found: log click to `article_clicks` with
   `(subscriber_id, article_id)`. Populate `sent_article_id` by
   finding the most recent `digest_sent_articles` row for this
   `(subscriber_id, article_id)` pair; leave null if none.
4. Redirect to `${SITE_BASE_URL}/article/<a>?t=<t>` on success, or
   `${SITE_BASE_URL}/article/<a>` if `t` missing/invalid.
5. Fall back to `${SITE_BASE_URL}` only when `a` is missing.

`send-digest`:

- Stop calling `generateClickToken` per article.
- Embed `${TRACK_CLICK_URL}?a=<article.id>&t=<sub.feed_token>` in
  email article cards.
- Stop writing `click_token` into `digest_sent_articles` rows. The
  `digest_sent_articles` table still records the send (subscriber,
  article, batch, sent_at) so analytics don't regress.

## Explicit trade-offs (accepted)

- **Articles already shipped with the old click_token format will
  not redirect correctly after this lands.** Prototype stage; we
  accept one-time link breakage in exchange for eliminating the
  class of bug.
- **`feed_token` now visible in email source.** Incremental exposure
  over today's architecture is minimal (the token is already visible
  in the 302'd URL post-click). Real fix is the P3 authZ ticket,
  which replaces the client-generated UUID + sticky feed_token
  pattern with a server-issued session.
- **`digest_sent_articles.click_token` column becomes dead.** Leave
  the column in place (nullable already); schedule for DROP in a
  future schema cleanup pass alongside the other legacy columns
  (P5 drop-legacy-brief-column or a dedicated sweep).

## Scope

- `supabase/functions/send-digest/index.ts` — drop
  `generateClickToken`, `ArticleWithToken`, `clickToken` field on
  upsert; assemble track-click URL with `a` + `t`.
- `supabase/functions/track-click/index.ts` — rewrite handler to
  look up subscriber by `feed_token` and use `article_id` from URL
  for the redirect.
- `docs/architecture.md` — update the email-to-app flow section;
  drop the "click tokens must match" invariant.
- `docs/deploy-edge-functions.md` — update track-click flow +
  send-digest click-token-lifecycle section.
- `docs/data-model/engagement-tables.md` — mark `click_token` as
  dead; update flow description.
- `guidelines/Guidelines.md` — relax the `ignoreDuplicates: false`
  rationale (still true mechanically, but no longer about token
  alignment).

## Out of scope

- Dropping the `click_token` column from the schema (separate P5).
- The server-issued session for `user_id` (that's the P3 authZ
  ticket).

## Acceptance

- `supabase/functions/track-click/index.ts` does not reference
  `click_token` anywhere.
- `supabase/functions/send-digest/index.ts` does not generate or
  persist `click_token`.
- `npm test` and `npm run build` pass (frontend is unaffected; the
  `digest-subscriber-flow.test.ts` contract still holds because
  `getSubscriberArticles` signature is unchanged).
- Documentation listed above updated.
- Edge Functions redeployed (post-merge).

## Priority

P3 — user-visible regression every time an article re-appears in a
later digest. Cheap, surgical fix.
