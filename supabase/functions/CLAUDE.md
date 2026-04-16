# Edge functions

## `send-welcome` and `send-digest` — keep them aligned

These two functions ship HTML email. They used to drift: footer border
colors got out of sync, only one got the "not investment advice"
disclaimer, CTAs diverged ("Open in Finnopolis →" vs "Open Finnopolis →").

The drift-prone chrome is now in `_shared/email.ts` — layout wrapper,
header, CTA, footer, signal colors, `sendEmail`, `escapeHtml`. Changes
there apply to both emails by construction.

### What still requires judgment

A few things are intentionally NOT in `_shared/` because their exact
phrasing is email-specific:

- **Subject lines** — welcome: "You're in — your first brief is ready".
  digest: "📊 Your morning brief — {date}". Voice should stay aligned.
- **Body copy** — welcome's "You're in" block and profile summary;
  digest's article cards with tickers / "What to watch" blocks.
- **Article card rendering** — different data shapes (welcome: simple
  cards linking to `/article/:id`; digest: ticker pills, watch items,
  tracked click URLs).

Before changing any of these in one file, grep the sibling and ask
whether the change should apply there too.

### When you touch `_shared/email.ts`

Send a test of BOTH emails and eyeball in a real client before merging.
A change that looks right in the welcome preview can still break the
digest (e.g. the header renders differently with/without a subheader).

### Deploying

Both are deployed via the Supabase MCP or CLI (`supabase functions
deploy send-welcome`). The frontend pipeline has no effect on these —
they ship separately. The git source of truth is this directory.
