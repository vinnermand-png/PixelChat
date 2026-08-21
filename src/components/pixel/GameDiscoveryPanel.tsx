import { useEffect, useState } from "react";
import type {
  GameDiscoveryQuestionCategory,
  GameDiscoverySession,
} from "@/lib/gameDiscovery/gameDiscovery";
import type { GameFoundation } from "@/lib/gameFoundation/gameFoundation";

export interface GameDiscoveryPanelProps {
  foundation: GameFoundation;
  session: GameDiscoverySession;
  onUpdateCategoryAnswer: (
    category: GameDiscoveryQuestionCategory,
    answer: string,
  ) => void;
  onComplete: () => void;
  onClose: () => void;
}

const DIRECT_DISCOVERY_FIELDS = [
  ["Game Type", "game_type"],
  ["Core Experience", "core_experience"],
  ["Player Activity", "player_activity"],
  ["World Concept", "world"],
  ["Social Interaction", "social"],
  ["Progression", "progression"],
  ["Gameplay Goals", "goals"],
  ["Additional Notes", "other"],
] as const satisfies ReadonlyArray<
  readonly [string, GameDiscoveryQuestionCategory]
>;

const UNDERSTANDING_FIELDS = [
  ["Game Type", "gameType"],
  ["Core Experience", "coreExperience"],
  ["Player Activity", "playerActivity"],
  ["World Concept", "worldConcept"],
  ["Social Interaction", "socialInteraction"],
  ["Progression", "progression"],
  ["Gameplay Goals", "gameplayGoals"],
  ["Additional Notes", "additionalNotes"],
] as const;

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );
}

function getCategoryAnswer(
  session: GameDiscoverySession,
  category: GameDiscoveryQuestionCategory,
) {
  return (
    session.questions.find(
      (question) => question.category === category && question.status === "answered",
    )?.answer ?? ""
  );
}

export default function GameDiscoveryPanel({
  foundation,
  session,
  onUpdateCategoryAnswer,
  onComplete,
  onClose,
}: GameDiscoveryPanelProps) {
  const [answers, setAnswers] = useState<
    Partial<Record<GameDiscoveryQuestionCategory, string>>
  >({});

  useEffect(() => {
    setAnswers(
      Object.fromEntries(
        DIRECT_DISCOVERY_FIELDS.map(([, category]) => [
          category,
          getCategoryAnswer(session, category),
        ]),
      ) as Partial<Record<GameDiscoveryQuestionCategory, string>>,
    );
  }, [session]);

  const hasAllCategoryAnswers = DIRECT_DISCOVERY_FIELDS.every(([, category]) =>
    Boolean((answers[category] ?? "").trim()),
  );

  return (
    <section
      className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border-2 border-[#a9df5a] bg-[#132019] p-4 text-[#d7f5a0]"
      style={{
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 10,
        lineHeight: 1.6,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-discovery-title"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="game-discovery-title" className="text-[#6ee7d8]">
          GAME DISCOVERY
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="border border-[#6ee7d8] px-2 py-1 text-xs text-[#6ee7d8]"
        >
          CLOSE
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs uppercase text-[#6ee7d8]">Game</p>
          <p>{foundation.game.name}</p>
        </div>

        <div>
          <p className="mb-1 text-xs uppercase text-[#6ee7d8]">
            Original Game Idea
          </p>
          <p>{session.originalConcept || "Not defined yet."}</p>
        </div>

        <div>
          <p className="mb-1 text-xs uppercase text-[#6ee7d8]">
            Discovery Status
          </p>
          <p>{formatLabel(session.status)}</p>
          {session.status === "complete" ? (
            <p className="mt-2 text-[#a9df5a]">DISCOVERY COMPLETE</p>
          ) : null}
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="mb-3 text-xs uppercase text-[#6ee7d8]">
            Describe Your Game
          </p>
          <div className="space-y-4">
            {DIRECT_DISCOVERY_FIELDS.map(([label, category]) => (
              <label key={category} className="block">
                <span className="mb-2 block text-xs text-[#6ee7d8]">
                  {label}
                </span>
                <textarea
                  value={answers[category] ?? ""}
                  onChange={(event) => {
                    const answer = event.target.value;
                    setAnswers((current) => ({ ...current, [category]: answer }));
                    onUpdateCategoryAnswer(category, answer);
                  }}
                  disabled={session.status === "complete"}
                  className="min-h-24 w-full border border-[#a9df5a] bg-[#0b111c] px-2 py-2 text-[#d7f5a0] outline-none disabled:opacity-60"
                  aria-label={label}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="mb-3 text-xs uppercase text-[#6ee7d8]">
            Discovery Understanding
          </p>
          <div className="space-y-2">
            {UNDERSTANDING_FIELDS.map(([label, key]) => (
              <div key={key}>
                <span className="text-[#6ee7d8]">{label}: </span>
                <span>{session.understanding[key] || "Not defined yet."}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onComplete}
          disabled={!hasAllCategoryAnswers || session.status === "complete"}
          className="border-2 border-[#a9df5a] bg-[#a9df5a] px-3 py-2 text-[#132019] disabled:cursor-not-allowed disabled:opacity-40"
        >
          COMPLETE DISCOVERY
        </button>
      </div>
    </section>
  );
}
