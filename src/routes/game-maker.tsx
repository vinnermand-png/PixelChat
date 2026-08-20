import { createFileRoute } from "@tanstack/react-router";
import GameMakerV2 from "@/components/pixel/GameMakerV2";

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
  component: GameMakerV2,
});
