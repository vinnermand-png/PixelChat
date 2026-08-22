import { createFileRoute } from "@tanstack/react-router";
import { requireAiEnabled, AiDisabledError } from "@/lib/ai/aiExecutionGuard";

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_MODEL = "gpt-image-1";
const MAX_PROMPT_LENGTH = 8000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/generate-asset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { prompt?: unknown };
          const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

          if (!prompt) {
            return json({ error: "A prompt is required." }, 400);
          }

          if (prompt.length > MAX_PROMPT_LENGTH) {
            return json({ error: "The prompt is too long." }, 400);
          }

          await requireAiEnabled();

          const apiKey = process.env.OPENAI_API_KEY?.trim();
          if (!apiKey) {
            return json(
              {
                error:
                  "AI image generation is not configured on the server. Add OPENAI_API_KEY to the server environment.",
              },
              503,
            );
          }

          const providerResponse = await fetch(OPENAI_IMAGE_ENDPOINT, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: OPENAI_IMAGE_MODEL,
              prompt,
              size: "1024x1024",
              output_format: "png",
            }),
          });

          const rawText = await providerResponse.text();
          let payload: OpenAiImageResponse | undefined;
          try {
            payload = JSON.parse(rawText) as OpenAiImageResponse;
          } catch {
            return json(
              {
                error: `OpenAI returned an invalid response (HTTP ${providerResponse.status}).`,
              },
              502,
            );
          }

          if (!providerResponse.ok) {
            return json(
              {
                error:
                  payload?.error?.message ||
                  `OpenAI image generation failed with HTTP ${providerResponse.status}.`,
              },
              502,
            );
          }

          const imageBase64 = payload?.data?.[0]?.b64_json;
          if (!imageBase64 || typeof imageBase64 !== "string") {
            return json({ error: "OpenAI returned no image data." }, 502);
          }

          return json({ imageBase64 });
        } catch (error) {
          if (error instanceof AiDisabledError) {
            return json({ error: error.message }, 503);
          }
          console.error("OpenAI asset generation failed", error);
          return json({ error: "AI asset generation failed on the server." }, 500);
        }
      },
    },
  },
});
