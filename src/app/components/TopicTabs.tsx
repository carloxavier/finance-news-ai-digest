import type { Topic } from "../utils/supabase";

interface TopicTabsProps {
  topics: Topic[];
  activeTopic: string | null;
  onTopicChange: (slug: string | null) => void;
}

export function TopicTabs({ topics, activeTopic, onTopicChange }: TopicTabsProps) {
  const tabClass = (selected: boolean) =>
    `px-3.5 py-1.5 text-[0.8rem] font-medium whitespace-nowrap rounded-full border transition-all ${
      selected
        ? "text-white bg-white/10 border-white/15"
        : "text-white/45 bg-transparent border-transparent hover:text-white/70 hover:bg-white/5"
    }`;

  return (
    <div
      className="flex gap-1 overflow-x-auto pb-4 mb-5 border-b"
      style={{ borderColor: "rgba(255,255,255,0.08)", scrollbarWidth: "none" }}
    >
      <button
        key="all"
        onClick={() => onTopicChange(null)}
        className={tabClass(activeTopic === null)}
      >
        All
      </button>
      {topics.map((topic) => (
        <button
          key={topic.id}
          onClick={() => onTopicChange(topic.slug)}
          className={tabClass(activeTopic === topic.slug)}
        >
          {topic.display_name}
        </button>
      ))}
    </div>
  );
}
