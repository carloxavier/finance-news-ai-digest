import { Link } from "react-router";

export function Privacy() {
  return (
    <div className="min-h-screen px-6 py-12" style={{ background: "var(--navy-bg)" }}>
      <div className="max-w-[640px] mx-auto">
        <Link
          to="/"
          className="text-sm no-underline transition-colors hover:text-white/80"
          style={{ color: "var(--layer1-blue)" }}
        >
          &larr; Back to home
        </Link>

        <h1
          className="text-[28px] font-normal text-white mt-8 mb-2"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-[13px] text-white/30 mb-10">Effective: April 6, 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-white/50" style={{ fontFamily: "var(--font-body)" }}>
          <div>
            <h2 className="text-[18px] font-semibold text-white mb-3">What we collect</h2>
            <p className="mb-2">When you use Finnopolis we store:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>An anonymous browser identifier (random UUID, stored in your browser only)</li>
              <li>Your selected topics and stock tickers</li>
              <li>Your email address if you register</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-white mb-3">How we use it</h2>
            <p>
              We use your data solely to personalise your financial news feed and deliver the email digest you signed up
              for. We do not sell, rent, or share your data with third parties.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-white mb-3">Email</h2>
            <p>
              Digest emails are sent via Resend. Every email includes a one-click unsubscribe link. We honour
              unsubscribe requests immediately.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-white mb-3">Cookies &amp; storage</h2>
            <p>
              We use browser localStorage to remember your preferences. We do not use tracking cookies or third-party
              analytics.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-white mb-3">Data retention</h2>
            <p>
              We retain your subscription data for as long as your account is active. After unsubscribing, your email is
              marked inactive but retained for 90 days to prevent accidental re-sends, then permanently deleted.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-white mb-3">Your rights</h2>
            <p>
              You can request access to, correction of, or deletion of your data at any time by emailing{" "}
              <a href="mailto:carlo@finnopolis.com" className="no-underline hover:underline" style={{ color: "var(--layer1-blue)" }}>
                carlo@finnopolis.com
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:carlo@finnopolis.com" className="no-underline hover:underline" style={{ color: "var(--layer1-blue)" }}>
                carlo@finnopolis.com
              </a>.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 text-[12px] text-white/20" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <Link to="/" className="no-underline hover:underline mr-3" style={{ color: "var(--layer1-blue)" }}>
            Back to Finnopolis
          </Link>
          &middot;
          <Link to="/terms" className="no-underline hover:underline ml-3" style={{ color: "var(--layer1-blue)" }}>
            Terms of Service
          </Link>
          <p className="mt-2">&copy; 2026 Finnopolis</p>
        </div>
      </div>
    </div>
  );
}
