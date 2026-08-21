import type { GameBuildPlan, GameBuildTask } from "./gameBuildPlan";

type TerrainId = "grass" | "dirt" | "snow" | "sand" | "stone";
type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };
type GridPoint = { gx: number; gy: number };
type StarterArea = { id: string; label: string; bounds: WorldBounds; center: GridPoint };
type PlayerEntry = { id: string; label: string; gx: number; gy: number; worldId: string; mapId: string };
type CentralGameplayArea = { id: string; label: string; bounds: WorldBounds; center: GridPoint; worldId: string; mapId: string; starterAreaId: string; playerEntryId: string };
type KeyLocationKind = "fishing" | "farming" | "combat" | "adventure" | "social" | "core";
type KeyLocation = { id: string; label: string; kind: KeyLocationKind; gx: number; gy: number; worldId: string; mapId: string; centralGameplayAreaId: string; conceptSource: string };
type ExplorableZone = { id: string; label: string; bounds: WorldBounds; center: GridPoint; worldId: string; mapId: string; conceptSource: string };
type TerrainZone = { id: string; label: string; terrainId: TerrainId; bounds: WorldBounds; source: "starter-area" | "world-identity" };
type TerrainConnection = { id: string; fromZoneId: string; toZoneId: string; type: "transition"; description: string };
type TerrainPath = { id: string; label: string; fromZoneId: string; toZoneId: string; points: GridPoint[]; terrainId: "dirt" };
type TerrainStructureData = { zones: TerrainZone[]; connections?: TerrainConnection[]; paths?: TerrainPath[] };
type WorldStructureData = {
  version: 1;
  playable: { id: string; sourceSummary: string };
  dimensions?: { width: number; height: number; bounds: WorldBounds };
  starterArea?: StarterArea;
  playerEntry?: PlayerEntry;
  centralGameplayArea?: CentralGameplayArea;
  keyLocations?: KeyLocation[];
  additionalExplorableZones?: ExplorableZone[];
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

function parseStoredMap(raw: string | null): StoredMap {
  if (!raw) throw new Error("The GameMaker map is not available for build execution.");
  const map = JSON.parse(raw) as StoredMap;
  if (!map.world || typeof map.world.gridSize !== "number" || !map.world.terrain) {
    throw new Error("The current GameMaker map is invalid.");
  }
  return map;
}

function readCurrentMap(): StoredMap {
  getEditorButton("Save")?.click();
  return parseStoredMap(localStorage.getItem(MAP_STORAGE_KEY));
}

function writeAndLoadMap(map: StoredMap): StoredMap {
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
  const persisted = parseStoredMap(localStorage.getItem(MAP_STORAGE_KEY));
  const loadButton = getEditorButton("Load");
  if (!loadButton) throw new Error("The existing GameMaker Load action is unavailable.");
  loadButton.click();
  return persisted;
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

function pointInBounds(point: GridPoint, bounds: WorldBounds) {
  return point.gx >= bounds.minX && point.gx <= bounds.maxX && point.gy >= bounds.minY && point.gy <= bounds.maxY;
}

function boundsOverlap(a: WorldBounds, b: WorldBounds) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
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
        playerEntry: existing?.playerEntry,
        centralGameplayArea: existing?.centralGameplayArea,
        keyLocations: existing?.keyLocations,
        additionalExplorableZones: existing?.additionalExplorableZones,
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

function definePlayerEntry(map: StoredMap, task: GameBuildTask): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  if (!structure?.playable || !dimensions || !starterArea) {
    throw new Error("Playable world, dimensions and starter area must exist before player entry can be defined.");
  }

  const entryPoint = starterArea.center;
  if (!pointInBounds(entryPoint, dimensions.bounds)) {
    throw new Error("The player entry point is outside the playable world bounds.");
  }
  if (!pointInBounds(entryPoint, starterArea.bounds)) {
    throw new Error("The player entry point must be inside the starter area.");
  }

  const existing = structure.playerEntry;
  const playerEntry: PlayerEntry = existing ?? {
    id: crypto.randomUUID(),
    label: task.title === "Define player spawn" ? "Player Spawn" : "Player Entry",
    gx: entryPoint.gx,
    gy: entryPoint.gy,
    worldId: structure.playable.id,
    mapId: map.id,
  };

  if (!pointInBounds({ gx: playerEntry.gx, gy: playerEntry.gy }, dimensions.bounds)) {
    throw new Error("The persisted player entry point is outside the playable world bounds.");
  }
  if (!pointInBounds({ gx: playerEntry.gx, gy: playerEntry.gy }, starterArea.bounds)) {
    throw new Error("The persisted player entry point must be inside the starter area.");
  }
  if (playerEntry.worldId !== structure.playable.id || playerEntry.mapId !== map.id) {
    throw new Error("The player entry point does not reference the active world and map.");
  }

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        playerEntry,
      },
    },
  };
}

