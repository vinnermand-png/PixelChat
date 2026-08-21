import type { GameBuildPlan, GameBuildTask } from "./gameBuildPlan";

type TerrainId = "grass" | "dirt" | "snow" | "sand" | "stone";
type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };
type GridPoint = { gx: number; gy: number };
type StarterArea = { id: string; label: string; bounds: WorldBounds; center: GridPoint };
type TerrainZone = { id: string; label: string; terrainId: TerrainId; bounds: WorldBounds; source: "starter-area" | "world-identity" };
type TerrainConnection = { id: string; fromZoneId: string; toZoneId: string; type: "transition"; description: string };
type TerrainPath = { id: string; label: string; fromZoneId: string; toZoneId: string; points: GridPoint[]; terrainId: "dirt" };
type TerrainStructureData = { zones: TerrainZone[]; connections?: TerrainConnection[]; paths?: TerrainPath[] };
type WorldStructureData = {
  version: 1;
  playable: { id: string; sourceSummary: string };
  dimensions?: { width: number; height: number; bounds: WorldBounds };
  starterArea?: StarterArea;
  terrain?: TerrainStructureData;
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
  if (!raw) throw new Error("The GameMaker map is not available for build execution.");
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

function findCurrentPhase(plan: GameBuildPlan, task: GameBuildTask) {
  return plan.phases.find((phase) => phase.tasks.some((candidate) => candidate.id === task.id));
}

function cellKey(gx: number, gy: number) {
  return `${gx},${gy}`;
}

function fillBounds(terrain: Record<string, TerrainId>, bounds: WorldBounds, terrainId: TerrainId) {
  const next = { ...terrain };
  for (let gy = bounds.minY; gy <= bounds.maxY; gy++) {
    for (let gx = bounds.minX; gx <= bounds.maxX; gx++) {
      next[cellKey(gx, gy)] = terrainId;
    }
  }
  return next;
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
        terrain: existing?.terrain,
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

function chooseWorldTerrain(plan: GameBuildPlan): TerrainId {
  const text = plan.sourceSummary.toLowerCase();
  if (/snow|winter|ice|frost|arctic/.test(text)) return "snow";
  if (/sand|desert|beach|tropical/.test(text)) return "sand";
  if (/stone|mountain|rock|cave/.test(text)) return "stone";
  return "grass";
}

function defineTerrainZones(map: StoredMap, plan: GameBuildPlan): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  if (!structure?.playable || !dimensions || !starterArea) {
    throw new Error("World Structure data must exist before terrain zones can be defined.");
  }

  const baseTerrain = chooseWorldTerrain(plan);
  const existingZones = structure.terrain?.zones;
  const worldZone: TerrainZone = existingZones?.find((zone) => zone.source === "world-identity") ?? {
    id: crypto.randomUUID(),
    label: `${baseTerrain[0].toUpperCase()}${baseTerrain.slice(1)} World`,
    terrainId: baseTerrain,
    bounds: dimensions.bounds,
    source: "world-identity",
  };
  const starterZone: TerrainZone = existingZones?.find((zone) => zone.source === "starter-area") ?? {
    id: crypto.randomUUID(),
    label: starterArea.label,
    terrainId: "grass",
    bounds: starterArea.bounds,
    source: "starter-area",
  };
  const zones = [worldZone, starterZone];
  const terrain = fillBounds(fillBounds(map.world.terrain, worldZone.bounds, worldZone.terrainId), starterZone.bounds, starterZone.terrainId);

  return {
    ...map,
    world: {
      ...map.world,
      terrain,
      structure: {
        ...structure,
        terrain: {
          zones,
          connections: structure.terrain?.connections,
          paths: structure.terrain?.paths,
        },
      },
    },
  };
}

function defineTerrainConnections(map: StoredMap): StoredMap {
  const structure = map.world.structure;
  const zones = structure?.terrain?.zones;
  if (!structure?.playable || !zones || zones.length < 2) {
    throw new Error("At least two terrain zones must exist before terrain connections can be defined.");
  }

  const worldZone = zones.find((zone) => zone.source === "world-identity") ?? zones[0];
  const starterZone = zones.find((zone) => zone.source === "starter-area") ?? zones[1];
  if (!worldZone || !starterZone) throw new Error("The required terrain zones are unavailable.");
  const existing = structure.terrain?.connections?.find((connection) => connection.fromZoneId === starterZone.id && connection.toZoneId === worldZone.id);
  const connection: TerrainConnection = existing ?? {
    id: crypto.randomUUID(),
    fromZoneId: starterZone.id,
    toZoneId: worldZone.id,
    type: "transition",
    description: `Readable terrain transition from ${starterZone.label} to ${worldZone.label}.`,
  };

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        terrain: {
          zones,
          connections: existing ? structure.terrain?.connections : [...(structure.terrain?.connections ?? []), connection],
          paths: structure.terrain?.paths,
        },
      },
    },
  };
}

