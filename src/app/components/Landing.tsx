import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { getUserId, setOnboardingComplete } from "../utils/userId";
import {
  saveDigestSubscription,
  EmailAlreadyRegisteredError,
  triggerWelcomeEmail,
  getPublicPreview,
  formatArticleDate,
  type Article,
} from "../utils/supabase";
import "../../styles/landing.css";

const TIMEZONES = [
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Chicago", label: "US Central" },
  { value: "America/Denver", label: "US Mountain" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "America/Anchorage", label: "US Alaska" },
  { value: "Pacific/Honolulu", label: "US Hawaii" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [navScrolled, setNavScrolled] = useState(false);

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState(
    TIMEZONES.find((tz) => tz.value === detectedTz)?.value || "America/Chicago"
  );
  const signupSource =
    new URLSearchParams(window.location.search).get("ref") || "direct";

  // Nav scroll shadow
  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Scroll reveal observer
  useEffect(() => {
    const els = document.querySelectorAll(".landing-reveal");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Auto-redirect to the app shell after successful signup
  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => navigate("/feed"), 1500);
      return () => clearTimeout(t);
    }
  }, [submitted, navigate]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const userId = getUserId();
      const subscriber = await saveDigestSubscription(userId, email, "daily", timezone, signupSource);
      if (subscriber?.id) {
        triggerWelcomeEmail(subscriber.id);
      }
      // Mark onboarding complete so Feed route guard passes; inline welcome card
      // will handle topic selection for users who land on /feed without interests.
      setOnboardingComplete();
      setSubmitted(true);
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        setError("This email is already registered. Try a different one or check your inbox for your existing digest.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="landing-page min-h-screen" style={{ background: "var(--navy-bg)" }}>
      {/* ── NAV ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 backdrop-blur-xl border-b transition-shadow ${navScrolled ? "shadow-[0_1px_24px_rgba(0,0,0,0.3)]" : ""}`}
        style={{
          background: "rgba(13, 27, 42, 0.85)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="no-underline text-[1.5rem] tracking-tight"
          style={{ fontFamily: "var(--font-headline)", color: "var(--foreground)" }}
        >
          Finno<span style={{ color: "var(--citation-blue)" }}>polis</span>
        </a>
        <div className="flex items-center gap-6">
          <a href="#how" className="landing-nav-link text-[0.82rem] text-white/40 no-underline hover:text-white/80 transition-colors">
            How It Works
          </a>
          <a href="#why" className="landing-nav-link text-[0.82rem] text-white/40 no-underline hover:text-white/80 transition-colors">
            Why Us
          </a>
          <a
            href="#signup"
            className="text-[0.8rem] font-semibold uppercase tracking-widest px-5 py-2 rounded-md no-underline text-white transition-all hover:-translate-y-px"
            style={{ background: "var(--layer1-blue)" }}
          >
            Get In
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="landing-hero relative overflow-hidden min-h-screen items-center gap-16 px-[8vw] pt-[120px] pb-20"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
      >
        <div>
          {/* Pill */}
          <div
            className="landing-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[0.75rem] font-medium mb-6"
            style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.3)",
              color: "var(--citation-blue)",
            }}
          >
            <span className="landing-pill-dot w-1.5 h-1.5 rounded-full bg-green-500" />
            Now in early access
          </div>

          {/* Title */}
          <h1
            className="landing-hero-title text-[clamp(2.8rem,5vw,4.5rem)] leading-[1.08] tracking-tight font-normal mb-5"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            Financial intelligence, <em className="italic" style={{ color: "var(--citation-blue)" }}>without</em> the noise
          </h1>

          {/* Description */}
          <p className="landing-hero-desc text-white/40 text-lg max-w-[420px] mb-8 leading-relaxed">
            Get the signals that actually move your portfolio — curated, cited, delivered directly to you.
          </p>

          {/* CTAs */}
          <div className="landing-hero-ctas flex gap-3 items-center flex-wrap">
            <a
              href="#signup"
              className="px-7 py-3.5 text-[0.85rem] font-semibold uppercase tracking-wide rounded-md text-white no-underline transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(59,130,246,0.3)]"
              style={{ background: "var(--layer1-blue)" }}
            >
              Get In
            </a>
            <a
              href="#how"
              className="px-7 py-3.5 text-[0.85rem] font-medium text-white/40 rounded-md no-underline transition-all hover:text-white/80"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              See How It Works
            </a>
          </div>

          {/* Explore feed link */}
          <Link
            to="/explore"
            className="text-sm text-white/30 hover:text-white/60 transition-colors mt-3 inline-block no-underline"
          >
            Or explore the app &rarr;
          </Link>

          {/* Social proof */}
          <p className="landing-hero-proof text-[0.78rem] text-white/40 mt-6">
            <span className="text-green-500 font-semibold">&#10003; Free during beta</span>
            &nbsp;&middot;&nbsp; No spam &nbsp;&middot;&nbsp; Cancel anytime
          </p>
        </div>

        {/* Demo card */}
        <div className="landing-hero-right">
          <DemoCard />
        </div>
      </section>

      {/* ── TICKER STRIP ── */}
      <TickerStrip />

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="landing-reveal py-[100px] px-[8vw]">
        <div
          className="text-[0.7rem] uppercase tracking-[0.12em] mb-4 opacity-80"
          style={{ fontFamily: "var(--font-mono)", color: "var(--layer1-blue)" }}
        >
          How It Works
        </div>
        <h2
          className="text-[clamp(2rem,4vw,3.2rem)] font-normal leading-tight tracking-tight mb-4"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Three minutes. Zero noise.
        </h2>
        <p className="text-white/40 text-base max-w-[500px] leading-relaxed">
          No algorithms optimizing for rage-clicks. No paywalled fluff. Every claim is cited, every inference is labeled.
        </p>

        <div className="landing-how-grid grid grid-cols-3 gap-8 mt-16 max-md:grid-cols-1">
          <HowCard
            num="01"
            icon="&#128225;"
            title="AI scans 50+ sources"
            desc="Reuters, Bloomberg, WSJ, FT, and specialist outlets. Thousands of articles ingested and deduplicated daily."
          />
          <HowCard
            num="02"
            icon="&#129504;"
            title="Filters the signal"
            desc="Duplicates, clickbait, and noise are eliminated. Only market-moving stories across your chosen topics survive."
          />
          <HowCard
            num="03"
            icon="&#128236;"
            title="Cited & delivered by 7 AM"
            descHtml={
              <>Every fact gets a <CitationMark n={1} /> citation. Every AI inference is labeled. Wake up informed, not misled.</>
            }
          />
        </div>
      </section>

      {/* ── WHY FINNOPOLIS ── */}
      <section id="why" className="landing-reveal py-[100px] px-[8vw]">
        <div
          className="text-[0.7rem] uppercase tracking-[0.12em] mb-4 opacity-80"
          style={{ fontFamily: "var(--font-mono)", color: "var(--layer1-blue)" }}
        >
          Why Finnopolis
        </div>
        <p className="text-white/40 text-base max-w-[500px] leading-relaxed">
          Most financial tools are one person's opinion. Finnopolis synthesizes the entire market and shows its work.
        </p>

        <div
          className="landing-why-grid rounded-xl overflow-hidden mt-16"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="landing-why-grid-inner grid grid-cols-3">
            <WhyCell
              iconColor="rgba(59,130,246,0.1)"
              icon="&#128269;"
              label="Transparency"
              title="Every claim is traceable"
              desc="Inline citations link back to original sources. AI inferences are clearly separated from verified facts."
            />
            <WhyCell
              iconColor="rgba(34,197,94,0.1)"
              icon="&#127919;"
              label="Personalization"
              title="Topics you choose"
              desc="Follow Fed policy, crypto, AI semiconductors, or ESG. Your digest matches your portfolio focus."
            />
            <WhyCell
              iconColor="rgba(245,158,11,0.1)"
              icon="&#9889;"
              label="Speed"
              title="3 minutes, not 30"
              desc="No padding, no filler. Concise briefs with analyst data and consensus signals — read it with your coffee."
            />
          </div>
        </div>
      </section>

      {/* ── LIVE PREVIEW ── */}
      <LivePreview />

      {/* ── CTA ── */}
      <section
        id="signup"
        className="landing-cta relative overflow-hidden text-center py-[100px] px-[8vw]"
        style={{ background: "linear-gradient(180deg, var(--navy-bg) 0%, #0d1424 100%)" }}
      >
        <div className="landing-reveal relative">
          <div
            className="text-[0.7rem] uppercase tracking-[0.12em] mb-4 opacity-80 text-center"
            style={{ fontFamily: "var(--font-mono)", color: "var(--layer1-blue)" }}
          >
            Start Tomorrow
          </div>
          <h2
            className="text-[clamp(2rem,4vw,3.5rem)] font-normal tracking-tight mb-3"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            Your morning briefing, <em className="italic" style={{ color: "var(--citation-blue)" }}>reimagined</em>
          </h2>
          <p className="text-white/40 text-base mb-8 max-w-[480px] mx-auto">
            Join early access. It's free during the beta — we'll earn your membership later.
          </p>

          {/* Signup form */}
          <form onSubmit={handleSignup} className="landing-signup-form flex gap-3 max-w-[560px] mx-auto flex-wrap justify-center">
            <input
              type="email"
              placeholder="you@example.com"
              required
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitted}
              className="flex-1 min-w-[200px] px-5 py-3.5 rounded-md text-[0.95rem] text-white outline-none transition-colors placeholder:text-white/20"
              style={{
                fontFamily: "var(--font-body)",
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--layer1-blue)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={submitted}
              aria-label="Timezone"
              className="px-3 py-3.5 rounded-md text-[0.82rem] text-white/70 outline-none"
              style={{
                fontFamily: "var(--font-body)",
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.1)",
                maxWidth: "140px",
              }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting || submitted}
              className="px-7 py-3.5 text-[0.85rem] font-semibold uppercase tracking-wide rounded-md text-white border-none cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(59,130,246,0.3)] whitespace-nowrap disabled:cursor-not-allowed"
              style={{ background: submitted ? "#22c55e" : "var(--layer1-blue)" }}
            >
              {submitting ? "Getting you in..." : submitted ? "You're in! Opening Finnopolis..." : "Get In"}
            </button>
          </form>
          <p className="text-[0.72rem] text-white/30 mt-3">
            Your morning brief arrives at 7:30 AM in your timezone.
          </p>

          {error && (
            <p className="text-red-400 text-sm mt-3">{error}</p>
          )}

          {/* Guarantees */}
          <div className="landing-guarantees flex justify-center gap-8 mt-6 flex-wrap">
            <Guarantee text="Free during beta" />
            <Guarantee text="No credit card" />
            <Guarantee text="Cancel anytime" />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="landing-footer flex items-center justify-between flex-wrap gap-4 px-[8vw] py-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="text-[0.9rem] text-white/40" style={{ fontFamily: "var(--font-headline)" }}>
          Finno<span style={{ color: "var(--citation-blue)" }}>polis</span>
        </div>
        <div className="flex gap-6">
          <Link to="/privacy" className="text-[0.78rem] text-white/40 no-underline hover:text-white/80 transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="text-[0.78rem] text-white/40 no-underline hover:text-white/80 transition-colors">
            Terms
          </Link>
          <a href="mailto:carlo@finnopolis.com" className="text-[0.78rem] text-white/40 no-underline hover:text-white/80 transition-colors">
            Contact
          </a>
        </div>
        <div className="text-[0.72rem] text-white/20">
          &copy; 2026 Finnopolis. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function CitationMark({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-[18px] h-[18px] rounded text-[0.6rem] font-semibold align-middle mx-px"
      style={{
        fontFamily: "var(--font-mono)",
        background: "rgba(59,130,246,0.15)",
        border: "1px solid rgba(59,130,246,0.4)",
        color: "var(--citation-blue)",
      }}
    >
      {n}
    </span>
  );
}

function DemoCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.4)",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-4 px-6 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        </div>
        <div className="ml-auto text-[0.7rem] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          finnopolis.com/digest
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        <DemoArticle
          topic="Federal Reserve"
          headline={<>Fed Holds Rates Steady, Signals Patience Into Q3 <CitationMark n={1} /><CitationMark n={2} /></>}
          summary="The FOMC kept its benchmark rate unchanged at 5.25-5.50%, emphasizing data dependency. Markets now price a September cut as the earliest possibility."
          sources={3}
          signal="Bullish signal"
          signalColor="green"
          isLast={false}
        />
        <DemoArticle
          topic="AI & Semiconductors"
          headline={<>NVIDIA Unveils Next-Gen Architecture, Stock Surges 8% <CitationMark n={1} /></>}
          summary="The latest GPU platform promises 3x inference throughput, triggering a broad rally across AI infrastructure names."
          sources={5}
          signal="Strong buy"
          signalColor="green"
          isLast={false}
        />
        <DemoArticle
          topic="Crypto & DeFi"
          headline={<>Bitcoin ETF Inflows Hit Record $1.2B Single Day <CitationMark n={1} /><CitationMark n={2} /><CitationMark n={3} /></>}
          summary="Institutional appetite for spot Bitcoin ETFs accelerates, with BlackRock's IBIT leading as BTC nears ATH."
          sources={4}
          signal="Hold"
          signalColor="amber"
          isLast
        />
      </div>
    </div>
  );
}

