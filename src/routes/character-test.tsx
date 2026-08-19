import { createFileRoute } from "@tanstack/react-router";
import CharacterAnimationTest from "@/components/pixel/CharacterAnimationTest";

export const Route = createFileRoute("/character-test")({
  head: () => ({
    meta: [
      { title: "Pixel Chat — Character Animation Test" },
      {
        name: "description",
        content: "Isolated Player 01 walk-cycle test.",
      },
    ],
  }),
  component: CharacterAnimationTest,
});
