import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

const SUPABASE_URL = 'https://kamfamwjswkncftsdgxi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthbWZhbXdqc3drbmNmdHNkZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQ3NDgsImV4cCI6MjA4ODY4MDc0OH0.O8NasVjjajK-T18GppCjfljS_h30fNrPo3TgPJGmcEs';

type Status = "loading" | "success" | "already" | "invalid" | "error";

export function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("invalid");
      return;
    }

    (async () => {
      try {
        // Look up subscriber
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/digest_subscribers?unsubscribe_token=eq.${token}&select=id,email,is_active`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        if (!res.ok) { setStatus("error"); return; }
        const rows = await res.json();
        if (rows.length === 0) { setStatus("invalid"); return; }

        const sub = rows[0];
        if (!sub.is_active) { setStatus("already"); return; }

        // Deactivate
        const updateRes = await fetch(
          `${SUPABASE_URL}/rest/v1/digest_subscribers?id=eq.${sub.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ is_active: false }),
          }
        );
        setStatus(updateRes.ok ? "success" : "error");
      } catch {
        setStatus("error");
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {status === "loading" && (
          <p className="text-white/60">Processing...</p>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl mb-6">✓</div>
            <h1 className="text-2xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
              Unsubscribed
            </h1>
            <p className="text-white/60 mb-8">
              You've been unsubscribed from Finnopolis notifications. You won't receive any more emails from us.
            </p>
          </>
        )}
        {status === "already" && (
          <>
            <div className="text-4xl mb-6">✓</div>
            <h1 className="text-2xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
              Already unsubscribed
            </h1>
            <p className="text-white/60 mb-8">
              This email is already unsubscribed.
            </p>
          </>
        )}
        {status === "invalid" && (
          <>
            <div className="text-4xl mb-6">⚠</div>
            <h1 className="text-2xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
              Invalid link
            </h1>
            <p className="text-white/60 mb-8">
              This unsubscribe link is invalid or expired.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-6">⚠</div>
            <h1 className="text-2xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
              Something went wrong
            </h1>
            <p className="text-white/60 mb-8">
              Please try again or email carlo@finnopolis.com for help.
            </p>
          </>
        )}
        {status !== "loading" && (
          <a
            href="/"
            className="inline-block px-8 py-3 bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white rounded-lg transition-colors"
          >
            Back to Finnopolis
          </a>
        )}
      </div>
    </div>
  );
}
