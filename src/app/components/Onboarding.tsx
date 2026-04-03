import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  getTopics,
  saveUserInterests,
  saveUserTickers,
  saveDigestSubscription,
  type Topic,
} from "../utils/supabase";
import { getUserId, hasCompletedOnboarding, setOnboardingComplete } from "../utils/userId";
import { Check, ArrowLeft, ArrowRight, Mail, TrendingUp } from "lucide-react";

type Step = 1 | 2 | 3;

const DIMENSION_ORDER: Array<Topic["dimension"]> = ["industry", "theme"];
const DIMENSION_LABELS: Record<string, string> = {
  industry: "Industries",
  theme: "Themes",
  geography: "Regions",
};

export function Onboarding() {
  const navigate = useNavigate();

  // Shared state
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Topics
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Step 2 — Tickers
  const [tickerInput, setTickerInput] = useState("");

  // Step 3 — Email
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    if (hasCompletedOnboarding()) {
      navigate("/feed");
      return;
    }

    getTopics()
      .then(setTopics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [navigate]);

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

      // Always save topics
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
      {([1, 2, 3] as Step[]).map((s, i) => (
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

  // =====================  STEP 1 — Topics  =====================

  if (step === 1) {
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
          <div className="text-white/50 text-sm">
            {selectedTopics.size} {selectedTopics.size === 1 ? "topic" : "topics"} selected
          </div>
          <button
            onClick={() => setStep(2)}
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
    );
  }

  // =====================  STEP 2 — Tickers  =====================

  if (step === 2) {
    const tickers = parseTickers();

    return (
      <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
        <StepIndicator />

        <div className="mb-12">
          <h1 className="text-4xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
            Which stocks do you follow?
          </h1>
          <p className="text-white/70 text-lg">
            Add ticker symbols for stocks in your portfolio or watchlist. We'll highlight articles that mention them.
          </p>
        </div>

        <div className="mb-8">
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
          <div className="flex flex-wrap gap-2 mb-8">
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

        <div className="flex justify-between items-center pt-6 border-t border-white/10">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setStep(3)}
              className="text-white/60 hover:text-white transition-colors text-sm"
            >
              Skip
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-8 py-3 rounded-lg bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================  STEP 3 — Email  =====================

  const tickers = parseTickers();
  const emailValid = isValidEmail(email);

  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <StepIndicator />

      <div className="mb-12">
        <h1 className="text-4xl mb-4" style={{ fontFamily: "var(--font-headline)" }}>
          Stay in the loop
        </h1>
        <p className="text-white/70 text-lg">
          Get your personalized financial digest delivered to your inbox. We'll send only the articles that match your
          interests.
        </p>
      </div>

      {/* Email input */}
      <div className="mb-6">
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[var(--layer1-blue)] transition-colors"
          />
        </div>
      </div>

      {/* Frequency toggle */}
      <div className="flex gap-3 mb-8">
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

      {/* Preferences summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
        <h4
          className="text-white/50 uppercase text-xs tracking-wider mb-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Your preferences
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-white/50">Topics:</span>
            <span className="text-white">{selectedTopics.size} selected</span>
          </div>
          {tickers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-white/50">Tickers:</span>
              <span className="text-white" style={{ fontFamily: "var(--font-mono)" }}>
                {tickers.join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-6 border-t border-white/10">
        <button
          onClick={() => setStep(2)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={handleSaveAndContinue}
            disabled={saving}
            className="text-white/60 hover:text-white transition-colors text-sm"
          >
            {saving ? "Saving..." : "Skip, go to feed"}
          </button>
          <button
            onClick={handleSaveAndContinue}
            disabled={!emailValid || saving}
            className={`px-8 py-3 rounded-lg transition-all ${
              emailValid && !saving
                ? "bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {saving ? "Saving..." : "Subscribe & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
