import type { GameBuildPlan, GameBuildTask } from "./gameBuildPlan";
import { ASSET_LIBRARY } from "@/components/pixel/assets/assetLibrary";

type TerrainId = "grass" | "dirt" | "snow" | "sand" | "stone";
type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };
type GridPoint = { gx: number; gy: number };
type StarterArea = { id: string; label: string; bounds: WorldBounds; center: GridPoint };
type PlayerEntry = { id: string; label: string; gx: number; gy: number; worldId: string; mapId: string };
type CentralGameplayArea = { id: string; label: string; bounds: WorldBounds; center: GridPoint; worldId: string; mapId: string; starterAreaId: string; playerEntryId: string };
type TerrainZone = { id: string; label: string; terrainId: TerrainId; bounds: WorldBounds; source: "starter-area" | "world-identity" };
type TerrainConnection = { id: string; fromZoneId: string; toZoneId: string; type: "transition"; description: string };
type TerrainPath = { id: string; label: string; fromZoneId: string; toZoneId: string; points: GridPoint[]; terrainId: "dirt" };
type TerrainStructureData = { zones: TerrainZone[]; connections?: TerrainConnection[]; paths?: TerrainPath[] };
type TerrainAssetRequirement = { assetId: TerrainId; label: string; category: "terrain"; zoneIds: string[] };
type ObjectRequirement = { assetId: string; label: string; category: string; sourceIds: string[]; quantity: number; rationale: string };
type DecorationRequirement = { id: string; category: "zone-dressing" | "location-dressing" | "landmark-dressing" | "path-dressing"; label: string; sourceIds: string[]; quantity: number; assetCategory: "decorations"; rationale: string; dnaSignals: string[] };
type CanonicalWorldLocation = { id: string; label: string; center?: GridPoint; bounds?: WorldBounds; [key: string]: unknown };
type ImportantLandmark = { id: string; label: string; sourceId: string; sourceType: "key-location" | "explorable-zone"; center?: GridPoint; bounds?: WorldBounds };
type WorldStructureData = {
  version: 1;
  playable: { id: string; sourceSummary: string };
  dimensions?: { width: number; height: number; bounds: WorldBounds };
  starterArea?: StarterArea;
  playerEntry?: PlayerEntry;
  centralGameplayArea?: CentralGameplayArea;
  keyLocations?: CanonicalWorldLocation[];
  additionalExplorableZones?: CanonicalWorldLocation[];
  importantLandmarks?: ImportantLandmark[];
  terrainAssets?: TerrainAssetRequirement[];
  objectRequirements?: ObjectRequirement[];
  decorationRequirements?: DecorationRequirement[];
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

function parseStoredMap(raw: string | null): StoredMap {
  if (!raw) throw new Error("The GameMaker map is not available for build execution.");
  const map = JSON.parse(raw) as StoredMap;
  if (!map.world || typeof map.world.gridSize !== "number" || !map.world.terrain) {
    throw new Error("The current GameMaker map is invalid.");
  }
  return map;
}

function readCurrentMap(): StoredMap {
  return parseStoredMap(localStorage.getItem(MAP_STORAGE_KEY));
}

function writeAndLoadMap(map: StoredMap): StoredMap {
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
  return parseStoredMap(localStorage.getItem(MAP_STORAGE_KEY));
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
        importantLandmarks: existing?.importantLandmarks,
        terrainAssets: existing?.terrainAssets,
        objectRequirements: existing?.objectRequirements,
        decorationRequirements: existing?.decorationRequirements,
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

function determineTerrainAssets(map: StoredMap): StoredMap {
  const structure = map.world.structure;
  const zones = structure?.terrain?.zones;
  if (!structure?.playable || !zones?.length) {
    throw new Error("A playable world with terrain zones must exist before terrain assets can be determined.");
  }

  const zonesByTerrain = new Map<TerrainId, string[]>();
  for (const zone of zones) {
    const zoneIds = zonesByTerrain.get(zone.terrainId) ?? [];
    zoneIds.push(zone.id);
    zonesByTerrain.set(zone.terrainId, zoneIds);
  }
  const existing = structure.terrainAssets;
  const terrainAssets = existing?.length
    ? existing
    : Array.from(zonesByTerrain, ([assetId, zoneIds]) => ({
        assetId,
        label: `${assetId[0].toUpperCase()}${assetId.slice(1)} terrain`,
        category: "terrain" as const,
        zoneIds,
      }));

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        terrainAssets,
      },
    },
  };
}

