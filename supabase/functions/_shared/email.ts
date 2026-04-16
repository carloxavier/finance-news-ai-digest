// Shared chrome + utilities for Finnopolis transactional emails.
// Anything in this file applies to BOTH send-welcome and send-digest.
// See ../CLAUDE.md for alignment notes.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

export const SITE_BASE_URL = "https://finnopolis.com";
export const FROM_EMAIL = "Finnopolis <digest@finnopolis.com>";
export const REPLY_TO = "carlo@finnopolis.com";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function signalColor(signal: string | null | undefined): string {
  return signal === "BUY" ? "#22c55e" :
    signal === "SELL" ? "#ef4444" :
    signal === "MIXED" ? "#eab308" : "#6b7280";
}

export function signalBg(signal: string | null | undefined): string {
  return signal === "BUY" ? "#052e16" :
    signal === "SELL" ? "#450a0a" :
    signal === "MIXED" ? "#422006" : "#1f2937";
}

export interface EmailLayoutOptions {
  feedUrl: string;
  unsubUrl: string;
  title: string;
  body: string;
  subheader?: string;
}

export function renderEmailLayout({
  feedUrl,
  unsubUrl,
  title,
  body,
  subheader,
}: EmailLayoutOptions): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0d1b2a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    ${renderHeader(feedUrl, subheader)}
    ${body}
    ${renderCta(feedUrl)}
    ${renderFooter(unsubUrl)}
  </div>
</body>
</html>`.trim();
}

function renderHeader(feedUrl: string, subheader?: string): string {
  return `
    <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <a href="${feedUrl}" style="color:#ffffff;text-decoration:none;">
        <h1 style="margin:0;font-size:28px;font-weight:400;letter-spacing:-0.5px;">Finnopolis</h1>
      </a>
      ${subheader ? `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(subheader)}</p>` : ""}
    </div>`;
}

function renderCta(feedUrl: string): string {
  return `
    <div style="text-align:center;margin:32px 0;">
      <a href="${feedUrl}" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;">
        Open Finnopolis &#8594;
      </a>
    </div>`;
}

function renderFooter(unsubUrl: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:32px 24px 24px;border-top:1px solid rgba(255,255,255,0.1);">
      <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 12px;"><strong>Finnopolis</strong> &#8212; AI-curated financial intelligence.</p>
      <p style="font-size:11px;color:#6b7280;line-height:1.5;margin:0 0 12px;">
        Finnopolis is for informational purposes only. Nothing here constitutes investment advice, a recommendation, or a solicitation to buy or sell any security.
      </p>
      <p style="font-size:11px;color:#9ca3af;margin:0 0 8px;">
        <a href="${SITE_BASE_URL}/privacy" style="color:#9ca3af;">Privacy Policy</a> &#183;
        <a href="${SITE_BASE_URL}/terms" style="color:#9ca3af;">Terms</a> &#183;
        <a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a></p>
      <p style="font-size:11px;color:#9ca3af;margin:0;">This is a notification from your Finnopolis account. &#169; 2026 Finnopolis.</p>
    </td></tr></table>`;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  batchId?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  batchId,
}: SendEmailOptions): Promise<void> {
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
