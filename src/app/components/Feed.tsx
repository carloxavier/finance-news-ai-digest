import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  getActiveTopics,
  formatArticleDate,
  getUserDigestEmail,
  getUserInterestTopicNames,
  getUserTrackedTickers,
  getSubscriberByToken,
  type Article,
  type Topic,
} from "../utils/supabase";
import { resolveVisibleGroups, CHIP_KEY_SEPARATOR } from "../utils/topicGroups";
import { getUserId, hasCompletedOnboarding, resetOnboarding, getFeedToken, clearFeedToken } from "../utils/userId";
import { useUserFeed } from "../hooks/useUserFeed";
import { TrendingUp, TrendingDown, Minus, AlertCircle, AlertTriangle } from "lucide-react";
import { AppShell } from "./AppShell";
import { FeedModeToggle } from "./FeedModeToggle";
import { FeedContextStrip } from "./FeedContextStrip";
import { ExploreChips } from "./ExploreChips";
import { WelcomeCard } from "./WelcomeCard";

const SUPABASE_URL = "https://kamfamwjswkncftsdgxi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthbWZhbXdqc3drbmNmdHNkZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQ3NDgsImV4cCI6MjA4ODY4MDc0OH0.O8NasVjjajK-T18GppCjfljS_h30fNrPo3TgPJGmcEs";

