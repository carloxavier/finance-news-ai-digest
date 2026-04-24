# P4 — Add contract tests for `track-click` Edge Function

**Filed**: 2026-04-24
**Status**: open

## Summary

Every email article click flows through `supabase/functions/track-click/index.ts`. The function has four documented branches, each of which has been the subject of a past incident or near-miss:

1. Missing `a` param → redirect to `SITE_BASE_URL` fallback (not error).
2. Missing `t` param → redirect still works, click log is skipped.
3. Unknown `t` (no matching subscriber) → redirect still works, click log is skipped.
4. Valid `a` + `t` → click logged, redirect to `/article/<a>?t=<t>`.

`track-click` has no colocated tests. The pre-deploy check (`scripts/pre-deploy-check.sh track-click`) prints a "no test files found" warning and exits 0, so the function deploys to prod without any verification beyond a manual curl.

Surfaced during review of PR #13; explicitly deferred from that PR to avoid scope creep.

## Fix

Follow the `selection.ts` / `selection.test.ts` pattern from PR #13:

1. Extract the URL-building and click-logging decisions out of `index.ts` into a pure sibling module (e.g. `resolve.ts`). Current `index.ts` mixes request parsing, Supabase calls, and redirect construction — only the decision logic needs testing.
2. Add `track-click/resolve.test.ts` with one test per branch above, plus edge cases:
   - Malformed `a` (not a UUID) → same behaviour as missing `a`.
   - `t` present but empty string → treated as missing.
   - Redirect target escapes correctly when `a` contains URL-unsafe characters (shouldn't happen given UUID format, but lock it in).
3. Keep the Supabase client call in `index.ts` — don't mock the network layer.

## Priority justification

P4 because the function is a hot path (every email click) with multiple incident-shaped branches, but the current behaviour is stable. The cost of the missing tests is paid the next time someone refactors the function — they'll have no safety net. Worth locking in before the next touch.

## Acceptance

- Pure `resolve.ts` (or similarly named) sibling module exports the decision logic.
- `resolve.test.ts` covers all four branches + edge cases listed above.
- `scripts/pre-deploy-check.sh track-click` now runs tests instead of warning.
- `index.ts` imports from the sibling and contains only request parsing, Supabase I/O, and response construction.
- No behaviour change observable from the outside — this is purely a test-harness refactor.

## Related tickets

- PR #13 established the colocated-test pattern for `send-digest`. This ticket extends it to `track-click`.
