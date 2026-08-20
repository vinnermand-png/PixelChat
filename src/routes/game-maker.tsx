import { createFileRoute } from "@tanstack/react-router";
import GameMaker from "@/components/pixel/GameMaker";

export const Route = createFileRoute("/game-maker")({
  component: GameMaker,
});
