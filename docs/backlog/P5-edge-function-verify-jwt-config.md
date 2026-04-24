# P5 — Replace uniform `--no-verify-jwt` deploy flag with `supabase/config.toml`

**Filed**: 2026-04-24
**Status**: open

## Summary

`.github/workflows/deploy-edge-functions.yml` deploys every function with `--no-verify-jwt` baked into the deploy command. All five current functions (send-digest, send-welcome, track-click, digest-webhook, handle-unsubscribe) are public endpoints — cron-triggered jobs, email-link redirects, and the Resend webhook — so the flag is correct today.

The risk is future drift: a developer adds a function that should verify JWTs, the workflow silently deploys it without verification, and the regression is invisible until something breaks or leaks. There is no per-function record of the intended `verify_jwt` setting anywhere in the repo.

Noted during review of PR #14 (follow-up to PR #13, which introduced the workflow).

## Fix

Create `supabase/config.toml` with an explicit block per function:

```toml
[functions.send-digest]
verify_jwt = false

[functions.send-welcome]
verify_jwt = false

[functions.track-click]
verify_jwt = false

[functions.digest-webhook]
verify_jwt = false

[functions.handle-unsubscribe]
verify_jwt = false
```

Remove `--no-verify-jwt` from the deploy command in the workflow. The Supabase CLI reads the config file and applies the per-function setting automatically.

Drop the comment added in PR #14 that explains the uniform flag — it becomes obsolete once the config.toml is authoritative.

## Priority justification

P5 because today's state is correct and explicitly commented. The hazard is latent — it only triggers the first time someone adds a JWT-protected function. Fix before that happens, or as part of any larger cleanup of the Edge Function deploy pipeline.

## Acceptance

- `supabase/config.toml` exists with a block per function.
- `--no-verify-jwt` removed from `.github/workflows/deploy-edge-functions.yml`.
- The uniform-flag comment in the workflow is removed.
- A test deploy via `workflow_dispatch` confirms each function deploys with the expected `verify_jwt` setting (check via Supabase Studio → Edge Functions → function details).
- `docs/deploy-edge-functions.md` Overview sentence ("All functions use `verify_jwt=false`…") updated to reference the config file as the source of truth.
