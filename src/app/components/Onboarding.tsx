import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  getTopics,
  saveUserInterests,
  saveUserTickers,
  saveDigestSubscription,
  saveOnboardingSurvey,
  getSubscriberFeed,
  type Topic,
} from "../utils/supabase";
import { getUserId, hasCompletedOnboarding, setOnboardingComplete, setFeedToken } from "../utils/userId";
import { Check, ArrowLeft, ArrowRight, Mail, TrendingUp } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const DIMENSION_ORDER: Array<Topic["dimension"]> = ["industry", "theme"];
const DIMENSION_LABELS: Record<string, string> = {
  industry: "Industries",
  theme: "Themes",
  geography: "Regions",
};

const INVESTING_STYLES = [
  { value: "buy_and_hold", label: "Buy-and-Hold Investor", subtitle: "Long-term growth, focus on fundamentals" },
  { value: "active_trader", label: "Active Trader", subtitle: "Frequent trades, momentum and technicals" },
  { value: "passive_index", label: "Passive / Index Investor", subtitle: "ETFs, set-and-forget, low maintenance" },
  { value: "beginner", label: "Just Getting Started", subtitle: "Learning the ropes, building my first portfolio" },
];

const CONTENT_DENSITIES = [
  { value: "quick_hits", label: "Quick hits", subtitle: "Just the headlines and key takeaways. 2-3 min read." },
  { value: "essentials", label: "The essentials", subtitle: "The important stories with enough context to act on. 5-10 min read." },
  { value: "deep_coverage", label: "Deep coverage", subtitle: "Comprehensive analysis, multiple angles per story. 15+ min read." },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Shared state
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Investing style
  const [investingStyle, setInvestingStyle] = useState<string | null>(null);

  // Step 2 — Content density
  const [contentDensity, setContentDensity] = useState<string | null>(null);

  // Step 3 — Topics
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Step 4 — Tickers + Email
  const [tickerInput, setTickerInput] = useState("");
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    // Check for feed token from email link
    const feedToken = searchParams.get("t");
    if (feedToken) {
      getSubscriberFeed(feedToken).then((feed) => {
        if (feed) {
          setFeedToken(feedToken);
          setOnboardingComplete();
          navigate("/feed");
        } else {
          // Invalid token — fall through to normal onboarding
          loadTopics();
        }
      }).catch(() => loadTopics());
      return;
    }

    if (hasCompletedOnboarding()) {
      navigate("/feed");
      return;
    }

    loadTopics();
  }, [navigate, searchParams]);

  function loadTopics() {
    getTopics()
      .then(setTopics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  // --- Helpers ---

  const toggleTopic = (topicId: string) => {
    const next = new Set(selectedTopics);
    if (next.has(topicId)) next.delete(topicId);
    else next.add(topicId);
    setSelectedTopics(next);
  };

  const parseTickers = (): string[] => {
    if (!tickerInput.trim()) return [];
    return tickerInput
      .split(/[,\s]+/)
      .map((t) => t.toUpperCase().trim())
      .filter((t) => t.length > 0 && t.length <= 5)
      .filter((v, i, a) => a.indexOf(v) === i);
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSaveAndContinue = async () => {
    setSaving(true);
    try {
      const userId = getUserId();

      // Save survey responses
      if (investingStyle && contentDensity) {
        await saveOnboardingSurvey(userId, {
          investing_style: investingStyle,
          content_density: contentDensity,
        });
      }

      // Save topics
      await saveUserInterests(userId, Array.from(selectedTopics));

      // Save tickers if any were entered
      const tickers = parseTickers();
      if (tickers.length > 0) {
        await saveUserTickers(userId, tickers);
      }

      // Save email subscription if valid email was entered
      if (email && isValidEmail(email)) {
        await saveDigestSubscription(userId, email, frequency);
      }

      setOnboardingComplete();
      navigate("/feed");
    } catch (error) {
      console.error("Failed to save:", error);
      setSaving(false);
    }
  };

  // --- Grouped topics ---

  const groupedTopics = DIMENSION_ORDER.reduce<Array<{ dimension: string; label: string; topics: Topic[] }>>(
    (acc, dim) => {
      const items = topics.filter((t) => t.dimension === dim);
      if (items.length > 0) {
        acc.push({ dimension: dim, label: DIMENSION_LABELS[dim] ?? dim, topics: items });
      }
      return acc;
    },
    []
  );

  // --- Progress indicator ---

  const StepIndicator = () => (
    <div className="mb-12">
      <div className="text-center mb-8">
        <h1
          className="text-3xl mb-2"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Finance AI Digest
        </h1>
        <p className="text-white/50 text-sm">
          AI-curated financial news, tailored to you
        </p>
      </div>
      <div className="flex items-center justify-center">
      {([1, 2, 3, 4] as Step[]).map((s, i) => (
        <div key={s} className="flex items-center">
          {i > 0 && <div className="w-12 h-px bg-white/20" />}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              s === step
                ? "bg-[var(--layer1-blue)] text-white"
                : s < step
                  ? "bg-[var(--layer1-blue)]/30 text-[var(--layer1-blue)]"
                  : "bg-white/10 text-white/30"
            }`}
          >
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
        </div>
      ))}
      </div>
    </div>
  );

  // --- Loading state ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  // =====================  STEP 1 — Investing Style  =====================

  if (step === 1) {
    return (
      <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
        <StepIndicator />

        <div className="mb-12">
          <h1 className="text-4xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
            How do you invest?
          </h1>
          <p className="text-white/70 text-lg">
            This helps us tailor the depth and tone of your news digest.
          </p>
        </div>

        <div className="space-y-3 mb-12">
          {INVESTING_STYLES.map((option) => {
            const isSelected = investingStyle === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setInvestingStyle(option.value)}
                className={`w-full px-5 py-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? "border-[var(--layer1-blue)] bg-[var(--layer1-blue)]/10"
                    : "border-white/20 hover:border-white/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-medium mb-1">{option.label}</div>
                    <div className="text-sm text-white/50">{option.subtitle}</div>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-[var(--layer1-blue)] flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end items-center pt-6 border-t border-white/10">
          <button
            onClick={() => setStep(2)}
            disabled={!investingStyle}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg transition-all ${
              investingStyle
                ? "bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // =====================  STEP 2 — Content Density  =====================

  if (step === 2) {
    return (
      <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
        <StepIndicator />

        <div className="mb-12">
          <h1 className="text-4xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
            How would you like your news?
          </h1>
          <p className="text-white/70 text-lg">
            Choose how much detail you want in your daily digest.
          </p>
        </div>

        <div className="space-y-3 mb-12">
          {CONTENT_DENSITIES.map((option) => {
            const isSelected = contentDensity === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setContentDensity(option.value)}
                className={`w-full px-5 py-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? "border-[var(--layer1-blue)] bg-[var(--layer1-blue)]/10"
                    : "border-white/20 hover:border-white/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-medium mb-1">{option.label}</div>
                    <div className="text-sm text-white/50">{option.subtitle}</div>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-[var(--layer1-blue)] flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/10">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => setStep(3)}
            disabled={!contentDensity}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg transition-all ${
              contentDensity
                ? "bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // =====================  STEP 3 — Topics  =====================

  if (step === 3) {
    return (
      <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
        <StepIndicator />

        <div className="mb-12">
          <h1 className="text-4xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
            What interests you?
          </h1>
          <p className="text-white/70 text-lg">
            Select the industries and topics you'd like to follow. We'll curate your financial news feed based on your
            preferences.
          </p>
        </div>

        <div className="space-y-8 mb-12">
          {groupedTopics.map(({ dimension, label, topics: dimensionTopics }) => (
            <div key={dimension}>
              <h3
                className="text-white/50 uppercase text-sm tracking-wider mb-4"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {label}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {dimensionTopics.map((topic) => {
                  const isSelected = selectedTopics.has(topic.id);
                  return (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={`relative px-4 py-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? "border-[var(--layer1-blue)] bg-[var(--layer1-blue)]/10"
                          : "border-white/20 hover:border-white/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">{topic.display_name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[var(--layer1-blue)] flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/10">
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className="text-white/50 text-sm mr-4">
              {selectedTopics.size} {selectedTopics.size === 1 ? "topic" : "topics"} selected
            </div>
            <button
              onClick={() => setStep(4)}
              disabled={selectedTopics.size === 0}
              className={`flex items-center gap-2 px-8 py-3 rounded-lg transition-all ${
                selectedTopics.size > 0
                  ? "bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================  STEP 4 — Tickers + Email  =====================

  const tickers = parseTickers();

  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <StepIndicator />

      <div className="mb-12">
        <h1 className="text-4xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
          Your portfolio & digest
        </h1>
        <p className="text-white/70 text-lg">
          Add stocks you follow and optionally get your digest by email.
        </p>
      </div>

      {/* Section A — Tickers */}
      <div className="mb-10">
        <h3
          className="text-white/50 uppercase text-sm tracking-wider mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Stocks you follow
        </h3>
        <div className="mb-4">
          <div className="relative">
            <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder="e.g. NVDA, AAPL, MSFT, TSLA"
              className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[var(--layer1-blue)] transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
          <p className="text-white/40 text-sm mt-2">Separate tickers with commas or spaces. US-listed stocks only.</p>
        </div>

        {tickers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tickers.map((ticker) => (
              <span
                key={ticker}
                className="px-3 py-1.5 bg-[var(--layer1-blue)]/10 border border-[var(--layer1-blue)]/30 rounded-lg text-[var(--layer1-blue)] text-sm"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {ticker}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Section B — Email digest */}
      <div className="mb-10">
        <h3
          className="text-white/50 uppercase text-sm tracking-wider mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Email digest
        </h3>
        <div className="mb-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com (optional)"
              className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[var(--layer1-blue)] transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3">
          {(["daily", "weekly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className={`px-6 py-2.5 rounded-lg border transition-all capitalize ${
                frequency === f
                  ? "border-[var(--layer1-blue)] bg-[var(--layer1-blue)]/10 text-white"
                  : "border-white/20 text-white/60 hover:border-white/40"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-6 border-t border-white/10">
        <button
          onClick={() => setStep(3)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleSaveAndContinue}
          disabled={saving}
          className={`flex items-center gap-2 px-8 py-3 rounded-lg transition-all ${
            !saving
              ? "bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white"
              : "bg-white/10 text-white/30 cursor-not-allowed"
          }`}
        >
          {saving ? "Saving..." : "Start reading"}
          {!saving && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
