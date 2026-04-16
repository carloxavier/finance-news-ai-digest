// send-welcome Edge Function
// POST { subscriber_id } → fetch subscriber + topics + articles → send welcome email via Resend
// Idempotent: skips if welcome_sent_at is already set
// Deployed with verify_jwt=false (called from frontend with anon key)

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  SITE_BASE_URL,
  escapeHtml,
  jsonResponse,
  renderEmailLayout,
  sendEmail,
  signalBg,
  signalColor,
} from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Max-Age": "86400",
};

interface Article {
  id: string;
  headline: string;
  ai_preview: string;
  source_url: string;
  consensus_signal: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { subscriber_id } = await req.json();
    if (!subscriber_id) {
      return jsonResponse({ error: "subscriber_id required" }, 400, CORS_HEADERS);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch subscriber — skip if already welcomed
    const { data: sub } = await supabase
      .from("digest_subscribers")
      .select("id, user_id, email, frequency, unsubscribe_token, feed_token")
      .eq("id", subscriber_id)
      .is("welcome_sent_at", null)
      .single();

    if (!sub) {
      console.log("Subscriber not found or already welcomed:", subscriber_id);
      return jsonResponse({ error: "Not found or already welcomed" }, 404, CORS_HEADERS);
    }

    // 2. Fetch subscriber's topics
    const { data: interests } = await supabase
      .from("user_interests")
      .select("topic_id, topics(slug, display_name)")
      .eq("user_id", sub.user_id);

    const topics = interests?.map((i: { topics: { slug: string; display_name: string } }) => i.topics) ?? [];
    const topicIds = interests?.map((i: { topic_id: string }) => i.topic_id) ?? [];

    // 3. Fetch tickers (graceful — table may not exist)
    let tickerList: string[] = [];
    try {
      const { data: tickers } = await supabase
        .from("user_tickers")
        .select("ticker")
        .eq("user_id", sub.user_id);
      tickerList = tickers?.map((t: { ticker: string }) => t.ticker) ?? [];
    } catch {
      // table doesn't exist yet — that's fine
    }

    // 4. Fetch top 5 articles matching their topics
    let articles: Article[] = [];

    if (topicIds.length > 0) {
      const { data: rows } = await supabase
        .from("article_topics")
        .select("article_id, ai_articles(id, headline, ai_preview, source_url, consensus_signal)")
        .in("topic_id", topicIds)
        .gt("ai_articles.published_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      const seen = new Set<string>();
      for (const row of rows ?? []) {
        const a = (row as Record<string, unknown>).ai_articles as Article | null;
        if (a && !seen.has(a.id)) {
          seen.add(a.id);
          articles.push(a);
          if (articles.length >= 5) break;
        }
      }
    }

    // If no topic-matched articles, fall back to latest
    if (articles.length === 0) {
      const { data: latest } = await supabase
        .from("ai_articles")
        .select("id, headline, ai_preview, source_url, consensus_signal")
        .eq("processing_status", "complete")
        .gt("published_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("published_at", { ascending: false })
        .limit(5);
      articles = latest ?? [];
    }

    // 5. Build links with graceful fallback
    const feedUrl = sub.feed_token
      ? `${SITE_BASE_URL}?t=${sub.feed_token}`
      : SITE_BASE_URL;
    const unsubUrl = `${SITE_BASE_URL}/unsubscribe?token=${sub.unsubscribe_token}`;
    const tokenParam = sub.feed_token ? `?t=${sub.feed_token}` : "";

    // 6. Build and send email
    const html = renderWelcomeEmail({
      articles,
      topics,
      tickers: tickerList,
      feedUrl,
      unsubUrl,
      tokenParam,
    });

    try {
      await sendEmail({
        to: sub.email,
        subject: "You\u2019re in \u2014 your first brief is ready",
        html,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Resend API error:", msg);
      return jsonResponse({ error: "Failed to send email" }, 500, CORS_HEADERS);
    }

    // 7. Mark welcome sent
    await supabase
      .from("digest_subscribers")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", subscriber_id);

    console.log(`Welcome email sent to ${sub.email}`);
    return jsonResponse({ success: true }, 200, CORS_HEADERS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Welcome email error:", msg);
    return jsonResponse({ error: msg }, 500, CORS_HEADERS);
  }
});

// ─── Email template ──────────────────────────────────────────────────

interface RenderWelcomeEmailOptions {
  articles: Article[];
  topics: Array<{ display_name: string }>;
  tickers: string[];
  feedUrl: string;
  unsubUrl: string;
  tokenParam: string;
}

function renderWelcomeEmail({
  articles,
  topics,
  tickers,
  feedUrl,
  unsubUrl,
  tokenParam,
}: RenderWelcomeEmailOptions): string {
  const topicNames = topics.map(t => t.display_name).join(", ") || "None selected";
  const tickerNames = tickers.length > 0 ? tickers.join(", ") : "None selected";

  const articleCards = articles.map(a => renderArticleCard(a, tokenParam)).join("");

  const body = `
    <!-- Welcome message -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:22px;font-weight:500;margin:0 0 12px;color:#ffffff;">You\u2019re in</h2>
      <p style="font-size:15px;color:#9ca3af;line-height:1.6;margin:0 0 20px;">
        Your Finnopolis account is set up. Every morning at 7:30 AM, we\u2019ll send you a notification with what\u2019s moving in your markets. Here\u2019s what\u2019s trending in your feed right now.
      </p>

      <!-- Profile summary -->
      <div style="background:#1a2744;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:13px;color:#60a5fa;margin-bottom:8px;">
          <strong>Your topics:</strong>
          <span style="color:#9ca3af;margin-left:4px;">${escapeHtml(topicNames)}</span>
        </div>
        <div style="font-size:13px;color:#60a5fa;">
          <strong>Your tickers:</strong>
          <span style="color:#9ca3af;margin-left:4px;">${escapeHtml(tickerNames)}</span>
        </div>
      </div>
    </div>

    ${articles.length > 0 ? `
    <div style="margin-bottom:32px;">
      <h3 style="font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1);">
        Trending in your feed
      </h3>
      ${articleCards}
    </div>
    ` : ""}
  `;

  return renderEmailLayout({
    feedUrl,
    unsubUrl,
    title: "Welcome to Finnopolis",
    body,
  });
}

function renderArticleCard(a: Article, tokenParam: string): string {
  const articleUrl = `${SITE_BASE_URL}/article/${a.id}${tokenParam}`;
  const color = signalColor(a.consensus_signal);
  const bg = signalBg(a.consensus_signal);

  return `
    <div style="background:#152638;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:12px;">
      <a href="${articleUrl}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:500;line-height:1.4;display:block;margin-bottom:8px;">
        ${escapeHtml(a.headline)}
      </a>
      <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0 0 12px;">
        ${escapeHtml(a.ai_preview ?? "")}
      </p>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-family:monospace;background:${bg};color:${color};border:1px solid ${color}40;">
          ${escapeHtml(a.consensus_signal ?? "NO_RATING")}
        </span>
        <a href="${articleUrl}" style="color:#60a5fa;font-size:12px;text-decoration:none;">Read analysis &#8594;</a>
      </div>
    </div>`;
}
