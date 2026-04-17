import type { TopicGroup } from "../utils/topicGroups";

interface ExploreChipsProps {
  visibleGroups: TopicGroup[];
  selectedGroups: Set<string>;
  onToggle: (label: string) => void;
}

// Multi-select filter chips for the "Explore" feed mode. Each chip is a
// pressable toggle; `aria-pressed` communicates on/off state to assistive tech.
export function ExploreChips({ visibleGroups, selectedGroups, onToggle }: ExploreChipsProps) {
  const chipClass = (selected: boolean) =>
    `px-3 py-1.5 text-[0.8rem] font-medium rounded-full border transition-all ${
      selected
        ? "border-[var(--citation-blue)] text-[var(--citation-blue)] bg-[rgba(37,99,246,0.1)]"
        : "border-white/10 text-white/45 bg-transparent hover:text-white/70 hover:bg-white/5"
    }`;

  return (
    <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter by topic">
      {visibleGroups.map((group) => {
        const selected = selectedGroups.has(group.label);
        return (
          <button
            key={group.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(group.label)}
            className={chipClass(selected)}
          >
            {group.label}
          </button>
        );
      })}
    </div>
  );
}