function determineObjects(plan: GameBuildPlan, map: StoredMap): StoredMap {
  const structure = map.world.structure;
  if (!structure?.playable || !structure.dimensions || !structure.terrain?.zones?.length) {
    throw new Error("A playable world with dimensions and terrain zones must exist before objects can be determined.");
  }

  const existing = structure.objectRequirements;
  if (existing?.length) return map;

  const keyLocationIds = (structure.keyLocations ?? []).map((location) => location.id);
  const zoneIds = [
    ...(structure.additionalExplorableZones ?? []).map((zone) => zone.id),
    ...(structure.importantLandmarks ?? []).map((landmark) => landmark.sourceId),
  ];
  const dnaText = plan.sourceSummary.toLowerCase();
  const availableTreeAssets = ASSET_LIBRARY.filter((asset) => asset.category === "trees");
  const requirements: ObjectRequirement[] = [];
  const baseTree = availableTreeAssets[0];
  if (baseTree && keyLocationIds.length) {
    requirements.push({
      assetId: baseTree.id,
      label: baseTree.name,
      category: baseTree.category,
      sourceIds: keyLocationIds,
      quantity: keyLocationIds.length,
      rationale: "Place a readable natural object at each key location.",
    });
  }
  const largeTree = availableTreeAssets.find((asset) => asset.id === "testLargeTree") ?? availableTreeAssets[1];
  if (largeTree && zoneIds.length && (dnaText.includes("tree") || dnaText.includes("forest") || dnaText.includes("nature") || dnaText.includes("grove") || requirements.length === 0)) {
    requirements.push({
      assetId: largeTree.id,
      label: largeTree.name,
      category: largeTree.category,
      sourceIds: zoneIds,
      quantity: zoneIds.length,
      rationale: "Use larger natural objects to give explorable zones and landmarks visual identity.",
    });
  }
  if (!requirements.length) {
    throw new Error("The existing world structure does not provide locations or zones for object requirements.");
  }

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        objectRequirements: requirements,
      },
    },
  };
}

function determineDecorations(plan: GameBuildPlan, map: StoredMap): StoredMap {
  const structure = map.world.structure;
  const terrainZones = structure?.terrain?.zones;
  const terrainAssets = structure?.terrainAssets;
  const objectRequirements = structure?.objectRequirements;
  if (!structure?.playable || !structure.dimensions || !terrainZones?.length || !terrainAssets?.length || !objectRequirements?.length) {
    throw new Error("A playable world with terrain zones, terrain assets and object requirements must exist before decorations can be determined.");
  }

  const existing = structure.decorationRequirements;
  if (existing?.length) return map;

  const dnaSignals = plan.sourceSummary
    .split(/\s+|[·,;]+/)
    .map((signal) => signal.trim())
    .filter((signal) => signal.length > 3)
    .slice(0, 6);
  const additionalExplorableZones = structure.additionalExplorableZones ?? [];
  const zoneSourceIds = [
    ...terrainZones.map((zone) => zone.id),
    ...additionalExplorableZones.map((zone) => zone.id),
  ];
  const requirements: DecorationRequirement[] = [
    {
      id: crypto.randomUUID(),
      category: "zone-dressing",
      label: "Terrain zone dressing",
      sourceIds: zoneSourceIds,
      quantity: zoneSourceIds.length,
      assetCategory: "decorations",
      rationale: `Add non-blocking accents that distinguish the ${terrainAssets.length} terrain asset type(s) across the planned zones.`,
      dnaSignals,
    },
  ];
  const keyLocations = structure.keyLocations ?? [];
  if (keyLocations.length) requirements.push({
    id: crypto.randomUUID(),
    category: "location-dressing",
    label: "Key location dressing",
    sourceIds: keyLocations.map((location) => location.id),
    quantity: keyLocations.length,
    assetCategory: "decorations",
    rationale: "Give each key location a readable visual treatment without changing gameplay logic.",
    dnaSignals,
  });
  const landmarks = structure.importantLandmarks ?? [];
  if (landmarks.length) requirements.push({
    id: crypto.randomUUID(),
    category: "landmark-dressing",
    label: "Landmark dressing",
    sourceIds: landmarks.map((landmark) => landmark.id),
    quantity: landmarks.length,
    assetCategory: "decorations",
    rationale: "Use decorative accents to reinforce orientation and the identity of important landmarks.",
    dnaSignals,
  });
  const paths = structure.terrain.paths ?? [];
  if (paths.length) requirements.push({
    id: crypto.randomUUID(),
    category: "path-dressing",
    label: "Path dressing",
    sourceIds: paths.map((path) => path.id),
    quantity: paths.length,
    assetCategory: "decorations",
    rationale: "Add restrained route-side accents that improve path readability without obscuring movement.",
    dnaSignals,
  });

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        decorationRequirements: requirements,
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

function defineImportantLandmarks(map: StoredMap): StoredMap {
  const structure = map.world.structure;
  const keyLocations = structure?.keyLocations;
  const additionalExplorableZones = structure?.additionalExplorableZones;
  if (!structure?.playable || !structure.dimensions || !keyLocations || !additionalExplorableZones) {
    throw new Error("Playable world, dimensions, key locations and additional explorable zones must exist before important landmarks can be defined.");
  }

  const existing = structure.importantLandmarks;
  const importantLandmarks = existing?.length
    ? existing
    : [
        ...keyLocations.map((location) => ({
          id: crypto.randomUUID(),
          label: `${location.label} Landmark`,
          sourceId: location.id,
          sourceType: "key-location" as const,
          center: location.center,
          bounds: location.bounds,
        })),
        ...additionalExplorableZones.map((zone) => ({
          id: crypto.randomUUID(),
          label: `${zone.label} Landmark`,
          sourceId: zone.id,
          sourceType: "explorable-zone" as const,
          center: zone.center,
          bounds: zone.bounds,
        })),
      ];
  if (!importantLandmarks.length) {
    throw new Error("At least one key location or additional explorable zone is required before important landmarks can be defined.");
  }

  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        importantLandmarks,
      },
    },
  };
}

