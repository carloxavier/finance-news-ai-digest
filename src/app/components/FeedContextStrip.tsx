interface FeedContextStripProps {
  topicNames: string[];
  tickers: string[];
  onEdit: () => void;
  loading?: boolean;
}

const MAX_INLINE = 4;

function truncate(items: string[]): string {
  if (items.length <= MAX_INLINE + 1) return items.join(", ");
  const head = items.slice(0, MAX_INLINE).join(", ");
  const rest = items.length - MAX_INLINE;
  return `${head} + ${rest} more`;
}

export function FeedContextStrip({
  topicNames,
  tickers,
  onEdit,
  loading = false,
}: FeedContextStripProps) {
  if (loading) {
    return (
      <div className="text-[13px] mb-5">
        <span className="text-white/20 animate-pulse">Loading your preferences...</span>
      </div>
    );
  }

  const hasTopics = topicNames.length > 0;
  const hasTickers = tickers.length > 0;
  const empty = !hasTopics && !hasTickers;

  const editLabel = empty ? "Set up your interests →" : "Edit →";

  return (
    <div className="text-[13px] text-white/40 mb-5">
      {empty && <span>Showing latest articles </span>}
      {hasTopics && (
        <span>
          Curated from: <span className="text-white/60">{truncate(topicNames)}</span>{" "}
        </span>
      )}
      {hasTopics && hasTickers && <span className="text-white/20">· </span>}
      {hasTickers && (
        <span>
          Tracking: <span className="text-white/60">{truncate(tickers)}</span>{" "}
        </span>
      )}
      <span className="text-white/20">· </span>
      <button
        type="button"
        onClick={onEdit}
        className="text-[var(--citation-blue)] hover:underline cursor-pointer bg-transparent border-none p-0 text-[13px]"
      >
        {editLabel}
      </button>
    </div>
  );
}
