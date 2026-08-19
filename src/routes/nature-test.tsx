import { createFileRoute } from "@tanstack/react-router";
import NatureMapEditor from "@/components/pixel/NatureMapEditor";

export const Route = createFileRoute("/nature-test")({
  head: () => ({
    meta: [
      { title: "Pixel Chat — Nature World Map" },
      {
        name: "description",
        content: "Pixel Chat nature world using the fixed hand-designed map artwork.",
      },
    ],
  }),
  component: NatureMapEditor,
});
