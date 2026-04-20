// track-click Edge Function
// GET ?a={article_id}&t={feed_token} → log click → 302 redirect to Finnopolis article detail page
// Deployed with verify_jwt=false (public endpoint, used in email links)
//
// History: previously keyed on a rotating per-(subscriber × article) click_token
// that landed in digest_sent_articles. The token was rotated on every re-send
// via the (subscriber_id, article_id) unique upsert, so older emails broke
// silently. The simplified design keeps identity in feed_token (which is
// per-subscriber and stable) and uses the public article_id as the redirect
// target. See docs/backlog/done/P3-simplify-email-link-tokens.md.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FALLBACK_URL = "https://finnopolis.com";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const articleId = url.searchParams.get("a");
  const feedToken = url.searchParams.get("t");

  // Without an article_id we cannot produce a meaningful destination.
  if (!articleId) return Response.redirect(FALLBACK_URL, 302);

  const destination = feedToken
    ? `${FALLBACK_URL}/article/${articleId}?t=${feedToken}`
    : `${FALLBACK_URL}/article/${articleId}`;

  // Log the click if we can identify the subscriber via feed_token. Fire-and-
  // forget: don't block the redirect on this.
  if (feedToken) {
    logClick(articleId, feedToken).catch((err: Error) => {
      console.error("Failed to log click:", err.message);
    });
  }

  return Response.redirect(destination, 302);
});

async function logClick(articleId: string, feedToken: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: subscriber } = await supabase
    .from("digest_subscribers")
    .select("id")
    .eq("feed_token", feedToken)
    .maybeSingle();

  if (!subscriber) {
    console.log(`No subscriber for feed_token=${feedToken.slice(0, 6)}… (skipping click log)`);
    return;
  }

  // Attach to the most recent delivery of this article to this subscriber, if
  // one exists. The FK column is ON DELETE SET NULL so NULL is acceptable.
  const { data: sent } = await supabase
    .from("digest_sent_articles")
    .select("id")
    .eq("subscriber_id", subscriber.id)
    .eq("article_id", articleId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("article_clicks").insert({
    subscriber_id: subscriber.id,
    article_id: articleId,
    sent_article_id: sent?.id ?? null,
    source: "email",
  });

  console.log(`Click logged: subscriber=${subscriber.id} article=${articleId}`);
}
