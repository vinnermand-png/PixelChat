import { createFileRoute } from "@tanstack/react-router";
import GameMaker from "@/components/pixel/GameMakerPatched";

export const Route = createFileRoute("/game-maker")({
  component: GameMaker,
});
