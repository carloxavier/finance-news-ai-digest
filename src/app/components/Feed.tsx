import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getUserFeed, getSubscriberFeed, formatArticleDate, type Article } from "../utils/supabase";
import { getUserId, hasCompletedOnboarding, resetOnboarding, getFeedToken, clearFeedToken } from "../utils/userId";
import { TrendingUp, TrendingDown, Minus, AlertCircle, Settings, AlertTriangle } from "lucide-react";

export function Feed() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataIssue, setDataIssue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if onboarding is complete
    if (!hasCompletedOnboarding()) {
      navigate("/");
      return;
    }

    // Load feed — prefer feed token (from email links) over user ID
    // Detect articles that came back from the API but have no displayable content
    const handleArticles = (articles: Article[]) => {
      setArticles(articles);
      if (articles.length > 0 && articles.every(a => !a.headline && !a.ai_preview)) {
        console.error('[Feed] Data shape issue: received', articles.length, 'articles but none have headline or ai_preview. First article:', JSON.stringify(articles[0]));
        setDataIssue(true);
      }
    };

    const feedToken = getFeedToken();
    if (feedToken) {
      getSubscriberFeed(feedToken)
        .then((feed) => {
          if (feed) {
            handleArticles(feed.articles);
          } else {
            // Token invalid — clear it and fall back to user ID feed
            clearFeedToken();
            return getUserFeed(getUserId()).then(handleArticles);
          }
        })
        .catch((err) => {
          console.error("Feed error:", err);
          setError(err.message || "Failed to load feed");
        })
        .finally(() => setLoading(false));
    } else {
      getUserFeed(getUserId())
        .then(handleArticles)
        .catch((err) => {
          console.error("Feed error:", err);
          setError(err.message || "Failed to load feed");
        })
        .finally(() => setLoading(false));
    }
  }, [navigate]);

  const handleResetPreferences = () => {
    if (confirm("Reset your preferences and start over?")) {
      resetOnboarding();
      navigate("/");
    }
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

  if (loading) {
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
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--navy-bg)]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl" style={{ fontFamily: 'var(--font-headline)' }}>
            Your Financial Digest
          </h1>
          <button
            onClick={handleResetPreferences}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Reset preferences"
          >
            <Settings className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {articles.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            No articles found. Try adjusting your preferences.
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
                  <span className="text-xs text-white/50 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
                    {article.publication}
                  </span>
                  <span className="text-xs text-white/30">•</span>
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
      </div>
    </div>
  );
}