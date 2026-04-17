interface FeedModeToggleProps {
  mode: "brief" | "explore";
  onModeChange: (mode: "brief" | "explore") => void;
}

export function FeedModeToggle({ mode, onModeChange }: FeedModeToggleProps) {
  const buttonClass = (selected: boolean) =>
    `px-4 py-1.5 text-[0.8rem] font-medium rounded-full transition-all ${
      selected
        ? "bg-white/10 text-white border border-white/15"
        : "text-white/45 bg-transparent border border-transparent hover:text-white/60"
    }`;

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 mb-3">
      <button
        type="button"
        onClick={() => mode !== "brief" && onModeChange("brief")}
        className={buttonClass(mode === "brief")}
      >
        Your Brief
      </button>
      <button
        type="button"
        onClick={() => mode !== "explore" && onModeChange("explore")}
        className={buttonClass(mode === "explore")}
      >
        Explore
      </button>
    </div>
  );
}