function defineCentralGameplayArea(map: StoredMap): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const playerEntry = structure?.playerEntry;
  if (!structure?.playable || !dimensions || !starterArea || !playerEntry) {
    throw new Error("Playable world, dimensions, starter area and player entry must exist before the central gameplay area can be defined.");
  }
  const entryPoint = { gx: playerEntry.gx, gy: playerEntry.gy };
  if (!pointInBounds(entryPoint, dimensions.bounds) || !pointInBounds(entryPoint, starterArea.bounds)) {
    throw new Error("The player entry point must remain valid before the central gameplay area can be defined.");
  }
  if (playerEntry.worldId !== structure.playable.id || playerEntry.mapId !== map.id) {
    throw new Error("The player entry point does not reference the active world and map.");
  }

  const existing = structure.centralGameplayArea;
  const centralGameplayArea: CentralGameplayArea = existing ?? {
    id: crypto.randomUUID(),
    label: "Central Gameplay Area",
    bounds: starterArea.bounds,
    center: starterArea.center,
    worldId: structure.playable.id,
    mapId: map.id,
    starterAreaId: starterArea.id,
    playerEntryId: playerEntry.id,
  };

  if (!pointInBounds(centralGameplayArea.center, dimensions.bounds) || !pointInBounds(centralGameplayArea.center, starterArea.bounds)) {
    throw new Error("The central gameplay area center is outside the existing playable starter area.");
  }
  if (!pointInBounds(entryPoint, centralGameplayArea.bounds)) {
    throw new Error("The central gameplay area must contain the existing player entry point.");
  }
  if (centralGameplayArea.worldId !== structure.playable.id || centralGameplayArea.mapId !== map.id) {
    throw new Error("The central gameplay area does not reference the active world and map.");
  }
  if (centralGameplayArea.starterAreaId !== starterArea.id || centralGameplayArea.playerEntryId !== playerEntry.id) {
    throw new Error("The central gameplay area does not reference the active starter area and player entry.");
  }

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        centralGameplayArea,
      },
    },
  };
}

function deriveKeyLocationKinds(sourceSummary: string): Array<{ kind: KeyLocationKind; label: string }> {
  const text = sourceSummary.toLowerCase();
  const locations: Array<{ kind: KeyLocationKind; label: string }> = [];
  if (/fish|fishing|harbor|harbour|dock|pier/.test(text)) locations.push({ kind: "fishing", label: "Fishing Location" });
  if (/farm|farming|crop|harvest/.test(text)) locations.push({ kind: "farming", label: "Farm Activity Area" });
  if (/combat|battle|arena|fight/.test(text)) locations.push({ kind: "combat", label: "Combat Activity Area" });
  if (/quest|adventure|explore|exploration/.test(text)) locations.push({ kind: "adventure", label: "Adventure Activity Area" });
  if (/social|multiplayer|shared|chat|community|meeting/.test(text)) locations.push({ kind: "social", label: "Social Activity Area" });
  return locations.length ? locations : [{ kind: "core", label: "Core Activity Location" }];
}

function keyLocationPoint(area: CentralGameplayArea, index: number, used: Set<string>, playerEntry: GridPoint): GridPoint {
  const offsets = [
    { x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 2 }, { x: 2, y: 2 },
    { x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 },
  ];
  for (let attempt = 0; attempt < offsets.length; attempt++) {
    const offset = offsets[(index + attempt) % offsets.length];
    const point = {
      gx: Math.max(area.bounds.minX, Math.min(area.bounds.maxX, area.center.gx + offset.x)),
      gy: Math.max(area.bounds.minY, Math.min(area.bounds.maxY, area.center.gy + offset.y)),
    };
    const key = cellKey(point.gx, point.gy);
    if (key !== cellKey(playerEntry.gx, playerEntry.gy) && !used.has(key)) return point;
  }
  throw new Error("The central gameplay area does not contain enough distinct cells for the required key locations.");
}

