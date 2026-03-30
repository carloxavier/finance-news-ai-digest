import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getTopics, saveUserInterests, type Topic } from "../utils/supabase";
import { getUserId, hasCompletedOnboarding, setOnboardingComplete } from "../utils/userId";
import { Check } from "lucide-react";

export function Onboarding() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter to only show topics with seeded data
  const ALLOWED_TOPIC_SLUGS = ['semiconductors', 'biotech', 'energy', 'macro', 'geopolitics'];

  useEffect(() => {
    // If already onboarded, redirect to feed
    if (hasCompletedOnboarding()) {
      navigate("/feed");
      return;
    }

    // Load topics and filter to allowed ones
    getTopics()
      .then(allTopics => {
        const filteredTopics = allTopics.filter(topic => 
          ALLOWED_TOPIC_SLUGS.includes(topic.slug)
        );
        setTopics(filteredTopics);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [navigate]);

  const toggleTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.add(topicId);
    }
    setSelectedTopics(newSelected);
  };

  const handleContinue = async () => {
    if (selectedTopics.size === 0) return;

    setSaving(true);
    try {
      const userId = getUserId();
      await saveUserInterests(userId, Array.from(selectedTopics));
      setOnboardingComplete();
      navigate("/feed");
    } catch (error) {
      console.error("Failed to save interests:", error);
      setSaving(false);
    }
  };

  // Group topics by dimension
  const groupedTopics = topics.reduce((acc, topic) => {
    if (!acc[topic.dimension]) {
      acc[topic.dimension] = [];
    }
    acc[topic.dimension].push(topic);
    return acc;
  }, {} as Record<string, Topic[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl mb-4" style={{ fontFamily: 'var(--font-headline)' }}>
          What interests you?
        </h1>
        <p className="text-white/70 text-lg">
          Select the industries and topics you'd like to follow. We'll curate your financial news feed based on your preferences.
        </p>
      </div>

      <div className="space-y-8 mb-12">
        {Object.entries(groupedTopics).map(([dimension, dimensionTopics]) => (
          <div key={dimension}>
            <h3 className="text-white/50 uppercase text-sm tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
              {dimension}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {dimensionTopics.map((topic) => {
                const isSelected = selectedTopics.has(topic.id);
                return (
                  <button
                    key={topic.id}
                    onClick={() => toggleTopic(topic.id)}
                    className={`
                      relative px-4 py-3 rounded-lg border-2 transition-all text-left
                      ${isSelected 
                        ? 'border-[var(--layer1-blue)] bg-[var(--layer1-blue)]/10' 
                        : 'border-white/20 hover:border-white/40'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{topic.display_name}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[var(--layer1-blue)] flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-white/10">
        <div className="text-white/50 text-sm">
          {selectedTopics.size} {selectedTopics.size === 1 ? 'topic' : 'topics'} selected
        </div>
        <button
          onClick={handleContinue}
          disabled={selectedTopics.size === 0 || saving}
          className={`
            px-8 py-3 rounded-lg transition-all
            ${selectedTopics.size > 0 && !saving
              ? 'bg-[var(--layer1-blue)] hover:bg-[var(--layer1-blue)]/90 text-white'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
            }
          `}
        >
          {saving ? 'Saving...' : 'Continue to Feed'}
        </button>
      </div>
    </div>
  );
}