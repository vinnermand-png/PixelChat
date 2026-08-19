import { createFileRoute } from "@tanstack/react-router";
import NatureEditor from "@/components/pixel/NatureEditor";

export const Route = createFileRoute("/nature-test")({
  head: () => ({
    meta: [
      { title: "Pixel Chat — Nature Editor v1" },
      {
        name: "description",
        content: "Manual Pixel Chat nature world editor and asset placement test.",
      },
    ],
  }),
  component: NatureEditor,
});
