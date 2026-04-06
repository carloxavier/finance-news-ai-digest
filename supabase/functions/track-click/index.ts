// track-click Edge Function
// GET ?t={click_token} → log click → 302 redirect to Finnopolis article detail page
// Deployed with verify_jwt=false (public endpoint, used in email links)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FALLBACK_URL = "https://carloxavier.github.io/finance-news-ai-digest";

Deno.serve(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("t");
  if (!token) return Response.redirect(FALLBACK_URL, 302);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the sent article record and the subscriber's feed token
  const { data: sent } = await supabase
    .from("digest_sent_articles")
    .select("id, subscriber_id, article_id, subscriber:digest_subscribers!subscriber_id(feed_token)")
    .eq("click_token", token)
    .single();

  if (!sent) return Response.redirect(FALLBACK_URL, 302);

  // Log click (fire-and-forget, don't block the redirect)
  supabase.from("article_clicks").insert({
    subscriber_id: sent.subscriber_id,
    article_id: sent.article_id,
    sent_article_id: sent.id,
    source: "email",
  }).then(() => {
    console.log(`Click logged: subscriber=${sent.subscriber_id} article=${sent.article_id}`);
  }).catch((err: Error) => {
    console.error("Failed to log click:", err.message);
  });

  // Redirect to article detail page with feed token so the app can authenticate the user
  const feedToken = (sent.subscriber as any)?.feed_token;
  const tokenParam = feedToken ? `?t=${feedToken}` : "";
  return Response.redirect(`${FALLBACK_URL}/article/${sent.article_id}${tokenParam}`, 302);
});
