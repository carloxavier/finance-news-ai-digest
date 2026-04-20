// Frontend smoke test — Playwright against a running Vite dev server.
//
// Exercises the routes that `track-click` lands users on:
//   1. /article/:id?t=<feed_token>   — article renders, session persisted
//   2. /article/:id                  — article still renders, no stale session
//   3. /                             — landing page loads
//
// Run:  npm run dev &   # in another terminal
//       npm run smoke
//
// Fixtures default to values captured 2026-04-20. They may go stale as content
// is reseeded or subscribers change. Override via env vars when that happens:
//
//   SMOKE_BASE=http://localhost:5173 \
//   SMOKE_ARTICLE_ID=<uuid> \
//   SMOKE_HEADLINE_FRAGMENT="<substring>" \
//   SMOKE_FEED_TOKEN=<token> \
//   npm run smoke
//
// Pull fresh fixtures from the DB:
//   SELECT ds.feed_token, dsa.article_id, a.headline
//   FROM digest_subscribers ds
//   JOIN digest_sent_articles dsa ON dsa.subscriber_id = ds.id
//   JOIN ai_articles a ON a.id = dsa.article_id
//   WHERE ds.email = 'your@email' ORDER BY dsa.sent_at DESC LIMIT 1;

import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE || "http://localhost:5173";
const ARTICLE_ID = process.env.SMOKE_ARTICLE_ID || "85586a31-fd75-4a24-b407-0db4ed5cac78";
const ARTICLE_HEADLINE_FRAGMENT = process.env.SMOKE_HEADLINE_FRAGMENT || "ESG rating providers";
const FEED_TOKEN = process.env.SMOKE_FEED_TOKEN || "ERJajZp3J8tGonkPjNYogXCo";

// Fail fast with a helpful message if the dev server isn't up.
try {
  const probe = await fetch(BASE, { method: "HEAD" });
  if (!probe.ok && probe.status !== 405) {
    console.error(`✗ Dev server at ${BASE} returned ${probe.status}. Is it running?`);
    process.exit(2);
  }
} catch (err) {
  console.error(`✗ Cannot reach ${BASE} — start the dev server first: npm run dev`);
  console.error(`  (${err.message})`);
  process.exit(2);
}

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch();

try {
  // Test 1: /article/:id?t=<feed_token> renders + persists session
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/article/${ARTICLE_ID}?t=${FEED_TOKEN}`);
    await page.waitForSelector("h1", { timeout: 10000 });
    const h1 = await page.textContent("h1");
    const hasHeadline = h1 && h1.toLowerCase().includes(ARTICLE_HEADLINE_FRAGMENT.toLowerCase());
    record("article+token: headline rendered", hasHeadline, `h1="${h1}"`);

    const storage = await ctx.storageState();
    const local = (storage.origins || []).find((o) => o.origin === BASE)?.localStorage || [];
    const feedTokenEntry = local.find((e) => e.name === "fad_feed_token");
    const onboardedEntry = local.find((e) => e.name === "fad_onboarding_complete");
    record(
      "article+token: localStorage.fad_feed_token set",
      feedTokenEntry?.value === FEED_TOKEN,
      `got ${JSON.stringify(feedTokenEntry?.value ?? null)}`,
    );
    record(
      "article+token: localStorage.fad_onboarding_complete set",
      onboardedEntry?.value === "true" || onboardedEntry?.value === "1",
      `got ${JSON.stringify(onboardedEntry?.value ?? null)}`,
    );
    await ctx.close();
  }

  // Test 2: /article/:id WITHOUT token still renders (fallback path)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/article/${ARTICLE_ID}`);
    await page.waitForSelector("h1", { timeout: 10000 });
    const h1 = await page.textContent("h1");
    const hasHeadline = h1 && h1.toLowerCase().includes(ARTICLE_HEADLINE_FRAGMENT.toLowerCase());
    record("article no token: headline still renders", hasHeadline, `h1="${h1}"`);

    const storage = await ctx.storageState();
    const local = (storage.origins || []).find((o) => o.origin === BASE)?.localStorage || [];
    const feedTokenEntry = local.find((e) => e.name === "fad_feed_token");
    record(
      "article no token: no feed_token written to localStorage",
      !feedTokenEntry,
      feedTokenEntry ? `unexpected ${JSON.stringify(feedTokenEntry)}` : "clean",
    );
    await ctx.close();
  }

  // Test 3: / loads cleanly for a fresh visitor
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    const title = (await page.title()) || "";
    const body = await page.textContent("body");
    const hasLandingCopy = body && /finnopolis/i.test(body);
    record("landing (/): page loads", hasLandingCopy, `title="${title}"`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

const failures = results.filter((r) => !r.pass);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
process.exit(failures.length === 0 ? 0 : 1);
