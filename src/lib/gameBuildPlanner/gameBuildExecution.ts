import type { GameBuildPlan, GameBuildTask } from "./gameBuildPlan";

type TerrainId = "grass" | "dirt" | "snow" | "sand" | "stone";
type StoredMap = {
  version: 1;
  id: string;
  name: string;
  world: { gridSize: number; terrain: Record<string, TerrainId> };
  foundation: { edgeMaterial: "soil" | "rock" | "cliff"; edgeDepth: number };
  objects: Array<{ id: string; assetId: string; gx: number; gy: number }>;
};

export interface GameBuildExecutionResult {
  taskId: string;
  summary: string;
}

const MAP_STORAGE_KEY = "pixelchat-game-maker-v2-map-v1";

function cellKey(gx: number, gy: number) {
  return `${gx},${gy}`;
}

function getEditorButton(label: string) {
  return Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === label);
}

function readCurrentMap(): StoredMap {
  getEditorButton("Save")?.click();
  const raw = localStorage.getItem(MAP_STORAGE_KEY);
  if (!raw) throw new Error("The GameMaker map is not available for execution.");
  const map = JSON.parse(raw) as StoredMap;
  if (!map.world || typeof map.world.gridSize !== "number" || !map.world.terrain) {
    throw new Error("The current GameMaker map is invalid.");
  }
  return map;
}

function writeAndLoadMap(map: StoredMap) {
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
  const loadButton = getEditorButton("Load");
  if (!loadButton) throw new Error("The GameMaker Load action is unavailable.");
  loadButton.click();
}

function createPlayableWorld(map: StoredMap, sourceSummary: string) {
  const size = Math.max(map.world.gridSize, 18);
  const terrain: Record<string, TerrainId> = {};
  const socialWorld = /social|multiplayer|shared|chat|community/i.test(sourceSummary);
  for (let gx = 2; gx < size - 2; gx++) {
    for (let gy = 2; gy < size - 2; gy++) {
      const edgeDistance = Math.min(gx - 2, gy - 2, size - 3 - gx, size - 3 - gy);
      terrain[cellKey(gx, gy)] = edgeDistance < 2 ? "dirt" : "grass";
    }
  }
  if (socialWorld) {
    const center = Math.floor(size / 2);
    for (let gx = center - 2; gx <= center + 2; gx++) {
      for (let gy = center - 2; gy <= center + 2; gy++) terrain[cellKey(gx, gy)] = "grass";
    }
  }
  return {
    ...map,
    name: map.name === "Untitled Map" ? "AI Starter World" : map.name,
    world: { gridSize: size, terrain },
  };
}

function defineWorldDimensions(map: StoredMap) {
  const size = Math.max(map.world.gridSize, 20);
  const terrain = { ...map.world.terrain };
  for (let gx = 1; gx < size - 1; gx++) {
    for (let gy = 1; gy < size - 1; gy++) {
      if (!terrain[cellKey(gx, gy)] && gx > 2 && gy > 2 && gx < size - 3 && gy < size - 3) terrain[cellKey(gx, gy)] = "grass";
    }
  }
  return { ...map, world: { gridSize: size, terrain } };
}

function defineStarterArea(map: StoredMap) {
  const terrain = { ...map.world.terrain };
  const center = Math.floor(map.world.gridSize / 2);
  for (let gx = center - 3; gx <= center + 3; gx++) {
    for (let gy = center - 3; gy <= center + 3; gy++) terrain[cellKey(gx, gy)] = "grass";
  }
  for (let offset = -5; offset <= 5; offset++) {
    if (offset < -3 || offset > 3) terrain[cellKey(center + offset, center)] = "dirt";
  }
  return { ...map, world: { ...map.world, terrain } };
}

function applyConcreteAction(plan: GameBuildPlan, task: GameBuildTask, map: StoredMap): { map: StoredMap; summary: string } {
  if (task.title === "Define playable world") {
    return { map: createPlayableWorld(map, plan.sourceSummary), summary: "Created an editable grass starter platform with dirt terrain variation." };
  }
  if (task.title === "Define world dimensions") {
    return { map: defineWorldDimensions(map), summary: "Expanded the editable playable bounds and connected the starter terrain." };
  }
  if (task.title === "Define starter area") {
    return { map: defineStarterArea(map), summary: "Defined a clear central starter area using the existing terrain system." };
  }
  throw new Error("Execution is currently available for the World Structure vertical slice only.");
}

export function executeCurrentGameBuildTask(plan: GameBuildPlan): GameBuildExecutionResult {
  if (typeof window === "undefined") throw new Error("Game build execution requires the browser GameMaker runtime.");
  const task = plan.phases.flatMap((phase) => phase.tasks).find((candidate) => candidate.id === plan.currentTaskId);
  if (!task) throw new Error("No current build task is available.");
  const map = readCurrentMap();
  const action = applyConcreteAction(plan, task, map);
  writeAndLoadMap(action.map);
  return { taskId: task.id, summary: action.summary };
}
