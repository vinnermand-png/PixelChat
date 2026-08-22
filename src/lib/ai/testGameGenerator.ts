import type { WorldSizeConfig } from "@/lib/gameFoundation/gameFoundation";
import type { GeneratedGameResponse } from "@/routes/api/generate-game";

function cleanName(value: string): string {
  const normalized = value.trim();
  return normalized || "Test World";
}

function cleanConcept(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || "A friendly multiplayer social game world.";
}

export function generateTestGameResponse(
  gameName: string,
  concept: string,
  worldSize: WorldSizeConfig,
): GeneratedGameResponse {
  const name = cleanName(gameName);
  const worldConcept = cleanConcept(concept);
  const sizeLabel = `${worldSize.preset} (${worldSize.width}x${worldSize.height})`;

  return {
    game: { name },
    blueprint: {
      concept: worldConcept,
      coreExperience: "A friendly multiplayer social world built around meeting other players, exploring, and repeating a simple shared activity.",
      coreLoop: "Enter the world → meet players → explore connected areas → participate in the core activity → return to the social hub.",
      playerMode: "Multiplayer social",
      systems: ["Shared social hub", "Exploration", "Core activity", "Player chat", `World scale: ${sizeLabel}`],
      openQuestions: ["What player progression should unlock next?", "Which social activities should become persistent multiplayer systems?"],
    },
    discovery: {
      gameType: "Cozy multiplayer social game",
      coreExperience: "Players meet, chat, explore, and participate in a welcoming shared world.",
      playerActivity: "Move around the world, discover locations, interact with the environment, and spend time with other players.",
      worldConcept,
      socialInteraction: "Players gather in shared spaces, chat, explore together, and create their own small social moments.",
      progression: "Gradual discovery of places, activities, cosmetics, and social goals without forcing players through a rigid path.",
      gameplayGoals: "Make the world easy to understand, rewarding to explore, and enjoyable to revisit with other players.",
      visualIdentity: "Colorful, friendly, readable pixel art with clear silhouettes, approachable shapes, and strong spatial readability.",
      additionalNotes: `Deterministic local test generation. World size constraint: ${sizeLabel}.`,
    },
    dna: {
      creativeAnchor: "A welcoming shared pixel world where social connection is the main reason to stay.",
      coreIdentity: `${name} is a cozy multiplayer world centered on social discovery and a clear shared activity.`,
      emotionalIdentity: "Warm, playful, relaxed, and inviting.",
      worldIdentity: `${worldConcept} The world should feel connected, readable, and intentionally sized for ${sizeLabel}.`,
      visualIdentity: "Bright, colorful, readable pixel art designed for quick navigation and social readability.",
      assetIdentity: "Simple, consistent pixel-art terrain, props, landmarks, buildings, and social spaces with strong silhouettes.",
    },
  };
}
