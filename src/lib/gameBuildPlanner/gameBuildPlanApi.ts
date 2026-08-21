import type { GameDiscoverySession } from "@/lib/gameDiscovery/gameDiscovery";
import { DEFAULT_WORLD_SIZE_CONFIG, normalizeWorldSizeConfig, type GameFoundation } from "@/lib/gameFoundation/gameFoundation";
import type { GameBuildPhase, GameBuildPlan, GameBuildTask } from "./gameBuildPlan";

function createTask(title: string, description: string): GameBuildTask {
  return { id: crypto.randomUUID(), title, description, status: "pending" };
}

function sourceText(foundation: GameFoundation, discovery?: GameDiscoverySession): string {
  return [
    foundation.blueprint.concept,
    discovery?.originalConcept,
    discovery?.understanding.gameType,
    discovery?.understanding.coreExperience,
    discovery?.understanding.worldConcept,
    discovery?.understanding.socialInteraction,
    discovery?.understanding.gameplayGoals,
    foundation.dnaVersions.at(-1)?.creativeAnchor,
    foundation.dnaVersions.at(-1)?.coreIdentity,
    foundation.dnaVersions.at(-1)?.worldIdentity,
    foundation.dnaVersions.at(-1)?.assetIdentity,
  ].filter((value): value is string => Boolean(value?.trim())).join(" ").toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function worldSizeGuidance(worldSize: { width: number; height: number }): string {
  const area = worldSize.width * worldSize.height;
  if (area <= 20 * 20) return "Compact layout: keep the core experience concentrated and exploration focused.";
  if (area <= 32 * 32) return "Balanced layout: allow a clear hub plus a modest amount of exploration space.";
  if (area <= 48 * 48) return "Expanded layout: support multiple meaningful locations and broader exploration.";
  return "Large layout: reserve room for multiple meaningful locations, routes and broad exploration.";
}

export function generateGameBuildPlan(input: {
  foundation: GameFoundation;
  discovery?: GameDiscoverySession;
}): GameBuildPlan {
  const { foundation, discovery } = input;
  const dna = foundation.dnaVersions.at(-1);
  const worldSize = normalizeWorldSizeConfig(foundation.blueprint.worldSize ?? DEFAULT_WORLD_SIZE_CONFIG);
  const text = sourceText(foundation, discovery);
  const isSocialWorld = includesAny(text, ["social", "multiplayer", "shared", "chat", "community"]);
  const isRpg = includesAny(text, ["rpg", "quest", "combat", "adventure"]);
  const isFarming = includesAny(text, ["farm", "farming", "crop", "harvest"]);
  const worldLabel = isFarming ? "Starter Farm" : isRpg ? "Starter Adventure Area" : isSocialWorld ? "Starter Social Hub" : "Starter World";
  const sizeGuidance = worldSizeGuidance(worldSize);

  const phases: GameBuildPhase[] = [
    {
      id: "world-structure",
      title: "WORLD STRUCTURE",
      tasks: [
        createTask("Define playable world", `Translate the ${worldLabel.toLowerCase()} into a buildable world concept for a ${worldSize.width}×${worldSize.height} world.`),
        createTask("Define world dimensions", `Set the playable world to exactly ${worldSize.width}×${worldSize.height} cells using the selected ${worldSize.preset} world size.`),
        createTask("Define starter area", `Establish the first player-facing area: ${worldLabel}. ${sizeGuidance}`),
      ],
    },
    {
      id: "terrain",
      title: "TERRAIN",
      tasks: [
        createTask("Define terrain zones", "Identify the terrain regions needed by the current world identity."),
        createTask("Define terrain connections", "Connect major terrain zones with readable transitions."),
        createTask("Define roads and paths", "Plan routes that support the intended player movement and flow."),
      ],
    },
    {
      id: isSocialWorld ? "social-hub" : "core-play-area",
      title: isSocialWorld ? "SOCIAL HUB" : "CORE PLAY AREA",
      tasks: isSocialWorld
        ? [
            createTask("Define player spawn", "Choose a clear arrival point that introduces the shared world."),
            createTask("Define central gathering area", "Create the main social focal point based on the Discovery goals."),
            createTask("Define key social locations", `Place the primary locations that support chat, meeting and return visits within the ${worldSize.preset} world scale.`),
          ]
        : [
            createTask("Define player entry", "Choose the first point where the player enters the core experience."),
            createTask("Define central gameplay area", "Create the main space that supports the core player activity."),
            createTask("Define key locations", `Place the important locations required by the current game concept within the ${worldSize.preset} world scale.`),
          ],
    },
    {
      id: "world-areas",
      title: "WORLD AREAS",
      tasks: [
        createTask("Define additional explorable zones", `${sizeGuidance} Identify the next areas that expand the initial world.`),
        createTask("Define important landmarks", "Add memorable landmarks that improve orientation and world identity."),
      ],
    },
    {
      id: "assets",
      title: "ASSETS",
      tasks: [
        createTask("Determine terrain assets", "List the terrain assets required by the planned zones."),
        createTask("Determine objects", `Translate the active DNA asset identity into the first required world objects${dna?.assetIdentity ? `: ${dna.assetIdentity}` : "."}`),
        createTask("Determine decorations", "Identify decorative assets that support the visual identity without changing gameplay logic."),
      ],
    },
  ];

  const firstTask = phases[0]?.tasks[0];
  if (firstTask) firstTask.status = "current";
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    version: "v1",
    gameId: foundation.game.id,
    gameName: foundation.game.name,
    sourceSummary: [`World Size: ${worldSize.preset} ${worldSize.width}x${worldSize.height}`, sizeGuidance, discovery?.understanding.gameType, discovery?.understanding.coreExperience, dna?.creativeAnchor].filter(Boolean).join(" · ") || foundation.blueprint.concept || "Game data is ready for the first build plan.",
    worldSize,
    phases,
    currentTaskId: firstTask?.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function advanceGameBuildPlan(plan: GameBuildPlan): GameBuildPlan {
  const tasks = plan.phases.flatMap((phase) => phase.tasks);
  const currentIndex = tasks.findIndex((task) => task.id === plan.currentTaskId);
  const nextIndex = currentIndex + 1;
  const nextTask = tasks[nextIndex];
  const updatedAt = new Date().toISOString();

  return {
    ...plan,
    currentTaskId: nextTask?.id,
    updatedAt,
    phases: plan.phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((task) => {
        if (task.id === plan.currentTaskId) return { ...task, status: "complete" };
        if (task.id === nextTask?.id) return { ...task, status: "current" };
        return task;
      }),
    })),
  };
}
