import { useState } from "react";
import type {
  GameDiscoveryQuestionCategory,
  GameDiscoveryQuestionImportance,
  GameDiscoverySession,
} from "@/lib/gameDiscovery/gameDiscovery";
import type { GameFoundation } from "@/lib/gameFoundation/gameFoundation";

export interface GameDiscoveryPanelProps {
  foundation: GameFoundation;
  session: GameDiscoverySession;
  onAddQuestion: (input: {
    category: GameDiscoveryQuestionCategory;
    question: string;
    importance: GameDiscoveryQuestionImportance;
  }) => void;
  onAnswerQuestion: (questionId: string, answer: string) => void;
  onComplete: () => void;
  onClose: () => void;
}

const QUESTION_CATEGORIES: GameDiscoveryQuestionCategory[] = [
  "game_type",
  "core_experience",
  "player_activity",
  "world",
  "social",
  "progression",
  "goals",
  "visual_direction",
  "other",
];

const QUESTION_IMPORTANCE: GameDiscoveryQuestionImportance[] = [
  "required",
  "recommended",
  "optional",
];

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

export default function GameDiscoveryPanel({
  foundation,
  session,
  onAddQuestion,
  onAnswerQuestion,
  onComplete,
  onClose,
}: GameDiscoveryPanelProps) {
  const [newQuestion, setNewQuestion] = useState("");
  const [category, setCategory] =
    useState<GameDiscoveryQuestionCategory>("other");
  const [importance, setImportance] =
    useState<GameDiscoveryQuestionImportance>("recommended");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const hasPendingQuestions = session.questions.some(
    (question) => question.status === "pending",
  );

  const handleAddQuestion = () => {
    const question = newQuestion.trim();
    if (!question) {
      return;
    }

    onAddQuestion({ category, question, importance });
    setNewQuestion("");
  };

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
            Discovery Questions
          </p>

          {session.questions.length === 0 ? (
            <p className="mb-4">No discovery questions yet.</p>
          ) : (
            <div className="mb-4 space-y-3">
              {session.questions.map((item) => (
                <div key={item.id} className="border border-white/10 p-3">
                  <p>{item.question}</p>
                  <p className="mt-2 text-xs text-[#6ee7d8]">
                    {formatLabel(item.category)} • {formatLabel(item.importance)} • {formatLabel(item.status)}
                  </p>

                  {item.status === "answered" ? (
                    <p className="mt-2">Answer: {item.answer || "No answer provided."}</p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={answers[item.id] ?? ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="min-h-20 w-full border border-[#6ee7d8] bg-[#0b111c] px-2 py-2 text-[#d7f5a0] outline-none"
                        aria-label={`Answer for ${item.question}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const answer = (answers[item.id] ?? "").trim();
                          if (!answer) {
                            return;
                          }
                          onAnswerQuestion(item.id, answer);
                          setAnswers((current) => ({
                            ...current,
                            [item.id]: "",
                          }));
                        }}
                        className="w-fit border border-[#a9df5a] px-3 py-2 text-xs text-[#a9df5a]"
                      >
                        SUBMIT ANSWER
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border border-white/10 p-3">
            <p className="text-xs uppercase text-[#6ee7d8]">
              Add Question
            </p>
            <textarea
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
              className="min-h-20 w-full border border-[#a9df5a] bg-[#0b111c] px-2 py-2 text-[#d7f5a0] outline-none"
              aria-label="New discovery question"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs text-[#6ee7d8]">Category</span>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as GameDiscoveryQuestionCategory)
                  }
                  className="w-full border border-[#a9df5a] bg-[#0b111c] px-2 py-2 text-[#d7f5a0]"
                >
                  {QUESTION_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs text-[#6ee7d8]">Importance</span>
                <select
                  value={importance}
                  onChange={(event) =>
                    setImportance(event.target.value as GameDiscoveryQuestionImportance)
                  }
                  className="w-full border border-[#a9df5a] bg-[#0b111c] px-2 py-2 text-[#d7f5a0]"
                >
                  {QUESTION_IMPORTANCE.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="border border-[#a9df5a] px-3 py-2 text-xs text-[#a9df5a]"
            >
              ADD QUESTION
            </button>
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
          disabled={hasPendingQuestions || session.status === "complete"}
          className="border-2 border-[#a9df5a] bg-[#a9df5a] px-3 py-2 text-[#132019] disabled:cursor-not-allowed disabled:opacity-40"
        >
          COMPLETE DISCOVERY
        </button>
      </div>
    </section>
  );
}
