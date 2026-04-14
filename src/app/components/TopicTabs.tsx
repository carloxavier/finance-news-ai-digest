import type { Topic } from "../utils/supabase";
import { resolveVisibleGroups } from "../utils/topicGroups";

interface TopicTabsProps {
  /** Topics currently known to have recent articles (from getActiveTopics). */
  activeTopics: Topic[];
  /** Active group label, or null for the "All" tab. */
  activeGroup: string | null;
  onGroupChange: (label: string | null) => void;
}

export function TopicTabs({ activeTopics, activeGroup, onGroupChange }: TopicTabsProps) {
  const visibleGroups = resolveVisibleGroups(activeTopics.map((t) => t.slug));

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
        onClick={() => onGroupChange(null)}
        className={tabClass(activeGroup === null)}
      >
        All
      </button>
      {visibleGroups.map((group) => (
        <button
          key={group.label}
          onClick={() => onGroupChange(group.label)}
          className={tabClass(activeGroup === group.label)}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}