function manhattanPath(from: GridPoint, to: GridPoint): GridPoint[] {
  const points: GridPoint[] = [];
  let gx = from.gx;
  let gy = from.gy;
  points.push({ gx, gy });
  while (gx !== to.gx) {
    gx += gx < to.gx ? 1 : -1;
    points.push({ gx, gy });
  }
  while (gy !== to.gy) {
    gy += gy < to.gy ? 1 : -1;
    points.push({ gx, gy });
  }
  return points;
}

function defineRoadsAndPaths(map: StoredMap): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const zones = structure?.terrain?.zones;
  const connections = structure?.terrain?.connections;
  if (!dimensions || !starterArea || !zones || zones.length < 2 || !connections?.length) {
    throw new Error("Terrain zones and connections must exist before roads and paths can be defined.");
  }

  const starterZone = zones.find((zone) => zone.source === "starter-area") ?? zones[0];
  const worldZone = zones.find((zone) => zone.source === "world-identity") ?? zones[1];
  const target: GridPoint = {
    gx: Math.min(dimensions.bounds.maxX, starterArea.bounds.maxX + 4),
    gy: Math.min(dimensions.bounds.maxY, starterArea.center.gy),
  };
  const points = manhattanPath(starterArea.center, target);
  const existingPath = structure.terrain?.paths?.find((path) => path.fromZoneId === starterZone.id && path.toZoneId === worldZone.id);
  const path: TerrainPath = existingPath ?? {
    id: crypto.randomUUID(),
    label: `${starterArea.label} Path`,
    fromZoneId: starterZone.id,
    toZoneId: worldZone.id,
    points,
    terrainId: "dirt",
  };
  const terrain = { ...map.world.terrain };
  for (const point of path.points) terrain[cellKey(point.gx, point.gy)] = path.terrainId;

  return {
    ...map,
    world: {
      ...map.world,
      terrain,
      structure: {
        ...structure,
        terrain: {
          zones,
          connections,
          paths: existingPath ? structure.terrain?.paths : [...(structure.terrain?.paths ?? []), path],
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
  throw new Error("Unknown World Structure task.");
}

function applyTerrainTask(plan: GameBuildPlan, task: GameBuildTask, map: StoredMap) {
  if (task.title === "Define terrain zones") {
    const next = defineTerrainZones(map, plan);
    return { map: next, summary: `Persisted ${next.world.structure?.terrain?.zones.length ?? 0} terrain zones and applied them to the editable GameMaker terrain map.` };
  }
  if (task.title === "Define terrain connections") {
    const next = defineTerrainConnections(map);
    return { map: next, summary: `Persisted ${next.world.structure?.terrain?.connections?.length ?? 0} terrain connection(s) between the defined zones.` };
  }
  if (task.title === "Define roads and paths") {
    const next = defineRoadsAndPaths(map);
    return { map: next, summary: `Persisted ${next.world.structure?.terrain?.paths?.length ?? 0} route(s) and applied the route terrain to the editable GameMaker map.` };
  }
  throw new Error("Unknown Terrain task.");
}

export function executeCurrentGameBuildTask(plan: GameBuildPlan): GameBuildExecutionResult {
  if (typeof window === "undefined") throw new Error("Game build execution requires the browser GameMaker runtime.");
  const task = findCurrentTask(plan);
  const phase = findCurrentPhase(plan, task);
  if (!phase || (phase.id !== "world-structure" && phase.id !== "terrain")) {
    throw new Error("Execution is currently available for World Structure and Terrain tasks only.");
  }
  const map = readCurrentMap();
  const action = phase.id === "world-structure" ? applyWorldStructureTask(plan, task, map) : applyTerrainTask(plan, task, map);
  writeAndLoadMap(action.map);
  return { taskId: task.id, summary: action.summary };
}
