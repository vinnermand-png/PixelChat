import { createFileRoute } from "@tanstack/react-router";

type ImageProviderResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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

          const apiKey = process.env.AI_IMAGE_API_KEY ?? process.env.OPENAI_API_KEY;
          const apiUrl =
            process.env.AI_IMAGE_API_URL ?? "https://api.openai.com/v1/images/generations";
          const model = process.env.AI_IMAGE_MODEL ?? "gpt-image-1";

          if (!apiKey) {
            return json(
              {
                error:
                  "AI image generation is not configured. Add OPENAI_API_KEY (or AI_IMAGE_API_KEY) to the server environment.",
              },
              503,
            );
          }

          const providerResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              prompt,
              size: "1024x1024",
              output_format: "png",
            }),
          });

          const rawText = await providerResponse.text();
          let payload: ImageProviderResponse | undefined;
          try {
            payload = JSON.parse(rawText) as ImageProviderResponse;
          } catch {
            return json(
              {
                error: `Image provider returned a non-JSON response (HTTP ${providerResponse.status}).`,
              },
              502,
            );
          }

          if (!providerResponse.ok) {
            return json(
              {
                error:
                  payload?.error?.message ||
                  `Image provider failed with HTTP ${providerResponse.status}.`,
              },
              providerResponse.status,
            );
          }

          const image = payload?.data?.[0];
          if (image?.b64_json) {
            return json({ imageBase64: image.b64_json });
          }

          if (image?.url) {
            const imageResponse = await fetch(image.url);
            if (!imageResponse.ok) {
              return json({ error: "The image provider returned an unreadable image URL." }, 502);
            }
            const bytes = new Uint8Array(await imageResponse.arrayBuffer());
            return json({ imageBase64: bytesToBase64(bytes) });
          }

          return json({ error: "The image provider returned no image data." }, 502);
        } catch (error) {
          console.error("AI asset generation failed", error);
          return json({ error: "AI asset generation failed on the server." }, 500);
        }
      },
    },
  },
});