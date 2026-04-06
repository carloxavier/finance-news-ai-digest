// digest-webhook Edge Function
// Receives Resend webhook POSTs for email.delivered, email.opened, etc.
// Maps events to rows in email_events table.
// Deployed with verify_jwt=false (Resend webhook endpoint)
// Signature verification via RESEND_WEBHOOK_SECRET (svix)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

// Map Resend event types to our simplified types
const EVENT_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

// ─── Signature verification (Resend uses Svix) ─────────────────────

async function verifySignature(body: string, headers: Headers): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // Skip if no secret configured

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Check timestamp is within 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(svixTimestamp, 10);
  if (Math.abs(now - ts) > 300) return false;

  // Resend/Svix signature: base64(HMAC-SHA256(secret, "{msg_id}.{timestamp}.{body}"))
  const secret = WEBHOOK_SECRET.startsWith("whsec_")
    ? WEBHOOK_SECRET.slice(6)
    : WEBHOOK_SECRET;
  const secretBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));

  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // svix-signature can contain multiple signatures separated by spaces (e.g. "v1,xxx v1,yyy")
  const signatures = svixSignature.split(" ");
  return signatures.some(sig => {
    const [, sigValue] = sig.split(",");
    return sigValue === expected;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();

    // Verify webhook signature
    if (!(await verifySignature(body, req.headers))) {
      console.warn("Invalid webhook signature — rejecting");
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(body);
    const eventType = EVENT_MAP[payload.type];

    if (!eventType) {
      console.log(`Ignoring untracked event type: ${payload.type}`);
      return new Response("OK", { status: 200 });
    }

    const email = payload.data?.to?.[0] ?? payload.data?.email;
    if (!email) {
      console.warn("No email found in webhook payload");
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up subscriber by email
    const { data: subscriber } = await supabase
      .from("digest_subscribers")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (!subscriber) {
      console.warn(`Subscriber not found for email: ${email}`);
      return new Response("OK", { status: 200 });
    }

    // Extract batch tag if present
    const tags = payload.data?.tags ?? [];
    const batchTag = tags.find((t: { name: string; value: string }) => t.name === "digest_batch");
    const digestBatch = batchTag?.value ?? null;

    // Insert event
    const { error } = await supabase.from("email_events").insert({
      subscriber_id: subscriber.id,
      digest_batch: digestBatch,
      event_type: eventType,
      occurred_at: payload.data?.created_at ?? new Date().toISOString(),
      raw_payload: payload,
    });

    if (error) {
      console.error("Failed to insert email event:", error.message);
      return new Response("Error", { status: 500 });
    }

    console.log(`Recorded ${eventType} event for ${email}${digestBatch ? ` (batch: ${digestBatch})` : ""}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook error:", msg);
    return new Response("Error", { status: 500 });
  }
});
