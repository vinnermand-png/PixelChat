import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function readApiKey(): string | undefined {
  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.OPENAI_API_KEY;
}

async function generateAsset(request: Request): Promise<Response> {
  const apiKey = readApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY mangler. Tjek .env.local og genstart npm run dev." },
      { status: 500 },
    );
  }

  const body = await request.json() as { prompt?: unknown; kind?: unknown };
  const userPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const kind = body.kind === "foundation" ? "foundation" : "object";
  if (!userPrompt) return Response.json({ error: "Prompt mangler." }, { status: 400 });

  const objectPrompt = `Create one standalone game object for PixelChat. ${userPrompt}

STRICT OBJECT CONTRACT: crisp low-resolution pixel art, transparent background, no text, no UI, no scene, no floor, no shadow outside the object, no anti-aliasing, no blur, centered composition, readable silhouette, game-ready PNG, consistent simple colorful PixelChat visual style. The object must be isolated and must not contain terrain or other objects.`;

  const foundationPrompt = `Create EXACTLY ONE game-ready PixelChat foundation tile for a locked isometric grid. ${userPrompt}

ABSOLUTE FOUNDATION CONTRACT:
- The asset represents ONE AND ONLY ONE 2:1 isometric diamond tile.
- The game engine grid is EXACTLY 32 pixels wide × 16 pixels high. The output may be generated larger, but it will be normalized by the editor to EXACTLY 32 × 16 pixels with nearest-neighbour pixel scaling only.
- Design the visual composition so the final normalized result fits this exact 32 × 16 diamond contract.
- The diamond must align exactly with the four neighbouring 32 × 16 isometric diamonds when repeated.
- The four edge boundaries must connect seamlessly to adjacent copies of the SAME tile.
- Transparent background outside the single diamond.
- The terrain surface must fill the diamond all the way to its four corner boundaries.
- No padding inside the canvas around the intended diamond.
- No white border, no white pixels on the edge, no outline, no frame, no grid lines, no seams, no gaps.
- No cast shadow outside the diamond.
- No second tile, no repeated tile pattern, no tile sheet, no large map, no scene.
- No perspective floor beyond the single diamond.
- No text, no UI, no characters, no trees, no rocks, no buildings, no props, no separate objects unless explicitly part of the requested ground texture.
- Crisp low-resolution pixel art only: hard pixels, nearest-neighbour look, no anti-aliasing, no blur.
- Keep colour variation subtle and readable so repeated tiles look natural without visible repetition.

IMPORTANT: Generate the visual design for ONE EXACT 32 × 16 ISOMETRIC FOUNDATION TILE. The PixelChat engine, not the AI, will repeat and place this tile across the world.`;

  const prompt = kind === "foundation" ? foundationPrompt : objectPrompt;

  const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      background: "transparent",
      output_format: "png",
      quality: "low",
    }),
  });

  const payload = await openaiResponse.json() as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  };

  if (!openaiResponse.ok) {
    return Response.json(
      { error: payload.error?.message ?? "OpenAI image generation failed." },
      { status: openaiResponse.status },
    );
  }

  const imageBase64 = payload.data?.[0]?.b64_json;
  if (!imageBase64) return Response.json({ error: "OpenAI returnerede intet billede." }, { status: 502 });

  return Response.json({ imageBase64, kind });
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/generate-asset" && request.method === "POST") {
        return await generateAsset(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
