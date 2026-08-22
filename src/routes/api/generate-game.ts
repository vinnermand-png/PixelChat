import { createFileRoute } from "@tanstack/react-router";
import { AiDisabledError, requireAiEnabled } from "@/lib/ai/aiExecutionGuard";
import { generateTestGameResponse } from "@/lib/ai/testGameGenerator";
import { normalizeWorldSizeConfig, type WorldSizeConfig } from "@/lib/gameFoundation/gameFoundation";

export type GeneratedGameResponse = {
  game: { name: string };
  blueprint: {
    concept: string;
    coreExperience: string;
    coreLoop: string;
    playerMode: string;
    systems: string[];
    openQuestions: string[];
  };
  discovery: {
    gameType: string;
    coreExperience: string;
    playerActivity: string;
    worldConcept: string;
    socialInteraction: string;
    progression: string;
    gameplayGoals: string;
    visualIdentity: string;
    additionalNotes: string;
  };
  dna: {
    creativeAnchor: string;
    coreIdentity: string;
    emotionalIdentity: string;
    worldIdentity: string;
    visualIdentity: string;
    assetIdentity: string;
  };
};

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

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const OPENAI_TEXT_MODEL = "gpt-5.6-luna";
const MAX_CONCEPT_LENGTH = 8000;
const MAX_FIELD_LENGTH = 2000;
const MAX_SHORT_FIELD_LENGTH = 240;
const MAX_LIST_ITEMS = 12;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["game", "blueprint", "discovery", "dna"],
  properties: {
    game: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
    },
    blueprint: {
      type: "object",
      additionalProperties: false,
      required: ["concept", "coreExperience", "coreLoop", "playerMode", "systems", "openQuestions"],
      properties: {
        concept: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        coreExperience: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        coreLoop: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        playerMode: { type: "string", minLength: 1, maxLength: 120 },
        systems: { type: "array", minItems: 1, maxItems: MAX_LIST_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_SHORT_FIELD_LENGTH } },
        openQuestions: { type: "array", maxItems: MAX_LIST_ITEMS, items: { type: "string", minLength: 1, maxLength: MAX_SHORT_FIELD_LENGTH } },
      },
    },
    discovery: {
      type: "object",
      additionalProperties: false,
      required: ["gameType", "coreExperience", "playerActivity", "worldConcept", "socialInteraction", "progression", "gameplayGoals", "visualIdentity", "additionalNotes"],
      properties: {
        gameType: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        coreExperience: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        playerActivity: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        worldConcept: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        socialInteraction: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        progression: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        gameplayGoals: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        visualIdentity: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        additionalNotes: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
      },
    },
    dna: {
      type: "object",
      additionalProperties: false,
      required: ["creativeAnchor", "coreIdentity", "emotionalIdentity", "worldIdentity", "visualIdentity", "assetIdentity"],
      properties: {
        creativeAnchor: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        coreIdentity: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        emotionalIdentity: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        worldIdentity: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        visualIdentity: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
        assetIdentity: { type: "string", minLength: 1, maxLength: MAX_FIELD_LENGTH },
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

function validateString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maxLength) throw new Error(`${label} exceeds the allowed length.`);
  return normalized;
}

function validateList(value: unknown, label: string, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > maxItems) throw new Error(`${label} contains too many items.`);
  return value.map((item, index) => validateString(item, `${label}[${index}]`, maxItemLength));
}

