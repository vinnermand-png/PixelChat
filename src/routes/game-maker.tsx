import { createFileRoute } from "@tanstack/react-router";
import GameMaker from "@/components/pixel/GameMaker";

export const Route = createFileRoute("/game-maker")({
  head: () => ({
    meta: [
      { title: "PixelGame Maker — PixelChat" },
      {
        name: "description",
        content: "PixelChat isometric world and asset editor.",
      },
    ],
  }),
  component: GameMaker,
});
