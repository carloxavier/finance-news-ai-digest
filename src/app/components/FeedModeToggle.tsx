interface FeedModeToggleProps {
  mode: "brief" | "explore";
  onModeChange: (mode: "brief" | "explore") => void;
}

// Two-mode switch between the personalized "Your Brief" and the browsable
// "Explore" views. Keyboard- and screen-reader-accessible via the tablist
// pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
export function FeedModeToggle({ mode, onModeChange }: FeedModeToggleProps) {
  const buttonClass = (selected: boolean) =>
    `px-4 py-1.5 text-[0.8rem] font-medium rounded-full transition-all ${
      selected
        ? "bg-white/10 text-white border border-white/15"
        : "text-white/45 bg-transparent border border-transparent hover:text-white/60"
    }`;

  const renderTab = (value: "brief" | "explore", label: string) => {
    const selected = mode === value;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => !selected && onModeChange(value)}
        className={buttonClass(selected)}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Feed view"
      className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 mb-3"
    >
      {renderTab("brief", "Your Brief")}
      {renderTab("explore", "Explore")}
    </div>
  );
}
