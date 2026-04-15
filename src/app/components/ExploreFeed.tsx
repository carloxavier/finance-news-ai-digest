import { useNavigate } from "react-router";
import { formatArticleDate, type Article } from "../utils/supabase";
import { useGeneralFeed } from "../hooks/useGeneralFeed";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";

const SKELETON_COUNT = 5;

export function ExploreFeed() {
  const navigate = useNavigate();
  const { articles, loading } = useGeneralFeed(20);

  const getSignalIcon = (signal: Article["consensus_signal"]) => {
    switch (signal) {
      case "BUY":
        return <TrendingUp className="w-4 h-4" />;
      case "SELL":
        return <TrendingDown className="w-4 h-4" />;
      case "MIXED":
        return <Minus className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getSignalColor = (signal: Article["consensus_signal"]) => {
    switch (signal) {
      case "BUY":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "SELL":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "MIXED":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-white/10 text-white/50 border-white/20";
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--navy-bg)" }}>
      {/* Sticky banner */}
      <div
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{
          background: "rgba(13, 27, 42, 0.92)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className="text-xl tracking-tight"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              Finno<span style={{ color: "var(--citation-blue)" }}>polis</span>
            </span>
            <span className="text-sm text-white/60 hidden sm:inline">
              You're exploring Finnopolis — sign up free to get your personalised
              morning brief
            </span>
          </div>
          <a
            href="/#signup"
            className="px-4 py-2 text-[0.8rem] font-semibold uppercase tracking-wide rounded-md text-white no-underline transition-all hover:-translate-y-px whitespace-nowrap"
            style={{ background: "var(--layer1-blue)" }}
          >
            Sign up
          </a>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 sm:hidden">
          <p className="text-sm text-white/60">
            You're exploring Finnopolis — sign up free to get your personalised
            morning brief
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1
            className="text-3xl mb-2"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            Explore the latest briefs
          </h1>
          <p className="text-white/50 text-sm">
            A live, public preview of what Finnopolis members see every morning.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                className="bg-[var(--card)] border border-white/10 rounded-xl p-6 animate-pulse"
              >
                <div className="h-3 w-32 bg-white/10 rounded mb-4" />
                <div className="h-5 w-3/4 bg-white/15 rounded mb-3" />
                <div className="h-4 w-full bg-white/10 rounded mb-2" />
                <div className="h-4 w-5/6 bg-white/10 rounded mb-4" />
                <div className="flex gap-2">
                  <div className="h-6 w-12 bg-white/10 rounded" />
                  <div className="h-6 w-12 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            No briefs available right now. Check back soon.
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => navigate(`/article/${article.id}`)}
                className="w-full bg-[var(--card)] border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-xs text-white/50 uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {article.publication}
                  </span>
                  <span className="text-xs text-white/30">•</span>
                  <span className="text-xs text-white/40">
                    {formatArticleDate(article.published_at)}
                  </span>
                </div>

                <h2
                  className="text-xl mb-3 group-hover:text-[var(--citation-blue)] transition-colors"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {article.headline}
                </h2>

                <p className="text-white/70 text-sm mb-4 line-clamp-2">
                  {article.ai_preview}
                </p>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(article.extracted_tickers ?? []).slice(0, 4).map((ticker) => (
                      <span
                        key={ticker}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
                        style={{ fontFamily: "var(--font-mono)" }}
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

                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs ${getSignalColor(article.consensus_signal)}`}
                  >
                    {getSignalIcon(article.consensus_signal)}
                    <span style={{ fontFamily: "var(--font-mono)" }}>
                      {article.consensus_signal}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
