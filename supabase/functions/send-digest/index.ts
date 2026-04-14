// send-digest Edge Function
// Triggered by pg_cron at 07:00 UTC daily
// Required secret: RESEND_API_KEY
// Deployed via Supabase MCP — this file is the local source of truth.

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SITE_BASE_URL = "https://finnopolis.com";
const TRACK_CLICK_URL = `${SUPABASE_URL}/functions/v1/track-click`;
const FROM_EMAIL = "Finnopolis <digest@finnopolis.com>";
const REPLY_TO = "carlo@finnopolis.com";

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

interface ArticleWithToken extends Article {
  clickToken: string;
}

// ─── Click token generator ──────────────────────────────────────────

function generateClickToken(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, c => c === '+' ? '-' : c === '/' ? '_' : '')
    .slice(0, 12);
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

        // Assign click tokens to each article
        const articlesWithTokens: ArticleWithToken[] = articles.map(a => ({
          ...a,
          clickToken: generateClickToken(),
        }));

        // Get their tickers for highlighting
        const { data: tickerRows } = await supabase
          .from("user_tickers")
          .select("ticker")
          .eq("user_id", sub.user_id);
        const userTickers = (tickerRows || []).map((r: { ticker: string }) => r.ticker);

        // Build and send email
        const html = renderDigestEmail(articlesWithTokens, userTickers, sub, sent + failed + 1);
        const subject = `📊 Your morning brief — ${formatDate(new Date())}`;

        await sendEmail(sub.email, subject, html, batchId);

        // Record sent articles with click tokens
        const sentRecords = articlesWithTokens.map(a => ({
          subscriber_id: sub.id,
          article_id: a.id,
          digest_batch: batchId,
          click_token: a.clickToken,
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

async function sendEmail(to: string, subject: string, html: string, batchId?: string): Promise<void> {
  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: [to],
    subject,
    html,
    reply_to: REPLY_TO,
  };

  if (batchId) {
    payload.tags = [{ name: "digest_batch", value: batchId }];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
  articles: ArticleWithToken[],
  userTickers: string[],
  subscriber: Subscriber,
  dayNumber: number
): string {
  const feedUrl = `${SITE_BASE_URL}?t=${subscriber.feed_token}`;

  const articleCards = articles
    .map((article) => {
      // Use tracked click URL for article links
      const url = `${TRACK_CLICK_URL}?t=${article.clickToken}`;

      const signalColor =
        article.consensus_signal === "BUY" ? "#22c55e" :
        article.consensus_signal === "SELL" ? "#ef4444" :
        article.consensus_signal === "MIXED" ? "#eab308" : "#6b7280";

      const signalBg =
        article.consensus_signal === "BUY" ? "#052e16" :
        article.consensus_signal === "SELL" ? "#450a0a" :
        article.consensus_signal === "MIXED" ? "#422006" : "#1f2937";

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
            ${article.publication} · ${formatArticleTime(article.published_at, subscriber.timezone)}
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
            <span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-family:monospace;background:${signalBg};color:${signalColor};border:1px solid ${signalColor}40;">
              ${article.consensus_signal}
            </span>
          </div>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Finnopolis</title>
</head>
<body style="margin:0;padding:0;background-color:#0d1b2a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <a href="${feedUrl}" style="color:#ffffff;text-decoration:none;">
        <h1 style="margin:0;font-size:28px;font-weight:400;letter-spacing:-0.5px;">Finnopolis</h1>
      </a>
      <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">
        ${formatDate(new Date())} · Your morning brief
      </p>
    </div>

    <!-- Articles -->
    ${articleCards}

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="${feedUrl}" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;">
        Open in Finnopolis →
      </a>
    </div>

    <!-- Footer -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:32px 24px 24px;border-top:1px solid #e5e7eb;">
      <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 12px;"><strong>Finnopolis</strong> — AI-curated financial intelligence.</p>
      <p style="font-size:11px;color:#9ca3af;margin:0 0 8px;">
        <a href="${SITE_BASE_URL}/privacy" style="color:#9ca3af;">Privacy Policy</a> ·
        <a href="${SITE_BASE_URL}/terms" style="color:#9ca3af;">Terms</a> ·
        <a href="${SITE_BASE_URL}/unsubscribe?token=${subscriber.unsubscribe_token}" style="color:#9ca3af;">Unsubscribe</a></p>
      <p style="font-size:11px;color:#9ca3af;margin:0;">You're receiving this because you signed up at finnopolis.com. © 2026 Finnopolis.</p>
    </td></tr></table>

  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
