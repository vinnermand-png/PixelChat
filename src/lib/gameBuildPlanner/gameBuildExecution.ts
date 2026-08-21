import type { GameBuildPlan, GameBuildTask } from "./gameBuildPlan";

type TerrainId = "grass" | "dirt" | "snow" | "sand" | "stone";
type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };
type StarterArea = { id: string; label: string; bounds: WorldBounds; center: { gx: number; gy: number } };
type WorldStructureData = {
  version: 1;
  playable: { id: string; sourceSummary: string };
  dimensions?: { width: number; height: number; bounds: WorldBounds };
  starterArea?: StarterArea;
};
type StoredMap = {
  version: 1;
  id: string;
  name: string;
  world: {
    gridSize: number;
    terrain: Record<string, TerrainId>;
    structure?: WorldStructureData;
  };
  foundation: { edgeMaterial: "soil" | "rock" | "cliff"; edgeDepth: number };
  objects: Array<{ id: string; assetId: string; gx: number; gy: number }>;
};

export interface GameBuildExecutionResult {
  taskId: string;
  summary: string;
}

const MAP_STORAGE_KEY = "pixelchat-game-maker-v2-map-v1";
const DEFAULT_WORLD_SIZE = 20;

function getEditorButton(label: string) {
  return Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === label);
}

function readCurrentMap(): StoredMap {
  getEditorButton("Save")?.click();
  const raw = localStorage.getItem(MAP_STORAGE_KEY);
  if (!raw) throw new Error("The GameMaker map is not available for World Structure execution.");
  const map = JSON.parse(raw) as StoredMap;
  if (!map.world || typeof map.world.gridSize !== "number" || !map.world.terrain) {
    throw new Error("The current GameMaker map is invalid.");
  }
  return map;
}

function writeAndLoadMap(map: StoredMap) {
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
  const loadButton = getEditorButton("Load");
  if (!loadButton) throw new Error("The existing GameMaker Load action is unavailable.");
  loadButton.click();
}

function worldBounds(size: number): WorldBounds {
  return { minX: 0, minY: 0, maxX: size - 1, maxY: size - 1 };
}

function findCurrentTask(plan: GameBuildPlan): GameBuildTask {
  const task = plan.phases.flatMap((phase) => phase.tasks).find((candidate) => candidate.id === plan.currentTaskId);
  if (!task) throw new Error("No current build task is available.");
  return task;
}

function createPlayableWorld(map: StoredMap, plan: GameBuildPlan): StoredMap {
  const existing = map.world.structure;
  return {
    ...map,
    name: map.name === "Untitled Map" ? `${plan.gameName} World` : map.name,
    world: {
      ...map.world,
      structure: {
        version: 1,
        playable: existing?.playable ?? { id: crypto.randomUUID(), sourceSummary: plan.sourceSummary },
        dimensions: existing?.dimensions,
        starterArea: existing?.starterArea,
      },
    },
  };
}

function defineWorldDimensions(map: StoredMap): StoredMap {
  const size = Math.max(map.world.gridSize, DEFAULT_WORLD_SIZE);
  const existing = map.world.structure;
  if (!existing?.playable) throw new Error("Playable world data must exist before dimensions can be defined.");
  return {
    ...map,
    world: {
      ...map.world,
      gridSize: size,
      structure: {
        ...existing,
        dimensions: { width: size, height: size, bounds: worldBounds(size) },
      },
    },
  };
}

function defineStarterArea(map: StoredMap, plan: GameBuildPlan): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  if (!structure?.playable || !dimensions) {
    throw new Error("Playable world and dimensions must exist before the starter area can be defined.");
  }
  const width = Math.min(6, dimensions.width);
  const height = Math.min(6, dimensions.height);
  const centerGx = Math.floor(dimensions.width / 2);
  const centerGy = Math.floor(dimensions.height / 2);
  const minX = Math.max(0, centerGx - Math.floor(width / 2));
  const minY = Math.max(0, centerGy - Math.floor(height / 2));
  const bounds = { minX, minY, maxX: minX + width - 1, maxY: minY + height - 1 };
  const social = /social|multiplayer|shared|chat|community/i.test(plan.sourceSummary);
  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        starterArea: {
          id: structure.starterArea?.id ?? crypto.randomUUID(),
          label: social ? "Starter Social Hub" : "Starter Area",
          bounds,
          center: { gx: centerGx, gy: centerGy },
        },
      },
    },
  };
}

function applyWorldStructureTask(plan: GameBuildPlan, task: GameBuildTask, map: StoredMap) {
  if (task.title === "Define playable world") {
    return { map: createPlayableWorld(map, plan), summary: "Created persisted playable-world structure data from the current build plan." };
  }
  if (task.title === "Define world dimensions") {
    const next = defineWorldDimensions(map);
    return { map: next, summary: `Persisted ${next.world.gridSize} × ${next.world.gridSize} playable bounds used by the GameMaker canvas.` };
  }
  if (task.title === "Define starter area") {
    const next = defineStarterArea(map, plan);
    return { map: next, summary: `Persisted structured starter area: ${next.world.structure?.starterArea?.label ?? "Starter Area"}.` };
  }
  throw new Error("Execution is currently available for the World Structure vertical slice only.");
}

export function executeCurrentGameBuildTask(plan: GameBuildPlan): GameBuildExecutionResult {
  if (typeof window === "undefined") throw new Error("Game build execution requires the browser GameMaker runtime.");
  const task = findCurrentTask(plan);
  const map = readCurrentMap();
  const action = applyWorldStructureTask(plan, task, map);
  writeAndLoadMap(action.map);
  return { taskId: task.id, summary: action.summary };
}
