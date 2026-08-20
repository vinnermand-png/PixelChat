import { createFileRoute } from "@tanstack/react-router";
import PlatformLandscape from "@/components/pixel/PlatformLandscape";

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
  component: PlatformLandscape,
});