function defineKeyLocations(map: StoredMap, task: GameBuildTask): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const centralGameplayArea = structure?.centralGameplayArea;
  if (!structure?.playable || !dimensions || !centralGameplayArea) {
    throw new Error("Playable world, dimensions and central gameplay area must exist before key locations can be defined.");
  }

  const keyLocations = structure.keyLocations?.length
    ? structure.keyLocations
    : [{
        id: crypto.randomUUID(),
        label: task.title === "Define key social locations" ? "Social Gathering Point" : "Primary Gameplay Location",
        center: centralGameplayArea.center,
        bounds: centralGameplayArea.bounds,
        source: "central-gameplay-area",
      }];
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

function defineAdditionalExplorableZones(map: StoredMap): StoredMap {
  const structure = map.world.structure;
  const dimensions = structure?.dimensions;
  const starterArea = structure?.starterArea;
  if (!structure?.playable || !dimensions || !starterArea || !structure.keyLocations?.length) {
    throw new Error("Playable world, dimensions, starter area and key locations must exist before additional explorable zones can be defined.");
  }

  const existingZones = structure.additionalExplorableZones;
  const zoneWidth = Math.max(1, Math.floor(dimensions.width / 4));
  const zoneHeight = Math.max(1, Math.floor(dimensions.height / 4));
  const zoneBounds: WorldBounds = {
    minX: Math.max(0, dimensions.bounds.maxX - zoneWidth + 1),
    minY: Math.max(0, dimensions.bounds.maxY - zoneHeight + 1),
    maxX: dimensions.bounds.maxX,
    maxY: dimensions.bounds.maxY,
  };
  const additionalExplorableZones = existingZones?.length
    ? existingZones
    : [{
        id: crypto.randomUUID(),
        label: "Outer Exploration Zone",
        center: { gx: Math.floor((zoneBounds.minX + zoneBounds.maxX) / 2), gy: Math.floor((zoneBounds.minY + zoneBounds.maxY) / 2) },
        bounds: zoneBounds,
        source: "world-expansion",
      }];
  return {
    ...map,
    world: {
      ...map.world,
      structure: {
        ...structure,
        additionalExplorableZones,
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
  if (task.title === "Determine terrain assets") {
    const next = determineTerrainAssets(map);
    return { map: next, summary: `Persisted ${next.world.structure?.terrainAssets?.length ?? 0} terrain asset requirement(s) derived from the existing terrain zones.` };
  }
  
  throw new Error("Unknown Terrain task.");
}

function applyObjectTask(plan: GameBuildPlan, task: GameBuildTask, map: StoredMap) {
  if (task.title !== "Determine objects") {
    throw new Error("Unknown Assets task.");
  }
  const next = determineObjects(plan, map);
  return {
    map: next,
    summary: `Persisted ${next.world.structure?.objectRequirements?.length ?? 0} object requirement(s) derived from the active Game DNA and existing world structure.`,
  };
}

function applyDecorationTask(plan: GameBuildPlan, task: GameBuildTask, map: StoredMap) {
  if (task.title !== "Determine decorations") {
    throw new Error("Unknown Assets task.");
  }
  const next = determineDecorations(plan, map);
  return {
    map: next,
    summary: `Persisted ${next.world.structure?.decorationRequirements?.length ?? 0} decoration requirement categor${next.world.structure?.decorationRequirements?.length === 1 ? "y" : "ies"} derived from the existing world structure.`,
  };
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

function applyKeyLocationsTask(task: GameBuildTask, map: StoredMap) {
  if (task.title !== "Define key locations" && task.title !== "Define key social locations") {
    throw new Error("Unknown key locations task.");
  }
  const next = defineKeyLocations(map, task);
  return {
    map: next,
    summary: `Persisted ${next.world.structure?.keyLocations?.length ?? 0} key location(s) in the canonical world structure.`,
  };
}

function applyAdditionalExplorableZonesTask(task: GameBuildTask, map: StoredMap) {
  if (task.title !== "Define additional explorable zones") {
    throw new Error("Unknown World Areas task.");
  }
  const next = defineAdditionalExplorableZones(map);
  return {
    map: next,
    summary: `Persisted ${next.world.structure?.additionalExplorableZones?.length ?? 0} additional explorable zone(s) in the canonical world structure.`,
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

function applyImportantLandmarksTask(task: GameBuildTask, map: StoredMap) {
  if (task.title !== "Define important landmarks") {
    throw new Error("Unknown World Areas task.");
  }
  const next = defineImportantLandmarks(map);
  return {
    map: next,
    summary: `Persisted ${next.world.structure?.importantLandmarks?.length ?? 0} important landmark(s) from the existing key locations and explorable zones.`,
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

export function executeCurrentGameBuildTask(plan: GameBuildPlan): GameBuildExecutionResult {
  if (typeof window === "undefined") throw new Error("Game build execution requires the browser GameMaker runtime.");
  const task = findCurrentTask(plan);
  const phase = findCurrentPhase(plan, task);
  const isPlayerEntryPhase = (phase?.id === "core-play-area" || phase?.id === "social-hub") && (task.title === "Define player entry" || task.title === "Define player spawn");
  const isCentralGameplayAreaPhase = phase?.id === "core-play-area" && task.title === "Define central gameplay area";
  const isKeyLocationsTask = (phase?.id === "core-play-area" || phase?.id === "social-hub") && (task.title === "Define key locations" || task.title === "Define key social locations");
  const isAdditionalExplorableZonesTask = phase?.id === "world-areas" && task.title === "Define additional explorable zones";
  const isImportantLandmarksTask = phase?.id === "world-areas" && task.title === "Define important landmarks";
  const isTerrainAssetsTask = phase?.id === "assets" && task.title === "Determine terrain assets";
  const isObjectTask = phase?.id === "assets" && task.title === "Determine objects";
  const isDecorationTask = phase?.id === "assets" && task.title === "Determine decorations";
  if (!phase || (phase.id !== "world-structure" && phase.id !== "terrain" && !isPlayerEntryPhase && !isCentralGameplayAreaPhase && !isKeyLocationsTask && !isAdditionalExplorableZonesTask && !isImportantLandmarksTask && !isTerrainAssetsTask && !isObjectTask && !isDecorationTask)) {
    throw new Error("Execution is currently available for World Structure, Terrain, player entry, key locations, central gameplay area, explorable zones, important landmarks, terrain assets, objects and decorations tasks only.");
  }
  const map = readCurrentMap();
  const action = phase.id === "world-structure"
    ? applyWorldStructureTask(plan, task, map)
    : phase.id === "terrain"
      ? applyTerrainTask(plan, task, map)
      : isPlayerEntryPhase
        ? applyPlayerEntryTask(task, map)
        : isKeyLocationsTask
          ? applyKeyLocationsTask(task, map)
          : isAdditionalExplorableZonesTask
            ? applyAdditionalExplorableZonesTask(task, map)
            : isCentralGameplayAreaPhase
          ? applyCentralGameplayAreaTask(task, map)
          : isTerrainAssetsTask
            ? applyTerrainTask(plan, task, map)
            : isObjectTask
              ? applyObjectTask(plan, task, map)
              : isDecorationTask
                ? applyDecorationTask(plan, task, map)
                : applyImportantLandmarksTask(task, map);
  const persisted = writeAndLoadMap(action.map);
  if (isPlayerEntryPhase) verifyPlayerEntryPersisted(persisted);
  if (isCentralGameplayAreaPhase) verifyCentralGameplayAreaPersisted(persisted);
  return { taskId: task.id, summary: action.summary };
}
