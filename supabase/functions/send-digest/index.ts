// send-digest Edge Function
// Triggered by pg_cron at 07:00 UTC daily
// Required secret: RESEND_API_KEY
// Deployed via Supabase MCP — this file is the local source of truth.

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

const TRACK_CLICK_URL = `${SUPABASE_URL}/functions/v1/track-click`;

// ─── Types ───────────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  user_id: string;
  email: string;
  frequency: string;
  unsubscribe_token: string;
  feed_token: string | null;
  timezone: string;
}

interface Article {
  id: string;
  headline: string;
  publication: string;
  published_at: string;
  ai_preview: string;
  consensus_signal: string;
  extracted_tickers: string[];
  inference_watch: string[];
}

// ─── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Optional: force-send to a specific email (bypasses timing checks)
    let forceEmail: string | null = null;
    let targetHour = 7;
    try {
      const body = await req.json();
      if (body?.email) forceEmail = body.email.toLowerCase().trim();
      if (body?.target_hour !== undefined) targetHour = body.target_hour;
    } catch {
      // No body or invalid JSON — normal cron invocation
    }

    // 1. Get subscribers due for a send (timezone-aware via RPC)
    let subscribers: Subscriber[] = [];

    if (forceEmail) {
      const { data, error: subError } = await supabase
        .from("digest_subscribers")
        .select("id, user_id, email, frequency, unsubscribe_token, feed_token, timezone")
        .eq("is_active", true)
        .eq("email", forceEmail);
      if (subError) {
        console.error("Error fetching subscriber:", subError);
        return jsonResponse({ error: subError.message }, 500);
      }
      subscribers = (data || []) as Subscriber[];
    } else {
      const { data, error: subError } = await supabase.rpc("get_digest_recipients", {
        target_hour: targetHour,
      });
      if (subError) {
        console.error("Error fetching timezone-filtered subscribers:", subError);
        return jsonResponse({ error: subError.message }, 500);
      }
      subscribers = (data || []) as Subscriber[];
    }

    if (subscribers.length === 0) {
      console.log(`No subscribers due for hour ${targetHour}`);
      return jsonResponse({ sent: 0, skipped: 0, failed: 0, message: `No subscribers due for hour ${targetHour}` });
    }

    console.log(`Found ${subscribers.length} subscriber(s) due for digest (hour=${targetHour})`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Batch ID for this digest run
    const batchId = `digest-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-0700`;

    // 2. Process each subscriber
    for (const sub of subscribers) {
      try {
        // Get their personalized feed (newest 8 articles, same source as the web feed)
        const articles = await getSubscriberArticles(supabase, sub.feed_token);

        if (articles.length === 0) {
          console.log(`No articles for ${sub.email}, skipping`);
          continue;
        }

        // Get their tickers for highlighting
        const { data: tickerRows } = await supabase
          .from("user_tickers")
          .select("ticker")
          .eq("user_id", sub.user_id);
        const userTickers = (tickerRows || []).map((r: { ticker: string }) => r.ticker);

        // Build and send email
        const html = renderDigestEmail(articles, userTickers, sub);
        const subject = `📊 Your morning brief — ${formatDate(new Date())}`;

        await sendEmail({ to: sub.email, subject, html, batchId });

        // Record send history. click_token is intentionally left NULL — the
        // email URL pattern now encodes article_id + feed_token directly (see
        // docs/backlog/done/P3-simplify-email-link-tokens.md). The column is
        // scheduled for DROP in a future schema cleanup.
        const sentRecords = articles.map(a => ({
          subscriber_id: sub.id,
          article_id: a.id,
          digest_batch: batchId,
        }));

        await supabase
          .from("digest_sent_articles")
          .upsert(sentRecords, { onConflict: "subscriber_id,article_id", ignoreDuplicates: false });

        // Update last_sent_at
        await supabase
          .from("digest_subscribers")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", sub.id);

        sent++;
        console.log(`✓ Sent digest to ${sub.email} (${articles.length} articles, batch: ${batchId})`);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${sub.email}: ${msg}`);
        console.error(`✗ Failed for ${sub.email}:`, msg);
      }
    }

    const result = { sent, failed, total: subscribers.length, errors };
    console.log("Digest run complete:", JSON.stringify(result));
    return jsonResponse(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fatal error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────

async function getSubscriberArticles(
  supabase: ReturnType<typeof createClient>,
  feedToken: string | null
): Promise<Article[]> {
  // Try the personalized feed RPC first (requires feed_token + user_interests)
  if (feedToken) {
    try {
      const { data, error } = await supabase.rpc("get_subscriber_feed", {
        p_token: feedToken,
        p_limit: 8,
      });

      if (!error && data && data.error !== "not_found") {
        const articles = data.articles;
        if (Array.isArray(articles) && articles.length > 0) {
          return articles.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            headline: a.headline as string,
            publication: a.publication as string,
            published_at: a.published_at as string,
            ai_preview: a.ai_preview as string,
            consensus_signal: a.consensus_signal as string,
            extracted_tickers: (a.extracted_tickers ?? []) as string[],
            inference_watch: (a.inference_watch ?? []) as string[],
          }));
        }
      }
    } catch (err) {
      console.warn("Personalized feed failed, falling back to latest articles:", err);
    }
  }

  // Fallback: fetch latest articles for subscribers with no feed_token or no interests
  console.log("Using fallback: fetching latest articles");
  const { data: latestArticles, error: latestError } = await supabase
    .from("ai_articles")
    .select("id, headline, publication, published_at, ai_preview, consensus_signal, extracted_tickers, inference_watch")
    .gt("published_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("published_at", { ascending: false })
    .limit(8);

  if (latestError || !latestArticles) return [];

  return latestArticles.map((a: Record<string, unknown>) => ({
    id: a.id as string,
    headline: a.headline as string,
    publication: a.publication as string,
    published_at: a.published_at as string,
    ai_preview: a.ai_preview as string,
    consensus_signal: a.consensus_signal as string,
    extracted_tickers: (a.extracted_tickers ?? []) as string[],
    inference_watch: (a.inference_watch ?? []) as string[],
  }));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatArticleTime(dateStr: string, timezone: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      timeZone: timezone || "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

// ─── Email template ──────────────────────────────────────────────────

function renderDigestEmail(
  articles: Article[],
  userTickers: string[],
  subscriber: Subscriber,
): string {
  const feedUrl = `${SITE_BASE_URL}?t=${subscriber.feed_token}`;
  const unsubUrl = `${SITE_BASE_URL}/unsubscribe?token=${subscriber.unsubscribe_token}`;

  const articleCards = articles
    .map((article) => renderArticleCard(article, userTickers, subscriber.timezone, subscriber.feed_token))
    .join("");

  return renderEmailLayout({
    feedUrl,
    unsubUrl,
    title: "Finnopolis",
    subheader: `${formatDate(new Date())} · Your morning brief`,
    body: articleCards,
  });
}

function renderArticleCard(
  article: Article,
  userTickers: string[],
  timezone: string,
  feedToken: string | null,
): string {
  const tokenParam = feedToken ? `&t=${feedToken}` : "";
  const url = `${TRACK_CLICK_URL}?a=${article.id}${tokenParam}`;
  const color = signalColor(article.consensus_signal);
  const bg = signalBg(article.consensus_signal);

  const tickerHtml = (article.extracted_tickers || [])
    .slice(0, 4)
    .map((t) => {
      const isUserTicker = userTickers.includes(t);
      const style = isUserTicker
        ? "display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-family:monospace;background:#1e3a5f;color:#60a5fa;border:1px solid #3b82f6;"
        : "display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-family:monospace;background:#1f2937;color:#9ca3af;border:1px solid #374151;";
      return `<span style="${style}">${t}</span>`;
    })
    .join(" ");

  const watchItem = (article.inference_watch && article.inference_watch.length > 0)
    ? article.inference_watch[0]
    : null;

  return `
    <div style="background:#152638;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;margin-bottom:16px;">
      <div style="font-size:12px;color:#6b7280;font-family:monospace;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">
        ${article.publication ? `${escapeHtml(article.publication)} &#183; ` : ""}${formatArticleTime(article.published_at, timezone)}
      </div>
      <a href="${url}" style="color:#ffffff;text-decoration:none;font-size:18px;font-weight:500;line-height:1.4;display:block;margin-bottom:10px;">
        ${escapeHtml(article.headline)}
      </a>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 14px 0;">
        ${escapeHtml(article.ai_preview)}
      </p>
      ${watchItem ? `
      <div style="background:#1a1a2e;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:14px;">
        <div style="font-size:11px;color:#f59e0b;font-family:monospace;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">What to watch</div>
        <div style="font-size:13px;color:#d1d5db;line-height:1.5;">${escapeHtml(watchItem)}</div>
      </div>
      ` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>${tickerHtml}</div>
        <span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-family:monospace;background:${bg};color:${color};border:1px solid ${color}40;">
          ${article.consensus_signal}
        </span>
      </div>
    </div>
  `;
}
