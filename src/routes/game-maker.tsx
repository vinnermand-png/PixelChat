import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import GameCreationDialog from "@/components/pixel/GameCreationDialog";
import GameDiscoveryPanel from "@/components/pixel/GameDiscoveryPanel";
import GameFoundationInspector from "@/components/pixel/GameFoundationInspector";
import GameMakerV2 from "@/components/pixel/GameMakerV2";
import {
  addDiscoveryQuestion,
  completeDiscovery,
  startDiscovery,
  submitDiscoveryAnswer,
} from "@/lib/gameDiscovery/gameDiscoveryApi";
import type {
  GameDiscoveryQuestionCategory,
  GameDiscoveryQuestionImportance,
  GameDiscoverySession,
} from "@/lib/gameDiscovery/gameDiscovery";
import type { GameFoundation } from "@/lib/gameFoundation/gameFoundation";

function GameMakerRoute() {
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [isFoundationInspectorOpen, setIsFoundationInspectorOpen] =
    useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [activeFoundation, setActiveFoundation] =
    useState<GameFoundation | null>(null);
  const [discoverySession, setDiscoverySession] =
    useState<GameDiscoverySession | null>(null);

  const handleStartDiscovery = () => {
    if (!activeFoundation) {
      return;
    }

    if (discoverySession) {
      setIsDiscoveryOpen(true);
      return;
    }

    const session = startDiscovery({
      id: crypto.randomUUID(),
      foundation: activeFoundation,
    });

    setDiscoverySession(session);
    setIsDiscoveryOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0b111c] px-4 py-3 text-white">
        <div className="text-sm font-semibold">
          {activeFoundation
            ? `Game: ${activeFoundation.game.name}`
            : "No Game Selected"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStartDiscovery}
            disabled={!activeFoundation}
            className="rounded border border-[#c084fc] px-3 py-2 text-xs font-semibold text-[#c084fc] disabled:cursor-not-allowed disabled:opacity-40"
          >
            START DISCOVERY
          </button>
          <button
            type="button"
            onClick={() => setIsFoundationInspectorOpen(true)}
            className="rounded border border-[#6ee7d8] px-3 py-2 text-xs font-semibold text-[#6ee7d8]"
          >
            GAME FOUNDATION
          </button>
          <button
            type="button"
            onClick={() => setIsCreateGameOpen(true)}
            className="rounded border border-[#a9df5a] px-3 py-2 text-xs font-semibold text-[#a9df5a]"
          >
            CREATE GAME
          </button>
        </div>
      </div>

      <GameMakerV2 />

      {isCreateGameOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <GameCreationDialog
            onCancel={() => setIsCreateGameOpen(false)}
            onGameCreated={(foundation) => {
              setActiveFoundation(foundation);
              setDiscoverySession(null);
              setIsDiscoveryOpen(false);
              setIsCreateGameOpen(false);
            }}
          />
        </div>
      ) : null}

      {isFoundationInspectorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <GameFoundationInspector
            foundation={activeFoundation}
            onClose={() => setIsFoundationInspectorOpen(false)}
          />
        </div>
      ) : null}

      {isDiscoveryOpen && activeFoundation && discoverySession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <GameDiscoveryPanel
            foundation={activeFoundation}
            session={discoverySession}
            onAddQuestion={(
              input: {
                category: GameDiscoveryQuestionCategory;
                question: string;
                importance: GameDiscoveryQuestionImportance;
              },
            ) => {
              setDiscoverySession((current) => {
                if (!current) {
                  return current;
                }

                return addDiscoveryQuestion(current, {
                  id: crypto.randomUUID(),
                  ...input,
                });
              });
            }}
            onAnswerQuestion={(questionId, answer) => {
              setDiscoverySession((current) =>
                current
                  ? submitDiscoveryAnswer(current, questionId, answer)
                  : current,
              );
            }}
            onComplete={() => {
              setDiscoverySession((current) =>
                current ? completeDiscovery(current) : current,
              );
            }}
            onClose={() => setIsDiscoveryOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/game-maker")({
  head: () => ({
    meta: [
      { title: "PixelChat Game Maker V2" },
      {
        name: "description",
        content: "PixelChat isometric world editor V2.",
      },
    ],
  }),
  component: GameMakerRoute,
});
