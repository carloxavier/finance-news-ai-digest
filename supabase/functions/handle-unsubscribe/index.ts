// handle-unsubscribe Edge Function
// GET ?token={unsubscribe_token} → deactivate subscriber → show confirmation HTML
// Deployed with verify_jwt=false (public endpoint)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_BASE_URL = "https://finnopolis.com";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return htmlResponse(errorPage("Missing unsubscribe token."), 400);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up the subscriber
    const { data: subscriber, error: fetchError } = await supabase
      .from("digest_subscribers")
      .select("id, email, is_active")
      .eq("unsubscribe_token", token)
      .single();

    if (fetchError || !subscriber) {
      return htmlResponse(errorPage("Invalid or expired unsubscribe link."), 404);
    }

    if (!subscriber.is_active) {
      return htmlResponse(successPage(subscriber.email, true));
    }

    // Deactivate
    const { error: updateError } = await supabase
      .from("digest_subscribers")
      .update({ is_active: false })
      .eq("id", subscriber.id);

    if (updateError) {
      console.error("Failed to unsubscribe:", updateError);
      return htmlResponse(errorPage("Something went wrong. Please try again."), 500);
    }

    console.log(`Unsubscribed: ${subscriber.email}`);
    return htmlResponse(successPage(subscriber.email, false));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Unsubscribe error:", msg);
    return htmlResponse(errorPage("Something went wrong. Please try again."), 500);
  }
});

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function successPage(email: string, alreadyUnsubscribed: boolean): string {
  const maskedEmail = maskEmail(email);
  const message = alreadyUnsubscribed
    ? `<strong>${maskedEmail}</strong> is already unsubscribed.`
    : `<strong>${maskedEmail}</strong> has been unsubscribed from the Finnopolis digest.`;

  return basePage(`
    <div style="text-align:center;padding:60px 24px;">
      <div style="font-size:48px;margin-bottom:24px;">✓</div>
      <h1 style="font-size:24px;font-weight:400;margin:0 0 16px;">Unsubscribed</h1>
      <p style="font-size:16px;color:#9ca3af;margin:0 0 32px;line-height:1.6;">${message}</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 32px;">You won't receive any more digest emails from us.</p>
      <a href="${SITE_BASE_URL}" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;">Back to Finnopolis</a>
    </div>
  `);
}

function errorPage(message: string): string {
  return basePage(`
    <div style="text-align:center;padding:60px 24px;">
      <div style="font-size:48px;margin-bottom:24px;">⚠</div>
      <h1 style="font-size:24px;font-weight:400;margin:0 0 16px;">Oops</h1>
      <p style="font-size:16px;color:#9ca3af;margin:0 0 32px;line-height:1.6;">${message}</p>
      <a href="${SITE_BASE_URL}" style="display:inline-block;padding:12px 32px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;">Back to Finnopolis</a>
    </div>
  `);
}

function basePage(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribe — Finnopolis</title>
</head>
<body style="margin:0;padding:0;background-color:#0d1b2a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:500px;margin:0 auto;">
    ${content}
    <div style="text-align:center;padding:24px;border-top:1px solid rgba(255,255,255,0.1);">
      <p style="font-size:11px;color:#4b5563;margin:0;">© 2026 Finnopolis</p>
    </div>
  </div>
</body>
</html>`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}
