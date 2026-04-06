// digest-webhook Edge Function
// Receives Resend webhook POSTs for email.delivered, email.opened, etc.
// Maps events to rows in email_events table.
// Deployed with verify_jwt=false (Resend webhook endpoint)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Map Resend event types to our simplified types
const EVENT_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
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
