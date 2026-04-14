import { useState, useEffect } from "react";
import { getTopics, saveUserInterests, type Topic } from "../utils/supabase";
import { getUserId } from "../utils/userId";

interface WelcomeCardProps {
  onDone: () => void;
}

export function WelcomeCard({ onDone }: WelcomeCardProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTopics().then((t) =>
      setTopics(t.filter((x) => x.dimension !== "geography"))
    );
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserInterests(getUserId(), Array.from(selected));
    } catch (e) {
      console.error("Failed to save interests:", e);
    }
    setSaving(false);
    onDone();
  };

  return (
    <div
      className="rounded-xl p-5 mb-5 border"
      style={{
        background: "var(--card)",
        borderColor: "rgba(255,255,255,0.1)",
      }}
    >
      <h2
        className="text-xl mb-1"
        style={{ fontFamily: "var(--font-headline)" }}
      >
        Welcome to Finnopolis
      </h2>
      <p className="text-sm text-white/50 mb-4">
        Select topics to personalize your financial intelligence feed.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => toggle(topic.id)}
            className={`px-3 py-1.5 text-[0.78rem] rounded-full border transition-all ${
              selected.has(topic.id)
                ? "border-[var(--citation-blue)] text-[var(--citation-blue)] bg-[rgba(37,99,246,0.1)]"
                : "border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
            }`}
          >
            {topic.display_name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {selected.size > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--layer1-blue)" }}
          >
            {saving
              ? "Saving..."
              : `Personalize my feed (${selected.size} selected)`}
          </button>
        )}
        <button
          onClick={onDone}
          className="w-full py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Skip — explore my feed
        </button>
      </div>
    </div>
  );
}
