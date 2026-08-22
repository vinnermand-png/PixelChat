import { createFileRoute } from "@tanstack/react-router";
import { AiDisabledError, requireAiEnabled } from "@/lib/ai/aiExecutionGuard";
import { isValidAiToolRequest, type AiToolRequestV1 } from "@/lib/aiTool/aiToolRequest";
import { generateTestMapBuilderResult } from "@/lib/aiTool/testMapBuilderGenerator";
import { isValidMapBuilderAiResultV2, MAP_BUILDER_MAX_OPERATIONS } from "@/lib/aiTool/mapBuilderAiResult";
import { ASSET_LIBRARY } from "@/components/pixel/assets/assetLibrary";
import { TERRAIN_LIBRARY } from "@/components/pixel/terrain/terrainAssetLibrary";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_TEXT_MODEL = "gpt-5.6-luna";

const TERRAIN_ID_LIST = TERRAIN_LIBRARY.map((terrain) => terrain.id).join(", ");
const OBJECT_ID_LIST = ASSET_LIBRARY.map((asset) => asset.id).join(", ");

type OpenAiResponsesPayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "summary", "operations"],
  properties: {
    version: { type: "integer" },
    summary: { type: "string", minLength: 1, maxLength: 2000 },
    operations: {
      type: "array",
      minItems: 1,
      maxItems: MAP_BUILDER_MAX_OPERATIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "target", "terrain", "object"],
        properties: {
          type: { type: "string", enum: ["paint-terrain", "place-object"] },
          target: { type: "string", minLength: 1, maxLength: 80 },
          terrain: { type: ["string", "null"], maxLength: 80 },
          object: { type: ["string", "null"], maxLength: 80 },
        },
      },
    },
  },
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function extractResponseText(payload: OpenAiResponsesPayload): string | undefined {
  return payload.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" && typeof content.text === "string")
    ?.text;
}

function describeMapBuilderContext(request: AiToolRequestV1): string {
  const context = request.context;
  const terrainCounts = Object.entries(context.map.terrainSummary.countsPerTerrainId).map(([terrainId, count]) => `${terrainId}: ${count}`).join(", ") || "none";
  const seeds = context.worldSeeds?.map((seed) => `${seed.label} (${seed.kind})`).join(", ") || "none";
  const keyLocations = context.map.structure?.keyLocations.length ? context.map.structure.keyLocations.map((location) => location.label).join(", ") : "none";
  return [
    `Game: ${context.game.name}`,
    `Active map: ${context.map.name} (${context.map.id}), grid ${context.map.gridSize}x${context.map.gridSize}`,
    `Painted terrain cells: ${context.map.terrainSummary.paintedCells} [${terrainCounts}]`,
    `Placed objects: ${context.map.objects.length}`,
    `Key locations: ${keyLocations}`,
    `World Seeds: ${seeds}`,
    context.dna?.worldIdentity ? `World identity: ${context.dna.worldIdentity}` : "",
  ].filter(Boolean).join("\n");
}

export const Route = createFileRoute("/api/ai-tool/map-builder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body: unknown = await request.json();
          if (!isValidAiToolRequest(body)) {
            return json({ error: "Invalid AI tool request." }, 400);
          }
          if (body.tool !== "map-builder") {
            return json({ error: "Unsupported AI tool." }, 400);
          }

          try {
            await requireAiEnabled();
          } catch (error) {
            if (error instanceof AiDisabledError) {
              return json(generateTestMapBuilderResult(body));
            }
            throw error;
          }

          const apiKey = process.env.OPENAI_API_KEY?.trim();
          if (!apiKey) {
            return json({ error: "AI generation is not configured on the server. Add OPENAI_API_KEY to the server environment." }, 503);
          }

          const providerResponse = await fetch(OPENAI_RESPONSES_ENDPOINT, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: OPENAI_TEXT_MODEL,
              input: [
                {
                  role: "system",
                  content: [{
                    type: "input_text",
                    text: `You are the PixelChat Map Builder assistant. The user describes a change they want for their current pixel world map. Propose how to fulfill that request as a short list of read-only operations. You must NOT change anything, apply anything, or produce coordinates. Return ONLY JSON matching the schema: {"version":2,"summary":"...","operations":[...]}. The summary must concretely restate what you propose, including any named locations from the user's wording. Each operation must be exactly one of: paint-terrain (fields: terrain, target) or place-object (fields: object, target). Use ONLY these terrain identifiers: ${TERRAIN_ID_LIST}. Use ONLY these object identifiers: ${OBJECT_ID_LIST}. Every target is a short kebab-case semantic area label (for example 'forest-gathering-clearing'), never a coordinate or cell reference. Do not output prose outside the JSON.`,
                  }],
                },
                {
                  role: "user",
                  content: [{
                    type: "input_text",
                    text: `${describeMapBuilderContext(body)}\n\nUser request:\n${body.request}\n\nPropose between 1 and 8 concrete operations.`,
                  }],
                },
              ],
              text: { format: { type: "json_schema", name: "pixelchat_map_builder_result_v2", strict: true, schema: responseSchema } },
            }),
          });

          const rawText = await providerResponse.text();
          let payload: OpenAiResponsesPayload | undefined;
          try {
            payload = JSON.parse(rawText) as OpenAiResponsesPayload;
          } catch {
            return json({ error: `OpenAI returned an invalid response (HTTP ${providerResponse.status}).` }, 502);
          }

          if (!providerResponse.ok) {
            return json({ error: payload?.error?.message || `OpenAI Map Builder request failed with HTTP ${providerResponse.status}.` }, 502);
          }

          const outputText = extractResponseText(payload);
          if (!outputText) {
            return json({ error: "OpenAI returned no structured Map Builder result." }, 502);
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(outputText);
          } catch {
            return json({ error: "OpenAI returned malformed structured Map Builder data." }, 502);
          }

          if (!isValidMapBuilderAiResultV2(parsed)) {
            return json({ error: "OpenAI returned an invalid structured Map Builder proposal." }, 502);
          }

          return json(parsed);
        } catch (error) {
          if (error instanceof AiDisabledError) {
            return json({ error: error.message }, 503);
          }
          console.error("OpenAI Map Builder request failed", error);
          return json({ error: error instanceof Error ? error.message : "The Map Builder request failed on the server." }, 400);
        }
      },
    },
  },
});