function DemoArticle({
  topic,
  headline,
  summary,
  sources,
  signal,
  signalColor,
  isLast,
}: {
  topic: string;
  headline: React.ReactNode;
  summary: string;
  sources: number;
  signal: string;
  signalColor: "green" | "amber";
  isLast: boolean;
}) {
  const signalStyles =
    signalColor === "green"
      ? { background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }
      : { background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" };

  const arrow = signalColor === "green" ? "\u25B2" : "\u25B6";

  return (
    <div
      className={isLast ? "" : "mb-5 pb-5"}
      style={isLast ? undefined : { borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="text-[0.6rem] uppercase tracking-[0.18em] mb-1.5"
        style={{ fontFamily: "var(--font-mono)", color: "var(--citation-blue)" }}
      >
        {topic}
      </div>
      <div className="text-[1.05rem] leading-snug mb-1.5" style={{ fontFamily: "var(--font-headline)" }}>
        {headline}
      </div>
      <div className="text-[0.78rem] text-white/40 leading-relaxed mb-2">
        {summary}
      </div>
      <div className="flex gap-3 items-center">
        <span
          className="text-[0.6rem] px-2 py-0.5 rounded"
          style={{
            fontFamily: "var(--font-mono)",
            background: "rgba(59,130,246,0.1)",
            color: "var(--citation-blue)",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          {sources} sources
        </span>
        <span
          className="text-[0.6rem] px-2 py-0.5 rounded"
          style={{ fontFamily: "var(--font-mono)", ...signalStyles }}
        >
          {arrow} {signal}
        </span>
      </div>
    </div>
  );
}

function TickerStrip() {
  const items = [
    { label: "FED POLICY", dir: "up" },
    { label: "AI & SEMICONDUCTORS", dir: "up" },
    { label: "CRYPTO & DEFI", dir: "up" },
    { label: "COMMODITIES", dir: "down" },
    { label: "EMERGING MARKETS", dir: "up" },
    { label: "FINTECH", dir: "up" },
    { label: "REAL ESTATE", dir: "down" },
    { label: "ESG INVESTING", dir: "up" },
    { label: "ETFs & INDEX FUNDS", dir: "up" },
    { label: "EARNINGS SEASON", dir: "down" },
  ];
  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      className="overflow-hidden py-3"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "#111827",
      }}
    >
      <div className="landing-ticker-content flex gap-12 whitespace-nowrap w-max">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-2 text-[0.72rem] tracking-wide text-white/40"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {item.label}
            <span className={item.dir === "up" ? "text-green-500" : "text-red-500"}>
              {item.dir === "up" ? "\u25B2" : "\u25BC"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function HowCard({
  num,
  icon,
  title,
  desc,
  descHtml,
}: {
  num: string;
  icon: string;
  title: string;
  desc?: string;
  descHtml?: React.ReactNode;
}) {
  return (
    <div
      className="landing-how-card rounded-xl p-8 relative overflow-hidden"
      style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="text-[0.7rem] text-white/30 mb-4" style={{ fontFamily: "var(--font-mono)", color: "var(--layer1-blue)" }}>
        {num}
      </div>
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center text-lg mb-5"
        style={{
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.15)",
        }}
      >
        <span dangerouslySetInnerHTML={{ __html: icon }} />
      </div>
      <h3 className="text-[1.25rem] font-normal mb-2.5" style={{ fontFamily: "var(--font-headline)" }}>
        {title}
      </h3>
      <p className="text-[0.85rem] text-white/40 leading-relaxed">
        {descHtml ?? desc}
      </p>
    </div>
  );
}

function WhyCell({
  iconColor,
  icon,
  label,
  title,
  desc,
}: {
  iconColor: string;
  icon: string;
  label: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="landing-why-cell p-8" style={{ background: "var(--navy-bg)" }}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[0.95rem] mb-5"
        style={{ background: iconColor }}
      >
        <span dangerouslySetInnerHTML={{ __html: icon }} />
      </div>
      <div
        className="text-[0.6rem] uppercase tracking-[0.15em] mb-2.5"
        style={{ fontFamily: "var(--font-mono)", color: "var(--layer1-blue)" }}
      >
        {label}
      </div>
      <h3 className="text-[0.95rem] font-medium mb-2">{title}</h3>
      <p className="text-[0.82rem] text-white/40 leading-relaxed">{desc}</p>
    </div>
  );
}

function Guarantee({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[0.78rem] text-white/40">
      <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {text}
    </div>
  );
}

/* ── Live preview (S2.1 / S2.2) ── */

const PREVIEW_TABS: Array<{ label: string; slug: string | null }> = [
  { label: "All", slug: null },
  { label: "Macro & Fed", slug: "macro" },
  { label: "Technology", slug: "technology" },
  { label: "Financials", slug: "financials" },
  { label: "Energy", slug: "energy" },
  { label: "Biotech", slug: "biotech" },
  { label: "Regulation", slug: "regulation" },
  { label: "Geopolitics", slug: "geopolitics" },
];

function LivePreview() {
  const [activeLabel, setActiveLabel] = useState<string>("All");
  const [cache, setCache] = useState<Record<string, Article[]>>({});
  const [loadingTab, setLoadingTab] = useState<string | null>("All");

  useEffect(() => {
    if (cache[activeLabel] !== undefined) {
      setLoadingTab(null);
      return;
    }
    const tab = PREVIEW_TABS.find((t) => t.label === activeLabel);
    if (!tab) return;
    let cancelled = false;
    setLoadingTab(activeLabel);
    getPublicPreview(tab.slug)
      .then((articles) => {
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [activeLabel]: articles.slice(0, 5) }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[LivePreview] failed to load:", err);
        setCache((prev) => ({ ...prev, [activeLabel]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingTab(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLabel, cache]);

  const articles = cache[activeLabel] ?? [];
  const isLoading = loadingTab === activeLabel;

  return (
    <section className="landing-reveal py-[100px] px-[8vw]">
      <div
        className="text-[0.7rem] uppercase tracking-[0.12em] mb-4 opacity-80"
        style={{ fontFamily: "var(--font-mono)", color: "var(--layer1-blue)" }}
      >
        Live preview
      </div>
      <h2
        className="text-[clamp(2rem,4vw,3.2rem)] font-normal leading-tight tracking-tight mb-4"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        See what members are reading right now
      </h2>
      <p className="text-white/40 text-base max-w-[500px] leading-relaxed mb-10">
        A live sample of the briefs Finnopolis is publishing today, straight from the platform. Pick a topic to filter.
      </p>

      {/* Tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-3 mb-6"
        style={{ scrollbarWidth: "none" }}
      >
        {PREVIEW_TABS.map((tab) => {
          const selected = activeLabel === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveLabel(tab.label)}
              className={`px-3.5 py-1.5 text-[0.8rem] font-medium whitespace-nowrap rounded-full border transition-all ${
                selected
                  ? "text-white bg-white/10 border-white/15"
                  : "text-white/45 bg-transparent border-white/10 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="grid gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <PreviewSkeleton key={i} />
            ))
          : articles.length === 0
          ? (
              <div className="text-center py-12 text-white/40 text-sm">
                No briefs available for this topic right now.
              </div>
            )
          : articles.map((article) => (
              <PreviewCard key={article.id || article.headline} article={article} />
            ))}
      </div>
    </section>
  );
}

function PreviewSkeleton() {
  return (
    <div
      className="rounded-xl p-6 animate-pulse"
      style={{
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="h-3 w-32 bg-white/10 rounded mb-4" />
      <div className="h-6 w-3/4 bg-white/15 rounded mb-3" />
      <div className="h-4 w-full bg-white/10 rounded mb-2" />
      <div className="h-4 w-5/6 bg-white/10 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-white/10 rounded-full" />
        <div className="h-6 w-12 bg-white/10 rounded" />
      </div>
    </div>
  );
}

function signalBadgeStyle(signal: string): React.CSSProperties {
  switch (signal) {
    case "BUY":
      return {
        background: "rgba(34,197,94,0.1)",
        color: "#22c55e",
        border: "1px solid rgba(34,197,94,0.3)",
      };
    case "SELL":
      return {
        background: "rgba(239,68,68,0.1)",
        color: "#f87171",
        border: "1px solid rgba(239,68,68,0.3)",
      };
    case "MIXED":
      return {
        background: "rgba(245,158,11,0.1)",
        color: "#f59e0b",
        border: "1px solid rgba(245,158,11,0.3)",
      };
    case "WATCH":
      return {
        background: "rgba(59,130,246,0.1)",
        color: "#3b82f6",
        border: "1px solid rgba(59,130,246,0.3)",
      };
    default:
      return {
        background: "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.5)",
        border: "1px solid rgba(255,255,255,0.1)",
      };
  }
}

function PreviewCard({ article }: { article: Article }) {
  const tickers = article.extracted_tickers ?? [];
  return (
    <div
      className="rounded-xl p-6 transition-colors"
      style={{
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {article.publication && (
          <>
            <span
              className="text-[0.7rem] uppercase tracking-[0.12em] text-white/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {article.publication}
            </span>
            <span className="text-xs text-white/30">•</span>
          </>
        )}
        <span className="text-xs text-white/40">
          {formatArticleDate(article.published_at)}
        </span>
      </div>

      <h3
        className="text-[1.4rem] leading-snug mb-3"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        {article.headline}
      </h3>

      <p className="text-white/60 text-[0.92rem] leading-relaxed mb-4 line-clamp-3">
        {article.ai_preview}
      </p>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          {tickers.slice(0, 4).map((ticker) => (
            <span
              key={ticker}
              className="px-2 py-1 text-[0.7rem] rounded"
              style={{
                fontFamily: "var(--font-mono)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {ticker}
            </span>
          ))}
          {tickers.length > 4 && (
            <span className="px-2 py-1 text-[0.7rem] text-white/40">
              +{tickers.length - 4} more
            </span>
          )}
        </div>
        <span
          className="px-3 py-1 rounded-full text-[0.7rem]"
          style={{ fontFamily: "var(--font-mono)", ...signalBadgeStyle(article.consensus_signal) }}
        >
          {article.consensus_signal || "NO_RATING"}
        </span>
      </div>
    </div>
  );
}