function validateGeneratedGame(value: unknown): GeneratedGameResponse {
  if (!value || typeof value !== "object") throw new Error("AI response must be an object.");
  const data = value as Record<string, unknown>;
  const game = data.game;
  const blueprint = data.blueprint;
  const discovery = data.discovery;
  const dna = data.dna;
  if (!game || typeof game !== "object" || !blueprint || typeof blueprint !== "object" || !discovery || typeof discovery !== "object" || !dna || typeof dna !== "object") {
    throw new Error("AI response is missing a required section.");
  }

  const gameRecord = game as Record<string, unknown>;
  const blueprintRecord = blueprint as Record<string, unknown>;
  const discoveryRecord = discovery as Record<string, unknown>;
  const dnaRecord = dna as Record<string, unknown>;

  return {
    game: { name: validateString(gameRecord.name, "game.name", 120) },
    blueprint: {
      concept: validateString(blueprintRecord.concept, "blueprint.concept", MAX_FIELD_LENGTH),
      coreExperience: validateString(blueprintRecord.coreExperience, "blueprint.coreExperience", MAX_FIELD_LENGTH),
      coreLoop: validateString(blueprintRecord.coreLoop, "blueprint.coreLoop", MAX_FIELD_LENGTH),
      playerMode: validateString(blueprintRecord.playerMode, "blueprint.playerMode", 120),
      systems: validateList(blueprintRecord.systems, "blueprint.systems", MAX_LIST_ITEMS, MAX_SHORT_FIELD_LENGTH),
      openQuestions: validateList(blueprintRecord.openQuestions ?? [], "blueprint.openQuestions", MAX_LIST_ITEMS, MAX_SHORT_FIELD_LENGTH),
    },
    discovery: {
      gameType: validateString(discoveryRecord.gameType, "discovery.gameType", MAX_FIELD_LENGTH),
      coreExperience: validateString(discoveryRecord.coreExperience, "discovery.coreExperience", MAX_FIELD_LENGTH),
      playerActivity: validateString(discoveryRecord.playerActivity, "discovery.playerActivity", MAX_FIELD_LENGTH),
      worldConcept: validateString(discoveryRecord.worldConcept, "discovery.worldConcept", MAX_FIELD_LENGTH),
      socialInteraction: validateString(discoveryRecord.socialInteraction, "discovery.socialInteraction", MAX_FIELD_LENGTH),
      progression: validateString(discoveryRecord.progression, "discovery.progression", MAX_FIELD_LENGTH),
      gameplayGoals: validateString(discoveryRecord.gameplayGoals, "discovery.gameplayGoals", MAX_FIELD_LENGTH),
      visualIdentity: validateString(discoveryRecord.visualIdentity, "discovery.visualIdentity", MAX_FIELD_LENGTH),
      additionalNotes: validateString(discoveryRecord.additionalNotes, "discovery.additionalNotes", MAX_FIELD_LENGTH),
    },
    dna: {
      creativeAnchor: validateString(dnaRecord.creativeAnchor, "dna.creativeAnchor", MAX_FIELD_LENGTH),
      coreIdentity: validateString(dnaRecord.coreIdentity, "dna.coreIdentity", MAX_FIELD_LENGTH),
      emotionalIdentity: validateString(dnaRecord.emotionalIdentity, "dna.emotionalIdentity", MAX_FIELD_LENGTH),
      worldIdentity: validateString(dnaRecord.worldIdentity, "dna.worldIdentity", MAX_FIELD_LENGTH),
      visualIdentity: validateString(dnaRecord.visualIdentity, "dna.visualIdentity", MAX_FIELD_LENGTH),
      assetIdentity: validateString(dnaRecord.assetIdentity, "dna.assetIdentity", MAX_FIELD_LENGTH),
    },
  };
}

function extractResponseText(payload: OpenAiResponsesPayload): string | undefined {
  return payload.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" && typeof content.text === "string")
    ?.text;
}

function validateWorldSize(input: unknown): WorldSizeConfig {
  try {
    return normalizeWorldSizeConfig(input);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid world size configuration.");
  }
}

export const Route = createFileRoute("/api/generate-game")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { gameName?: unknown; concept?: unknown; worldSize?: unknown };
          const gameName = validateString(body.gameName, "gameName", 120);
          const concept = validateString(body.concept, "concept", MAX_CONCEPT_LENGTH);
          const worldSize = validateWorldSize(body.worldSize);

          try {
            await requireAiEnabled();
          } catch (error) {
            if (error instanceof AiDisabledError) {
              return json(validateGeneratedGame(generateTestGameResponse(gameName, concept, worldSize)));
            }
            throw error;
          }

          const apiKey = process.env.OPENAI_API_KEY?.trim();
          if (!apiKey) {
            return json({ error: "AI game generation is not configured on the server. Add OPENAI_API_KEY to the server environment." }, 503);
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
                    text: "You are the PixelChat game creation designer. Turn the user's concept into concise, concrete game-design data. Return only the requested structured JSON. Preserve the user's intent, favor social multiplayer readability, and keep all values directly useful for the existing GameFoundation, GameDiscoverySession, and GameDnaVersion models. Do not invent technical implementation details or new schemas. World size is a hard design constraint: Small worlds stay compact, Medium worlds balance social/core space and exploration, Large worlds support multiple connected areas and more exploration, and Huge worlds support broad exploration and more room for locations.",
                  }],
                },
                {
                  role: "user",
                  content: [{
                    type: "input_text",
                    text: `Preferred game name: ${gameName}\n\nSelected world size: ${worldSize.preset} (${worldSize.width}x${worldSize.height}).\nDesign the game concept, Discovery, and Game DNA to fit this amount of world space.\n\nGame concept:\n${concept}`,
                  }],
                },
              ],
              text: { format: { type: "json_schema", name: "pixelchat_game_generation", strict: true, schema: responseSchema } },
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
            return json({ error: payload?.error?.message || `OpenAI game generation failed with HTTP ${providerResponse.status}.` }, 502);
          }

          const outputText = extractResponseText(payload);
          if (!outputText) {
            if (process.env.NODE_ENV === "development") {
              console.error("OpenAI Responses API payload with no extractable output text:", payload);
              return json({
                error: "OpenAI returned no structured game data.",
                debug: {
                  outputTypes: payload.output?.map((item) => item.type ?? null) ?? [],
                  contentTypes: payload.output?.flatMap((item) => (item.content ?? []).map((content) => content.type ?? null)) ?? [],
                },
              }, 502);
            }
            return json({ error: "OpenAI returned no structured game data." }, 502);
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(outputText);
          } catch {
            return json({ error: "OpenAI returned malformed structured game data." }, 502);
          }

          return json(validateGeneratedGame(parsed));
        } catch (error) {
          if (error instanceof AiDisabledError) {
            return json({ error: error.message }, 503);
          }
          console.error("OpenAI game generation failed", error);
          return json({ error: error instanceof Error ? error.message : "AI game generation failed on the server." }, 400);
        }
      },
    },
  },
});