function defineKeyLocations(map: StoredMap, plan: GameBuildPlan): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const playerEntry = structure?.playerEntry;
  const centralGameplayArea = structure?.centralGameplayArea;
  if (!structure?.playable || !dimensions || !starterArea || !playerEntry || !centralGameplayArea) {
    throw new Error("Playable world, dimensions, starter area, player entry and central gameplay area must exist before key locations can be defined.");
  }
  if (centralGameplayArea.worldId !== structure.playable.id || centralGameplayArea.mapId !== map.id) {
    throw new Error("The central gameplay area does not reference the active world and map.");
  }
  const playerEntryPoint = { gx: playerEntry.gx, gy: playerEntry.gy };
  if (!pointInBounds(playerEntryPoint, dimensions.bounds) || !pointInBounds(playerEntryPoint, starterArea.bounds) || !pointInBounds(playerEntryPoint, centralGameplayArea.bounds)) {
    throw new Error("The existing player entry point must remain valid before key locations can be defined.");
  }

  const definitions = deriveKeyLocationKinds(plan.sourceSummary);
  const existingByKind = new Map((structure.keyLocations ?? []).map((location) => [location.kind, location]));
  const used = new Set((structure.keyLocations ?? []).map((location) => cellKey(location.gx, location.gy)));
  const keyLocations = definitions.map((definition, index) => {
    const existing = existingByKind.get(definition.kind);
    if (existing) return existing;
    const point = keyLocationPoint(centralGameplayArea, index, used, playerEntryPoint);
    used.add(cellKey(point.gx, point.gy));
    return {
      id: crypto.randomUUID(),
      label: definition.label,
      kind: definition.kind,
      gx: point.gx,
      gy: point.gy,
      worldId: structure.playable.id,
      mapId: map.id,
      centralGameplayAreaId: centralGameplayArea.id,
      conceptSource: plan.sourceSummary,
    };
  });

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        keyLocations,
      },
    },
  };
}

function deriveExplorableZoneLabel(sourceSummary: string) {
  const text = sourceSummary.toLowerCase();
  if (/fish|fishing|harbor|harbour|dock|pier/.test(text)) return "Fishing Exploration Zone";
  if (/farm|farming|crop|harvest/.test(text)) return "Farming Exploration Zone";
  if (/combat|battle|arena|fight/.test(text)) return "Combat Exploration Zone";
  if (/quest|adventure|explore|exploration/.test(text)) return "Adventure Exploration Zone";
  if (/social|multiplayer|shared|chat|community|meeting/.test(text)) return "Social Exploration Zone";
  return "Additional Exploration Zone";
}

