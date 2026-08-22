import { createFileRoute } from "@tanstack/react-router";
import { getAiSettings, setAiEnabled } from "@/lib/ai/aiSettings";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/ai/status")({
  server: {
    handlers: {
      GET: async () => json(await getAiSettings()),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { enabled?: unknown };
          if (typeof body.enabled !== "boolean") {
            return json({ error: "enabled must be a boolean." }, 400);
          }
          return json(await setAiEnabled(body.enabled));
        } catch (error) {
          console.error("AI settings update failed", error);
          return json({ error: "Unable to update AI settings." }, 500);
        }
      },
    },
  },
});
