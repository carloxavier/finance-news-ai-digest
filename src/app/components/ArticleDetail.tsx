import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { checkWaitlistStatus, joinAiAgentWaitlist, getUserDigestEmail, formatArticleDate } from "../utils/supabase";
import { useArticleDetail } from "../hooks/useArticleDetail";
import { ArrowLeft, ExternalLink, AlertTriangle, Sparkles } from "lucide-react";
import { AnalystDataSection } from "./AnalystDataSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { getUserId, setFeedToken, setOnboardingComplete } from "../utils/userId";

export function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { article, loading } = useArticleDetail(id);
  const [showAiModal, setShowAiModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [digestEmail, setDigestEmail] = useState<string | null>(null);
  const [alreadyOnWaitlist, setAlreadyOnWaitlist] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joining, setJoining] = useState(false);

  // If arriving from an email link with a feed token, store it so the user
  // can navigate to their feed without going through onboarding again.
  useEffect(() => {
    const token = searchParams.get("t");
    if (token) {
      setFeedToken(token);
      setOnboardingComplete();
    }
  }, [searchParams]);

  useEffect(() => {
    const userId = getUserId();
    checkWaitlistStatus(userId).then(setAlreadyOnWaitlist);
    getUserDigestEmail(userId).then((email) => {
      setDigestEmail(email);
      if (email) setEmailInput(email);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading article...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Article not found</div>
      </div>
    );
  }

  // Parse brief text to handle citation markers
  const renderBrief = (text: string) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const citationNum = parseInt(match[1]);
        return (
          <sup key={index}>
            <a
              href={`#citation-${citationNum}`}
              className="text-[var(--citation-blue)] hover:underline px-0.5"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              [{citationNum}]
            </a>
          </sup>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleJoinWaitlist = async () => {
    setJoining(true);
    try {
      const email = emailInput.trim() || undefined;
      await joinAiAgentWaitlist(getUserId(), id, email);
      setJoinSuccess(true);
      setAlreadyOnWaitlist(true);
    } catch (error) {
      console.error("Failed to join waitlist:", error);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--navy-bg)]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate("/feed")}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-8">
        {/* Article Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-white/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
              {article.publication}
            </span>
            <span className="text-xs text-white/30">•</span>
            <span className="text-xs text-white/40">
              {formatArticleDate(article.published_at)}
            </span>
          </div>

          <h1 className="text-4xl mb-6" style={{ fontFamily: 'var(--font-headline)' }}>
            {article.headline}
          </h1>

          {/* Tickers */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(article.extracted_tickers ?? []).map((ticker) => (
              <span
                key={ticker}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {ticker}
              </span>
            ))}
          </div>

          {/* Sources summary */}
          {article.citations && article.citations.length > 0 && (
            <a
              href="#sources"
              className="inline-flex items-center gap-2 text-sm text-[var(--citation-blue)] hover:underline"
            >
              Synthesized from {article.citations.length} source{article.citations.length !== 1 ? 's' : ''}
              <ArrowLeft className="w-3 h-3 rotate-[-90deg]" />
            </a>
          )}
        </div>

        {/* Brief with citations */}
        <div className="mb-12">
          <h2 className="text-sm uppercase tracking-wider text-white/50 mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
            AI Brief
          </h2>
          {article.brief_bullets && article.brief_bullets.length > 0 ? (
            <ul className="space-y-3">
              {article.brief_bullets.map((point, index) => (
                <li key={index} className="flex gap-3">
                  <span className="text-[var(--citation-blue)] flex-shrink-0 mt-1">•</span>
                  <span className="text-white/90 leading-relaxed">
                    {renderBrief(point)}
                  </span>
                </li>
              ))}
            </ul>
          ) : article.brief ? (
            <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
              {renderBrief(article.brief)}
            </p>
          ) : null}

          {/* Citations */}
          {article.citations && article.citations.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/10" id="sources">
              <h3 className="text-sm uppercase tracking-wider text-white/50 mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                Sources
              </h3>
              <div className="space-y-2">
                {article.citations.map((citation) => (
                  <div
                    key={citation.n}
                    id={`citation-${citation.n}`}
                    className="flex gap-3 text-sm"
                  >
                    <span className="text-[var(--citation-blue)] flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                      [{citation.n}]
                    </span>
                    <div>
                      <span className="text-white/70">{citation.label}</span>
                      <span className="text-white/30 mx-2">—</span>
                      <span className="text-white/50">{citation.source}</span>
                      {citation.url && (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-[var(--citation-blue)] hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analyst Data (Layer 1 - Blue) */}
        {article.analyst_data && Object.keys(article.analyst_data).length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm uppercase tracking-wider text-[var(--layer1-blue)]" style={{ fontFamily: 'var(--font-mono)' }}>
                Analyst Consensus
              </h2>
              <div className="h-px flex-1 bg-[var(--layer1-blue)]/20"></div>
            </div>
            <AnalystDataSection analystData={article.analyst_data} />
          </div>
        )}

        {/* AI Inference (Layer 2 - Amber) */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6 p-4 bg-[var(--layer2-amber)]/10 border border-[var(--layer2-amber)]/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-[var(--layer2-amber)] flex-shrink-0" />
            <div>
              <div className="text-sm uppercase tracking-wider text-[var(--layer2-amber)] mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
                AI Inference
              </div>
              <div className="text-xs text-white/60">
                The following insights are AI-generated and should be verified independently
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* What to Watch */}
            {article.inference_watch && article.inference_watch.length > 0 && (
              <div>
                <h3 className="text-sm uppercase tracking-wider text-[var(--layer2-amber)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                  Signals to Watch
                </h3>
                <ul className="space-y-2">
                  {article.inference_watch.map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="text-[var(--layer2-amber)] flex-shrink-0">•</span>
                      <span className="text-white/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Risks */}
            {article.inference_risks && article.inference_risks.length > 0 && (
              <div>
                <h3 className="text-sm uppercase tracking-wider text-[var(--layer2-amber)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                  Key Risks
                </h3>
                <ul className="space-y-2">
                  {article.inference_risks.map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="text-[var(--layer2-amber)] flex-shrink-0">•</span>
                      <span className="text-white/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Open Questions */}
            {article.inference_questions && article.inference_questions.length > 0 && (
              <div>
                <h3 className="text-sm uppercase tracking-wider text-[var(--layer2-amber)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                  Open Questions
                </h3>
                <ul className="space-y-2">
                  {article.inference_questions.map((item, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="text-[var(--layer2-amber)] flex-shrink-0">•</span>
                      <span className="text-white/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar — Ask AI */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="bg-gradient-to-t from-[var(--navy-bg)] via-[var(--navy-bg)] to-transparent pt-8 pb-4 px-6">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setShowAiModal(true)}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white rounded-xl transition-all text-base font-medium"
            >
              <Sparkles className="w-5 h-5" />
              Ask AI about this article
            </button>
          </div>
        </div>
      </div>

      {/* AI Agent Waitlist Modal */}
      <Dialog open={showAiModal} onOpenChange={setShowAiModal}>
        <DialogContent className="bg-[var(--navy-bg)] border-white/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className="text-2xl text-white"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              {joinSuccess ? "You're on the list!" : "AI Deep Dive"}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-base">
              {joinSuccess
                ? "We'll notify you as soon as AI Deep Dive is ready. You'll be among the first to try it."
                : alreadyOnWaitlist
                  ? "You're already on the waitlist! We'll notify you when AI Deep Dive is ready."
                  : "Ask follow-up questions, explore implications, and understand how events connect — all powered by AI. This feature is currently in closed beta."}
            </DialogDescription>
          </DialogHeader>

          {/* Email section — only shown when not yet joined */}
          {!joinSuccess && !alreadyOnWaitlist && (
            <div className="py-2">
              {digestEmail ? (
                <p className="text-white/70 text-sm">
                  We'll notify you at <span className="text-white font-medium">{digestEmail}</span> when ready.
                </p>
              ) : (
                <>
                  <p className="text-white/70 text-sm mb-3">
                    We'll notify you by email when ready.
                  </p>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com (optional)"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[var(--layer1-blue)] transition-colors"
                  />
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-3 sm:flex-row">
            {joinSuccess || alreadyOnWaitlist ? (
              <button
                onClick={() => setShowAiModal(false)}
                className="w-full px-6 py-3 bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white rounded-lg transition-all font-medium"
              >
                Got it
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="flex-1 px-6 py-3 border border-white/20 text-white/60 hover:text-white hover:border-white/40 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinWaitlist}
                  disabled={joining}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-all font-medium ${
                    !joining
                      ? "bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {joining ? "Joining..." : "I'm in"}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