function defineAdditionalExplorableZones(map: StoredMap, plan: GameBuildPlan): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const playerEntry = structure?.playerEntry;
  const centralGameplayArea = structure?.centralGameplayArea;
  const keyLocations = structure?.keyLocations;
  if (!structure?.playable || !dimensions || !starterArea || !playerEntry || !centralGameplayArea || !keyLocations?.length) {
    throw new Error("Playable world, dimensions, starter area, player entry, central gameplay area and key locations must exist before additional explorable zones can be defined.");
  }
  if (centralGameplayArea.worldId !== structure.playable.id || centralGameplayArea.mapId !== map.id) {
    throw new Error("The central gameplay area does not reference the active world and map.");
  }
  if (playerEntry.worldId !== structure.playable.id || playerEntry.mapId !== map.id) {
    throw new Error("The player entry does not reference the active world and map.");
  }
  for (const location of keyLocations) {
    if (location.worldId !== structure.playable.id || location.mapId !== map.id || location.centralGameplayAreaId !== centralGameplayArea.id) {
      throw new Error("Existing key locations do not reference the active world, map and central gameplay area.");
    }
  }

  const size = Math.max(2, Math.min(6, Math.floor(Math.min(dimensions.width, dimensions.height) / 3)));
  const candidates: WorldBounds[] = [
    { minX: centralGameplayArea.bounds.maxX + 1, maxX: centralGameplayArea.bounds.maxX + size, minY: centralGameplayArea.bounds.minY, maxY: Math.min(dimensions.bounds.maxY, centralGameplayArea.bounds.minY + size - 1) },
    { minX: centralGameplayArea.bounds.minX - size, maxX: centralGameplayArea.bounds.minX - 1, minY: centralGameplayArea.bounds.minY, maxY: Math.min(dimensions.bounds.maxY, centralGameplayArea.bounds.minY + size - 1) },
    { minX: centralGameplayArea.bounds.minX, maxX: Math.min(dimensions.bounds.maxX, centralGameplayArea.bounds.minX + size - 1), minY: centralGameplayArea.bounds.maxY + 1, maxY: centralGameplayArea.bounds.maxY + size },
    { minX: centralGameplayArea.bounds.minX, maxX: Math.min(dimensions.bounds.maxX, centralGameplayArea.bounds.minX + size - 1), minY: centralGameplayArea.bounds.minY - size, maxY: centralGameplayArea.bounds.minY - 1 },
  ];
  const bounds = candidates.find((candidate) => candidate.minX >= dimensions.bounds.minX
    && candidate.maxX <= dimensions.bounds.maxX
    && candidate.minY >= dimensions.bounds.minY
    && candidate.maxY <= dimensions.bounds.maxY
    && !boundsOverlap(candidate, starterArea.bounds)
    && !boundsOverlap(candidate, centralGameplayArea.bounds));
  if (!bounds) throw new Error("No non-overlapping explorable zone can be placed inside the existing playable world.");

  const occupiedPoints = [
    { gx: playerEntry.gx, gy: playerEntry.gy },
    ...keyLocations.map((location) => ({ gx: location.gx, gy: location.gy })),
  ];
  if (occupiedPoints.some((point) => pointInBounds(point, bounds))) {
    throw new Error("The additional explorable zone would overlap the player entry or an existing key location.");
  }

  const existing = structure.additionalExplorableZones ?? [];
  const zone = existing[0] ?? {
    id: crypto.randomUUID(),
    label: deriveExplorableZoneLabel(plan.sourceSummary),
    bounds,
    center: {
      gx: Math.floor((bounds.minX + bounds.maxX) / 2),
      gy: Math.floor((bounds.minY + bounds.maxY) / 2),
    },
    worldId: structure.playable.id,
    mapId: map.id,
    conceptSource: plan.sourceSummary,
  };

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        additionalExplorableZones: [zone],
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

function applyPlayerEntryTask(task: GameBuildTask, map: StoredMap) {
  if (task.title !== "Define player entry" && task.title !== "Define player spawn") {
    throw new Error("Unknown Core Play Area player-entry task.");
  }
  const next = definePlayerEntry(map, task);
  const entry = next.world.structure?.playerEntry;
  if (!entry) throw new Error("The player entry point was not created.");
  return {
    map: next,
    summary: `Persisted ${entry.label.toLowerCase()} at (${entry.gx}, ${entry.gy}) inside the existing starter area and playable world.`,
  };
}

function applyCentralGameplayAreaTask(task: GameBuildTask, map: StoredMap) {
  if (task.title !== "Define central gameplay area") {
    throw new Error("Unknown Core Play Area task.");
  }
  const next = defineCentralGameplayArea(map);
  const area = next.world.structure?.centralGameplayArea;
  if (!area) throw new Error("The central gameplay area was not created.");
  return {
    map: next,
    summary: `Persisted ${area.label.toLowerCase()} at (${area.center.gx}, ${area.center.gy}) within the existing starter area and playable world.`,
  };
}

function applyKeyLocationsTask(task: GameBuildTask, plan: GameBuildPlan, map: StoredMap) {
  if (task.title !== "Define key locations" && task.title !== "Define key social locations") {
    throw new Error("Unknown key locations task.");
  }
  const next = defineKeyLocations(map, plan);
  const locations = next.world.structure?.keyLocations;
  if (!locations?.length) throw new Error("No key locations were created.");
  return {
    map: next,
    summary: `Persisted ${locations.length} key location${locations.length === 1 ? "" : "s"} derived from the current game concept.`,
  };
}