export function Feed() {
  const navigate = useNavigate();
  const [dataIssue, setDataIssue] = useState(false);
  const [email, setEmail] = useState("");
  const [feedMode, setFeedMode] = useState<"brief" | "explore">("brief");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [userTopicNames, setUserTopicNames] = useState<string[]>([]);
  const [userTickers, setUserTickers] = useState<string[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const onboarded = hasCompletedOnboarding();

  const selectedChipKey = Array.from(selectedGroups).sort().join(CHIP_KEY_SEPARATOR);
  const { articles, loading, firstLoadDone, error } = useUserFeed(feedMode, selectedChipKey, onboarded);

  // Mount-only: guards, email + context resolution, and the welcome-card decision
  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      navigate("/");
      return;
    }

    // Populate topic tabs from the DB so every tab is a real topic with
    // at least one article in the last 30 days.
    getActiveTopics()
      .then(setTopics)
      .catch((err) => console.warn("Failed to load active topics:", err));

    // Fetch the user's email, topics, and tickers for the header avatar +
    // the "Your Brief" context strip.
    //
    // For email-link subscribers (feed_token present), the localStorage
    // user_id may not match the subscriber's original user_id (different
    // device, cleared storage, incognito). Querying digest_subscribers or
    // user_interests by local user_id would miss the real subscriber row.
    // Resolve through the feed_token via the lean getSubscriberByToken RPC
    // instead — it returns just subscriber identity + topic names, no
    // articles. For direct signups (no feed_token), the localStorage
    // user_id is authoritative so we query by user_id.
    const feedToken = getFeedToken();
    if (feedToken) {
      getSubscriberByToken(feedToken)
        .then((sub) => {
          if (sub) {
            setEmail(sub.email || "");
            setUserTopicNames(sub.topics.map((t) => t.display_name));
          }
          // Subscriber RPC does not expose tickers today.
          setUserTickers([]);
        })
        .catch(() => {})
        .finally(() => setContextLoading(false));
    } else {
      Promise.all([
        getUserDigestEmail(getUserId()).catch(() => null),
        getUserInterestTopicNames(getUserId()).catch(() => [] as string[]),
        getUserTrackedTickers(getUserId()).catch(() => [] as string[]),
      ])
        .then(([e, names, tickers]) => {
          setEmail(e || "");
          setUserTopicNames(names);
          setUserTickers(tickers);
        })
        .finally(() => setContextLoading(false));
    }

    // Only prompt for topics on fresh signups. If a feed_token is present the
    // visitor arrived via an email link — they're an established subscriber,
    // and their localStorage user_id may not match the subscriber's original
    // user_id (cross-device), so the interests query would be misleading.
    if (!feedToken) {
      fetch(
        `${SUPABASE_URL}/rest/v1/user_interests?user_id=eq.${getUserId()}&select=id&limit=1`,
        { headers: { apikey: SUPABASE_ANON_KEY } }
      )
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data) && data.length === 0) setShowWelcome(true);
        })
        .catch(() => {});
    }
  }, [navigate]);

  // Detect data-shape issues: every loaded article missing headline/ai_preview.
  useEffect(() => {
    if (articles.length > 0 && articles.every((a) => !a.headline && !a.ai_preview)) {
      console.error(
        "[Feed] Data shape issue: received",
        articles.length,
        "articles but none have headline or ai_preview. First article:",
        JSON.stringify(articles[0])
      );
      setDataIssue(true);
    }
  }, [articles]);

  const handleResetPreferences = () => {
    if (confirm("Reset your preferences and start over?")) {
      resetOnboarding();
      navigate("/");
    }
  };

  const handleChipToggle = (label: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const getSignalIcon = (signal: Article['consensus_signal']) => {
    switch (signal) {
      case 'BUY':
        return <TrendingUp className="w-4 h-4" />;
      case 'SELL':
        return <TrendingDown className="w-4 h-4" />;
      case 'MIXED':
        return <Minus className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getSignalColor = (signal: Article['consensus_signal']) => {
    switch (signal) {
      case 'BUY':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'SELL':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'MIXED':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-white/10 text-white/50 border-white/20';
    }
  };

  // Only show the full-screen spinner on the very first load. Subsequent
  // tab switches render an inline loader inside the shell so the nav/tabs
  // stay visible.
  if (loading && !firstLoadDone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading your feed...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">Error loading feed</div>
          <div className="text-white/60 text-sm mb-6">{error}</div>
          <button
            onClick={handleResetPreferences}
            className="px-6 py-2 bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 rounded-lg transition-colors"
          >
            Reset Preferences
          </button>
        </div>
      </div>
    );
  }

  if (dataIssue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-3" style={{ fontFamily: 'var(--font-headline)' }}>
            Feed temporarily unavailable
          </h2>
          <p className="text-white/60 text-sm mb-3">
            We received your articles but they arrived in an unexpected format.
            This is a known issue our team is actively fixing.
          </p>
          <p className="text-white/40 text-xs mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
            Error: DATA_SHAPE_MISMATCH — {articles.length} article(s) received, 0 displayable.
            Check browser console for raw response data.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 rounded-lg transition-colors text-sm"
            >
              Retry
            </button>
            <button
              onClick={() => { clearFeedToken(); handleResetPreferences(); }}
              className="px-6 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-sm text-white/70"
            >
              Reset Preferences
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell email={email}>
      {showWelcome && (
        <WelcomeCard
          onDone={() => {
            setShowWelcome(false);
            window.location.reload();
          }}
        />
      )}
      <FeedModeToggle mode={feedMode} onModeChange={setFeedMode} />

      {feedMode === "brief" ? (
        <FeedContextStrip
          topicNames={userTopicNames}
          tickers={userTickers}
          onEdit={() => navigate("/onboarding?edit=true")}
          loading={contextLoading}
        />
      ) : (
        <ExploreChips
          visibleGroups={resolveVisibleGroups(topics.map((t) => t.slug))}
          selectedGroups={selectedGroups}
          onToggle={handleChipToggle}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-white/40 text-sm">Loading…</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 text-white/50">
          {feedMode === "brief"
            ? "Nothing matching your interests in the last 30 days. Try broadening your topics or check back tomorrow."
            : "No articles found for the selected topics."}
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => navigate(`/article/${article.id}`)}
                className="w-full bg-[var(--card)] border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all text-left group"
              >
                {/* Header: Publication & Time */}
                <div className="flex items-center gap-3 mb-3">
                  {article.publication && (
                    <>
                      <span className="text-xs text-white/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
                        {article.publication}
                      </span>
                      <span className="text-xs text-white/30">•</span>
                    </>
                  )}
                  <span className="text-xs text-white/40">
                    {formatArticleDate(article.published_at)}
                  </span>
                </div>

                {/* Headline */}
                <h2 className="text-xl mb-3 group-hover:text-[var(--citation-blue)] transition-colors" style={{ fontFamily: 'var(--font-headline)' }}>
                  {article.headline}
                </h2>

                {/* AI Preview */}
                <p className="text-white/70 text-sm mb-4 line-clamp-2">
                  {article.ai_preview}
                </p>

                {/* Footer: Tickers & Signal */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {/* Tickers */}
                  <div className="flex flex-wrap gap-2">
                    {(article.extracted_tickers ?? []).slice(0, 4).map((ticker) => (
                      <span
                        key={ticker}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {ticker}
                      </span>
                    ))}
                    {(article.extracted_tickers ?? []).length > 4 && (
                      <span className="px-2 py-1 text-xs text-white/40">
                        +{(article.extracted_tickers ?? []).length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Consensus Signal */}
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${getSignalColor(article.consensus_signal)}`}>
                    {getSignalIcon(article.consensus_signal)}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{article.consensus_signal}</span>
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}
    </AppShell>
  );
}