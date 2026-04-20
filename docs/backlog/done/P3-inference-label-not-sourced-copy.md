# P3 — "AI Inference — Not Sourced" label is redundant and noisy

**Filed**: 2026-04-20
**Status**: done
**Closed**: 2026-04-20 (PR #XXX)

## Summary

The amber AI Inference block on the article detail page shows the
label `"AI Inference — Not Sourced"`. The `"— Not Sourced"` suffix is
redundant with the body copy directly below it ("The following
insights are AI-generated and should be verified independently") and
visually noisy. The amber color + warning icon already communicate
the unsourced-insight signal.

Reported by Carlo against a v2 article on 2026-04-18.

## Fix

`src/app/components/ArticleDetail.tsx:237` —
change `AI Inference — Not Sourced` to `AI Inference`.

## Acceptance

- Label reads `"AI Inference"` only.
- `npm test` and `npm run build` pass.

## Priority

P3 — one-line copy fix. Trivial.

## Progress log

- **2026-04-20** — Work started. Change `"AI Inference — Not Sourced"`
  to `"AI Inference"` at `src/app/components/ArticleDetail.tsx:237`.
- **2026-04-20** — Completed. One-line copy change shipped. `npm test`
  72/72 passing, `npm run build` clean.