function applyAdditionalExplorableZonesTask(task: GameBuildTask, plan: GameBuildPlan, map: StoredMap) {
  if (task.title !== "Define additional explorable zones") {
    throw new Error("Unknown World Areas task.");
  }
  const next = defineAdditionalExplorableZones(map, plan);
  const zones = next.world.structure?.additionalExplorableZones;
  if (!zones?.length) throw new Error("No additional explorable zones were created.");
  return {
    map: next,
    summary: `Persisted ${zones.length} additional explorable zone${zones.length === 1 ? "" : "s"} inside the existing playable world.`,
  };
}

function verifyPlayerEntryPersisted(map: StoredMap) {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const entry = structure?.playerEntry;
  if (!structure?.playable || !dimensions || !starterArea || !entry) {
    throw new Error("Player entry data was not persisted with the required world structure.");
  }
  const point = { gx: entry.gx, gy: entry.gy };
  if (!pointInBounds(point, dimensions.bounds) || !pointInBounds(point, starterArea.bounds)) {
    throw new Error("The persisted player entry point failed world or starter-area validation.");
  }
  if (entry.worldId !== structure.playable.id || entry.mapId !== map.id) {
    throw new Error("The persisted player entry point does not reference the active world and map.");
  }
}

function verifyCentralGameplayAreaPersisted(map: StoredMap) {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const playerEntry = structure?.playerEntry;
  const area = structure?.centralGameplayArea;
  if (!structure?.playable || !dimensions || !starterArea || !playerEntry || !area) {
    throw new Error("Central gameplay area data was not persisted with the required world structure.");
  }
  const entryPoint = { gx: playerEntry.gx, gy: playerEntry.gy };
  if (!pointInBounds(area.center, dimensions.bounds) || !pointInBounds(area.center, starterArea.bounds)) {
    throw new Error("The persisted central gameplay area center failed playable-world or starter-area validation.");
  }
  if (!pointInBounds(entryPoint, area.bounds)) {
    throw new Error("The persisted central gameplay area does not contain the player entry point.");
  }
  if (area.worldId !== structure.playable.id || area.mapId !== map.id) {
    throw new Error("The persisted central gameplay area does not reference the active world and map.");
  }
  if (area.starterAreaId !== starterArea.id || area.playerEntryId !== playerEntry.id) {
    throw new Error("The persisted central gameplay area does not reference the active starter area and player entry.");
  }
}

function verifyKeyLocationsPersisted(map: StoredMap) {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const playerEntry = structure?.playerEntry;
  const centralGameplayArea = structure?.centralGameplayArea;
  const keyLocations = structure?.keyLocations;
  if (!structure?.playable || !dimensions || !starterArea || !playerEntry || !centralGameplayArea || !keyLocations?.length) {
    throw new Error("Key location data was not persisted with the required world structure.");
  }
  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const location of keyLocations) {
    const point = { gx: location.gx, gy: location.gy };
    if (ids.has(location.id) || occupied.has(cellKey(point.gx, point.gy))) {
      throw new Error("Persisted key locations must have stable unique ids and positions.");
    }
    ids.add(location.id);
    occupied.add(cellKey(point.gx, point.gy));
    if (!pointInBounds(point, dimensions.bounds) || !pointInBounds(point, starterArea.bounds) || !pointInBounds(point, centralGameplayArea.bounds)) {
      throw new Error("A persisted key location is outside the existing playable central area.");
    }
    if (location.worldId !== structure.playable.id || location.mapId !== map.id || location.centralGameplayAreaId !== centralGameplayArea.id) {
      throw new Error("A persisted key location does not reference the active world, map and central gameplay area.");
    }
    if (!location.conceptSource.trim()) {
      throw new Error("A persisted key location is missing its concept source.");
    }
  }
  const entryPoint = { gx: playerEntry.gx, gy: playerEntry.gy };
  if (!pointInBounds(entryPoint, starterArea.bounds) || !pointInBounds(entryPoint, centralGameplayArea.bounds)) {
    throw new Error("The existing player entry point is no longer valid after key locations were persisted.");
  }
}

