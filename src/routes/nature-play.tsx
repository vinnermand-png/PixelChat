import { createFileRoute } from "@tanstack/react-router";
import NatureMapPlay from "@/components/pixel/NatureMapPlay";

export const Route = createFileRoute("/nature-play")({
  head: () => ({
    meta: [
      { title: "Pixel Chat — Nature World Player Test" },
      {
        name: "description",
        content: "Pixel Chat Player 01 movement test on the fixed nature world map.",
      },
    ],
  }),
  component: NatureMapPlay,
});
