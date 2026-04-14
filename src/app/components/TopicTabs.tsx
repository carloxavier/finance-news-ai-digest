interface TopicTabsProps {
  activeTopic: string | null;
  onTopicChange: (slug: string | null) => void;
}

const TABS = [
  { slug: null, label: "All" },
  { slug: "technology", label: "Technology" },
  { slug: "energy", label: "Energy" },
  { slug: "financials", label: "Financials" },
  { slug: "biotech", label: "Biotech" },
  { slug: "macro", label: "Macro & Fed" },
  { slug: "earnings", label: "Earnings" },
  { slug: "ai-infrastructure", label: "AI Infra" },
];

export function TopicTabs({ activeTopic, onTopicChange }: TopicTabsProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto pb-4 mb-5 border-b"
      style={{ borderColor: "rgba(255,255,255,0.08)", scrollbarWidth: "none" }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.slug || "all"}
          onClick={() => onTopicChange(tab.slug)}
          className={`px-3.5 py-1.5 text-[0.8rem] font-medium whitespace-nowrap rounded-full border transition-all ${
            activeTopic === tab.slug
              ? "text-white bg-white/10 border-white/15"
              : "text-white/45 bg-transparent border-transparent hover:text-white/70 hover:bg-white/5"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