function verifyAdditionalExplorableZonesPersisted(map: StoredMap) {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  const playerEntry = structure?.playerEntry;
  const centralGameplayArea = structure?.centralGameplayArea;
  const keyLocations = structure?.keyLocations;
  const zones = structure?.additionalExplorableZones;
  if (!structure?.playable || !dimensions || !starterArea || !playerEntry || !centralGameplayArea || !keyLocations?.length || !zones?.length) {
    throw new Error("Additional explorable zone data was not persisted with the required world structure.");
  }
  const ids = new Set<string>();
  for (const zone of zones) {
    if (ids.has(zone.id)) throw new Error("Persisted additional explorable zones must have stable unique ids.");
    ids.add(zone.id);
    if (zone.worldId !== structure.playable.id || zone.mapId !== map.id) {
      throw new Error("A persisted additional explorable zone does not reference the active world and map.");
    }
    if (!zone.conceptSource.trim()) throw new Error("A persisted additional explorable zone is missing its concept source.");
    if (!pointInBounds(zone.center, dimensions.bounds)
      || zone.bounds.minX < dimensions.bounds.minX
      || zone.bounds.maxX > dimensions.bounds.maxX
      || zone.bounds.minY < dimensions.bounds.minY
      || zone.bounds.maxY > dimensions.bounds.maxY) {
      throw new Error("A persisted additional explorable zone is outside the playable world bounds.");
    }
    if (boundsOverlap(zone.bounds, starterArea.bounds) || boundsOverlap(zone.bounds, centralGameplayArea.bounds)) {
      throw new Error("A persisted additional explorable zone overlaps the existing starter or central gameplay area.");
    }
    if (pointInBounds({ gx: playerEntry.gx, gy: playerEntry.gy }, zone.bounds)) {
      throw new Error("A persisted additional explorable zone overlaps the player entry point.");
    }
    if (keyLocations.some((location) => pointInBounds({ gx: location.gx, gy: location.gy }, zone.bounds))) {
      throw new Error("A persisted additional explorable zone overlaps an existing key location.");
    }
  }
}

export function executeCurrentGameBuildTask(plan: GameBuildPlan): GameBuildExecutionResult {
  if (typeof window === "undefined") throw new Error("Game build execution requires the browser GameMaker runtime.");
  const task = findCurrentTask(plan);
  const phase = findCurrentPhase(plan, task);
  const isPlayerEntryPhase = (phase?.id === "core-play-area" || phase?.id === "social-hub") && (task.title === "Define player entry" || task.title === "Define player spawn");
  const isCentralGameplayAreaPhase = phase?.id === "core-play-area" && task.title === "Define central gameplay area";
  const isKeyLocationsPhase = (phase?.id === "core-play-area" || phase?.id === "social-hub") && (task.title === "Define key locations" || task.title === "Define key social locations");
  const isAdditionalExplorableZonesPhase = phase?.id === "world-areas" && task.title === "Define additional explorable zones";
  if (!phase || (phase.id !== "world-structure" && phase.id !== "terrain" && !isPlayerEntryPhase && !isCentralGameplayAreaPhase && !isKeyLocationsPhase && !isAdditionalExplorableZonesPhase)) {
    throw new Error("Execution is currently available for World Structure, Terrain, player entry, central gameplay area, key locations and additional explorable zones tasks only.");
  }
  const map = readCurrentMap();
  const action = phase.id === "world-structure"
    ? applyWorldStructureTask(plan, task, map)
    : phase.id === "terrain"
      ? applyTerrainTask(plan, task, map)
      : isPlayerEntryPhase
        ? applyPlayerEntryTask(task, map)
        : isCentralGameplayAreaPhase
          ? applyCentralGameplayAreaTask(task, map)
          : isKeyLocationsPhase
            ? applyKeyLocationsTask(task, plan, map)
            : applyAdditionalExplorableZonesTask(task, plan, map);
  const persisted = writeAndLoadMap(action.map);
  if (isPlayerEntryPhase) verifyPlayerEntryPersisted(persisted);
  if (isCentralGameplayAreaPhase) verifyCentralGameplayAreaPersisted(persisted);
  if (isKeyLocationsPhase) verifyKeyLocationsPersisted(persisted);
  if (isAdditionalExplorableZonesPhase) verifyAdditionalExplorableZonesPersisted(persisted);
  return { taskId: task.id, summary: action.summary };
}
