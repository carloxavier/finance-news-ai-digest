# Supabase Edge Function Deployment Guide

## Overview

Two Edge Functions need to be deployed to Supabase to complete the bug fix. Both have already been updated in the repo (`main` branch) and pushed to GitHub.

---

## 1. Deploy `track-click`

**File:** `supabase/functions/track-click/index.ts`

**What changed:** The function was redirecting email link clicks to the original article URL (e.g. cnbc.com). It now redirects to the Finnopolis article detail page (`https://finnopolis.com/article/{article_id}`).

**Deploy command:**
```bash
supabase functions deploy track-click
```

---

## 2. Deploy `send-digest`

**File:** `supabase/functions/send-digest/index.ts`

**What changed:** Added an optional `email` parameter to force-send a digest to a specific subscriber, bypassing the normal frequency/timing checks. When no body is provided (cron trigger), behavior is unchanged.

**Deploy command:**
```bash
supabase functions deploy send-digest
```

---

## 3. Test the fix

After both functions are deployed, trigger a test digest for the user:

```bash
curl -X POST 'https://kamfamwjswkncftsdgxi.supabase.co/functions/v1/send-digest' \
  -H 'Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"email": "isatorrealba@gmail.com"}'
```

**Expected response:**
```json
{ "sent": 1, "failed": 0, "total": 1, "errors": [] }
```

**Validation:** Click an article link in the received email. It should redirect to `https://finnopolis.com/article/{article_id}` (the Finnopolis app), NOT to the original source (e.g. cnbc.com).

---

## Notes

- Both functions require `verify_jwt=false` (already configured — they are public endpoints).
- `send-digest` requires the `RESEND_API_KEY` secret to be set in Supabase.
- The Supabase project ID is `kamfamwjswkncftsdgxi`.
