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
    return Response.json({ error: "OPENAI_API_KEY mangler. Tjek .env.local og genstart npm run dev." }, { status: 500 });
  }

  const body = await request.json() as { prompt?: unknown; kind?: unknown };
  const userPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const kind = body.kind === "foundation" ? "foundation" : "object";
  if (!userPrompt) return Response.json({ error: "Prompt mangler." }, { status: 400 });

  const objectPrompt = `Create one standalone game object for PixelChat. ${userPrompt}

STRICT OBJECT CONTRACT: crisp low-resolution pixel art, transparent background, no text, no UI, no scene, no floor, no shadow outside the object, no anti-aliasing, no blur, centered composition, readable silhouette, game-ready PNG, consistent simple colorful PixelChat visual style. The object must be isolated and must not contain terrain or other objects.`;

  const foundationPrompt = `Create a FULL-BLEED PixelChat terrain texture for one isometric foundation tile. ${userPrompt}

CRITICAL RENDER PIPELINE: PixelChat will automatically crop this generated image into the exact 32 × 16 isometric diamond. Therefore DO NOT draw an isometric diamond yourself. DO NOT draw a tile shape, border, outline, frame, white edge, black edge, grid line, seam, padding, margin, empty background, or any space around the terrain.

MANDATORY: The requested terrain texture must cover the ENTIRE 1024 × 1024 image from edge to edge. Full bleed. No transparent background. No separate object silhouette. No diamond shape. No single tile shown inside a larger canvas.

Generate only a seamless-looking pixel-art ground SURFACE texture. The result must look like continuous grass/dirt/stone/water/sand/snow/moss or the requested foundation material spread across the full image. Use subtle readable pixel variation so repeated tiles connect naturally.

No objects, characters, trees, rocks, buildings, props, UI, text, scene composition, cast shadows, or isolated tile shapes. Crisp hard pixel edges only. No anti-aliasing. No blur. Match the simple colorful PixelChat visual style.

IMPORTANT: AI GENERATES THE TEXTURE ONLY. PIXELCHAT GENERATES THE EXACT 32 × 16 ISOMETRIC DIAMOND SHAPE.`;

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
      background: kind === "foundation" ? "opaque" : "transparent",
      output_format: "png",
      quality: "low",
    }),
  });

  const payload = await openaiResponse.json() as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  };

  if (!openaiResponse.ok) {
    return Response.json({ error: payload.error?.message ?? "OpenAI image generation failed." }, { status: openaiResponse.status });
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
  return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
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
      if (url.pathname === "/api/generate-asset" && request.method === "POST") return await generateAsset(request);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  },
};
