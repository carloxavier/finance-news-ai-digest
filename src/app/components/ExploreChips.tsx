import type { TopicGroup } from "../utils/topicGroups";

interface ExploreChipsProps {
  visibleGroups: TopicGroup[];
  selectedGroups: Set<string>;
  onToggle: (label: string) => void;
}

export function ExploreChips({ visibleGroups, selectedGroups, onToggle }: ExploreChipsProps) {
  const chipClass = (selected: boolean) =>
    `px-3 py-1.5 text-[0.8rem] font-medium rounded-full border transition-all ${
      selected
        ? "border-[var(--citation-blue)] text-[var(--citation-blue)] bg-[rgba(37,99,246,0.1)]"
        : "border-white/10 text-white/45 bg-transparent hover:text-white/70 hover:bg-white/5"
    }`;

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {visibleGroups.map((group) => (
        <button
          key={group.label}
          type="button"
          onClick={() => onToggle(group.label)}
          className={chipClass(selectedGroups.has(group.label))}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}
