import { createFileRoute } from "@tanstack/react-router";
import NatureTest from "@/components/pixel/NatureTest";

export const Route = createFileRoute("/nature-test")({
  head: () => ({
    meta: [
      { title: "Pixel Chat — Nature Test v1" },
      {
        name: "description",
        content: "Standalone Pixel Chat nature and terrain asset test scene.",
      },
    ],
  }),
  component: NatureTest,
});
