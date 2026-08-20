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

  const body = await request.json() as { prompt?: unknown };
  const userPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!userPrompt) return Response.json({ error: "Prompt mangler." }, { status: 400 });

  const prompt = `Create one standalone game asset for PixelChat. ${userPrompt}\n\nSTRICT STYLE LOCK: crisp low-resolution pixel art, transparent background, no text, no UI, no scene, no floor, no shadow outside the asset, no anti-aliasing, no blur, centered composition, readable silhouette, game-ready PNG, consistent simple colorful PixelChat visual style.`;

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

  return Response.json({ imageBase64 });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
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
