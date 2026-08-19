import { createFileRoute } from "@tanstack/react-router";
import WorldLayoutEditor from "@/components/pixel/WorldLayoutEditor";

export const Route = createFileRoute("/nature-test")({
  head: () => ({
    meta: [
      { title: "Pixel Chat — World Layout Editor" },
      {
        name: "description",
        content: "Pixel Chat manual world layout editor on the locked isometric world template.",
      },
    ],
  }),
  component: WorldLayoutEditor,
});
