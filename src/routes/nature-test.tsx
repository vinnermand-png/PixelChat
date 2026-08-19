import { createFileRoute } from "@tanstack/react-router";
import NatureTestLarge from "@/components/pixel/NatureTestLarge";

export const Route = createFileRoute("/nature-test")({
  head: () => ({
    meta: [
      { title: "Pixel Chat — Nature Test v4" },
      {
        name: "description",
        content: "Standalone Pixel Chat large nature world and terrain asset test scene.",
      },
    ],
  }),
  component: NatureTestLarge,
});
