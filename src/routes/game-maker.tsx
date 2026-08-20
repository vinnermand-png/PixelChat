import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import GameCreationDialog from "@/components/pixel/GameCreationDialog";
import GameMakerV2 from "@/components/pixel/GameMakerV2";
import type { GameFoundation } from "@/lib/gameFoundation/gameFoundation";

function GameMakerRoute() {
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [activeFoundation, setActiveFoundation] =
    useState<GameFoundation | null>(null);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#0b111c] px-4 py-3 text-white">
        <div className="text-sm font-semibold">
          {activeFoundation
            ? `Game: ${activeFoundation.game.name}`
            : "No Game Selected"}
        </div>
        <button
          type="button"
          onClick={() => setIsCreateGameOpen(true)}
          className="rounded border border-[#a9df5a] px-3 py-2 text-xs font-semibold text-[#a9df5a]"
        >
          CREATE GAME
        </button>
      </div>

      <GameMakerV2 />

      {isCreateGameOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <GameCreationDialog
            onCancel={() => setIsCreateGameOpen(false)}
            onGameCreated={(foundation) => {
              setActiveFoundation(foundation);
              setIsCreateGameOpen(false);
            }}
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
