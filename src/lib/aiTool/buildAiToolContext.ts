import type { GameBuildPlan } from "@/lib/gameBuildPlanner/gameBuildPlan";
import { getFoundationActiveGameDna } from "@/lib/gameFoundation/gameFoundationApi";
import {
  WORLD_SEED_KEY_LOCATION_KINDS,
  normalizeWorldSeeds,
  type GameDnaContent,
  type GameDnaVersion,
  type GameFoundation,
  type WorldSeedKeyLocation,
} from "@/lib/gameFoundation/gameFoundation";
import type { GameDiscoverySession } from "@/lib/gameDiscovery/gameDiscovery";
import { getAsset } from "@/components/pixel/assets/assetLibrary";
import type { AssetId } from "@/components/pixel/assets/types";

const INTERNAL_SAVE_MAP_EVENT = "pixelchat-game-maker-internal-save-map";

type GridPoint = { gx: number; gy: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

interface LiveWorldStructure {
  dimensions?: { width: number; height: number };
  starterArea?: { id: string; label: string; bounds: Bounds; center: GridPoint };
  playerEntry?: GridPoint;
  centralGameplayArea?: { id: string; label: string; bounds: Bounds; center: GridPoint };
  keyLocations?: Array<{ id: string; label: string; kind: string; gx: number; gy: number }>;
  additionalExplorableZones?: Array<{ id: string; label: string; bounds: Bounds; center: GridPoint }>;
  importantLandmarks?: Array<{ id: string; label: string; kind: string; gx: number; gy: number }>;
  terrain?: { paths?: Array<{ id: string; label: string; points: unknown[] }> };
}

interface LiveCurrentMapSnapshot {
  version: number;
  id: string;
  name: string;
  world: { gridSize: number; terrain: Record<string, string>; structure?: LiveWorldStructure };
  foundation: { edgeMaterial: string; edgeDepth: number };
  objects: Array<{ id: string; assetId: string; gx: number; gy: number }>;
}

export interface BuildAiToolContextInput {
  foundation: GameFoundation;
  discovery?: GameDiscoverySession | null;
  buildPlan?: GameBuildPlan | null;
}

export interface AiToolContextV1TerrainSummary {
  paintedCells: number;
  countsPerTerrainId: Record<string, number>;
}

export interface AiToolContextV1MapStructure {
  dimensions?: { width: number; height: number };
  starterArea?: { id: string; label: string; bounds: Bounds; center: GridPoint };
  playerEntry?: GridPoint;
  centralGameplayArea?: { id: string; label: string; bounds: Bounds; center: GridPoint };
  keyLocations: Array<{ id: string; label: string; kind: string; gx: number; gy: number }>;
  explorableZones: Array<{ id: string; label: string; bounds: Bounds; center: GridPoint }>;
  importantLandmarks: Array<{ id: string; label: string; kind: string; gx: number; gy: number }>;
  paths: Array<{ id: string; label: string; pointCount: number }>;
}

export interface AiToolContextV1ObjectsSummary {
  total: number;
  countsPerAssetId: Record<string, number>;
}

export interface AiToolContextV1BuildableSpace {
  gridSizeCells: number;
  paintedCells: number;
  occupiedByObjectCells: number;
  freeCells: number;
}

export interface AiToolContextV1SpatialRegion {
  region: string;
  totalCells: number;
  freeCells: number;
  countsPerAssetId: Record<string, number>;
  dominantTerrainId?: string;
  dominantTerrainShare?: number;
}

export interface AiToolContextV1SpatialLayout {
  regionGridSize: 3;
  regions: AiToolContextV1SpatialRegion[];
}

export interface AiToolContextV1Map {
  id: string;
  name: string;
  gridSize: number;
  foundation: { edgeMaterial: string; edgeDepth: number };
  terrainSummary: AiToolContextV1TerrainSummary;
  objects: Array<{ id: string; assetId: string; gx: number; gy: number }>;
  objectsSummary?: AiToolContextV1ObjectsSummary;
  buildableSpace?: AiToolContextV1BuildableSpace;
  spatialLayout?: AiToolContextV1SpatialLayout;
  structure?: AiToolContextV1MapStructure;
}

export interface AiToolContextV1 {
  version: 1;
  generatedAt: string;
  game: { id: string; name: string };
  dna?: GameDnaContent;
  worldSeeds?: WorldSeedKeyLocation[];
  map: AiToolContextV1Map;
}

function readLiveCurrentMapSnapshot(): LiveCurrentMapSnapshot {
  if (typeof window === "undefined") throw new Error("AI Tool Context derivation requires a browser runtime.");
  const request: { map: LiveCurrentMapSnapshot | null } = { map: null };
  window.dispatchEvent(new CustomEvent(INTERNAL_SAVE_MAP_EVENT, { detail: request }));
  if (!request.map) throw new Error("The current GameMaker editor state is unavailable for AI Tool Context.");
  return request.map;
}

function summarizeTerrain(terrain: Record<string, string>): AiToolContextV1TerrainSummary {
  const countsPerTerrainId: Record<string, number> = {};
  let paintedCells = 0;
  for (const terrainId of Object.values(terrain)) {
    countsPerTerrainId[terrainId] = (countsPerTerrainId[terrainId] ?? 0) + 1;
    paintedCells += 1;
  }
  return { paintedCells, countsPerTerrainId };
}

function summarizeObjects(objects: Array<{ assetId: string }>): AiToolContextV1ObjectsSummary {
  const countsPerAssetId: Record<string, number> = {};
  for (const object of objects) {
    countsPerAssetId[object.assetId] = (countsPerAssetId[object.assetId] ?? 0) + 1;
  }
  return { total: objects.length, countsPerAssetId };
}

function computeBuildableSpace(gridSize: number, terrainSummary: AiToolContextV1TerrainSummary, objects: Array<{ assetId: string }>): AiToolContextV1BuildableSpace {
  let occupiedByObjectCells = 0;
  for (const object of objects) {
    occupiedByObjectCells += getAsset(object.assetId as AssetId)?.collision.footprint.length ?? 1;
  }
  const gridSizeCells = gridSize * gridSize;
  return {
    gridSizeCells,
    paintedCells: terrainSummary.paintedCells,
    occupiedByObjectCells,
    freeCells: Math.max(0, gridSizeCells - terrainSummary.paintedCells - occupiedByObjectCells),
  };
}

const SPATIAL_REGION_GRID_SIZE = 3;
const SPATIAL_ROW_NAMES = ["upper", "center", "lower"] as const;
const SPATIAL_COL_NAMES = ["left", "center", "right"] as const;

function spatialRegionName(row: number, col: number): string {
  if (row === 1 && col === 1) return "center";
  return `${SPATIAL_ROW_NAMES[row]}-${SPATIAL_COL_NAMES[col]}`;
}

function spatialBandBounds(gridSize: number): Array<{ start: number; end: number }> {
  const third = Math.max(0, Math.floor(gridSize / SPATIAL_REGION_GRID_SIZE));
  return [
    { start: 0, end: third },
    { start: third, end: gridSize - third },
    { start: gridSize - third, end: gridSize },
  ];
}

function computeSpatialLayout(world: { gridSize: number; terrain: Record<string, string> }, objects: Array<{ assetId: string; gx: number; gy: number }>): AiToolContextV1SpatialLayout {
  const bands = spatialBandBounds(world.gridSize);
  interface RegionAccumulator {
    totalCells: number;
    paintedCells: number;
    occupiedByObjectCells: number;
    countsPerAssetId: Record<string, number>;
    countsPerTerrainId: Record<string, number>;
  }
  const regions: RegionAccumulator[] = [];
  for (let row = 0; row < SPATIAL_REGION_GRID_SIZE; row++) {
    for (let col = 0; col < SPATIAL_REGION_GRID_SIZE; col++) {
      regions.push({
        totalCells: (bands[row].end - bands[row].start) * (bands[col].end - bands[col].start),
        paintedCells: 0,
        occupiedByObjectCells: 0,
        countsPerAssetId: {},
        countsPerTerrainId: {},
      });
    }
  }
  const regionIndexForCell = (gx: number, gy: number): number => {
    const row = bands.findIndex((band) => gy >= band.start && gy < band.end);
    const col = bands.findIndex((band) => gx >= band.start && gx < band.end);
    if (row < 0 || col < 0) return -1;
    return row * SPATIAL_REGION_GRID_SIZE + col;
  };
  for (const [cellKey, terrainId] of Object.entries(world.terrain)) {
    const [gx, gy] = cellKey.split(",").map((value) => Number.parseInt(value, 10));
    if (!Number.isInteger(gx) || !Number.isInteger(gy)) continue;
    const index = regionIndexForCell(gx, gy);
    if (index < 0) continue;
    regions[index].paintedCells += 1;
    regions[index].countsPerTerrainId[terrainId] = (regions[index].countsPerTerrainId[terrainId] ?? 0) + 1;
  }
  for (const object of objects) {
    const anchorIndex = regionIndexForCell(object.gx, object.gy);
    if (anchorIndex >= 0) {
      regions[anchorIndex].countsPerAssetId[object.assetId] = (regions[anchorIndex].countsPerAssetId[object.assetId] ?? 0) + 1;
    }
    const footprint = getAsset(object.assetId as AssetId)?.collision.footprint ?? [{ gx: 0, gy: 0 }];
    for (const offset of footprint) {
      const index = regionIndexForCell(object.gx + offset.gx, object.gy + offset.gy);
      if (index >= 0) regions[index].occupiedByObjectCells += 1;
    }
  }
  return {
    regionGridSize: 3,
    regions: regions.map((region, index) => {
      const dominantEntries = Object.entries(region.countsPerTerrainId).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const dominant = dominantEntries[0];
      return {
        region: spatialRegionName(Math.floor(index / SPATIAL_REGION_GRID_SIZE), index % SPATIAL_REGION_GRID_SIZE),
        totalCells: region.totalCells,
        freeCells: Math.max(0, region.totalCells - region.paintedCells - region.occupiedByObjectCells),
        countsPerAssetId: region.countsPerAssetId,
        ...(dominant ? { dominantTerrainId: dominant[0], dominantTerrainShare: Math.round((dominant[1] / region.paintedCells) * 100) } : {}),
      };
    }),
  };
}

function projectDna(dna?: GameDnaVersion): GameDnaContent | undefined {
  if (!dna) return undefined;
  const content: GameDnaContent = {};
  for (const section of ["creativeAnchor", "coreIdentity", "emotionalIdentity", "worldIdentity", "visualIdentity", "assetIdentity"] as const) {
    const value = dna[section];
    if (typeof value === "string" && value.trim()) content[section] = value;
  }
  return Object.keys(content).length ? content : undefined;
}

function projectWorldSeeds(input: BuildAiToolContextInput): WorldSeedKeyLocation[] | undefined {
  return normalizeWorldSeeds(input.foundation.blueprint.worldSeeds)?.keyLocations
    ?? (input.buildPlan?.worldSeeds?.length ? input.buildPlan.worldSeeds : undefined);
}

function projectStructure(structure: LiveWorldStructure | undefined): AiToolContextV1MapStructure | undefined {
  if (!structure) return undefined;
  const projected: AiToolContextV1MapStructure = {
    ...(structure.dimensions ? { dimensions: { width: structure.dimensions.width, height: structure.dimensions.height } } : {}),
    ...(structure.starterArea ? { starterArea: { id: structure.starterArea.id, label: structure.starterArea.label, bounds: structure.starterArea.bounds, center: structure.starterArea.center } } : {}),
    ...(structure.playerEntry ? { playerEntry: { gx: structure.playerEntry.gx, gy: structure.playerEntry.gy } } : {}),
    ...(structure.centralGameplayArea ? { centralGameplayArea: { id: structure.centralGameplayArea.id, label: structure.centralGameplayArea.label, bounds: structure.centralGameplayArea.bounds, center: structure.centralGameplayArea.center } } : {}),
    keyLocations: (structure.keyLocations ?? []).map((location) => ({ id: location.id, label: location.label, kind: location.kind, gx: location.gx, gy: location.gy })),
    explorableZones: (structure.additionalExplorableZones ?? []).map((zone) => ({ id: zone.id, label: zone.label, bounds: zone.bounds, center: zone.center })),
    importantLandmarks: (structure.importantLandmarks ?? []).map((landmark) => ({ id: landmark.id, label: landmark.label, kind: landmark.kind, gx: landmark.gx, gy: landmark.gy })),
    paths: (structure.terrain?.paths ?? []).map((path) => ({ id: path.id, label: path.label, pointCount: path.points.length })),
  };
  return projected;
}

export function buildAiToolContext(input: BuildAiToolContextInput): AiToolContextV1 {
  if (!input?.foundation?.game?.id) throw new Error("AI Tool Context requires an active Game Foundation.");
  const liveMap = readLiveCurrentMapSnapshot();
  const structure = projectStructure(liveMap.world.structure);
  const terrainSummary = summarizeTerrain(liveMap.world.terrain);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    game: { id: input.foundation.game.id, name: input.foundation.game.name },
    dna: projectDna(getFoundationActiveGameDna(input.foundation)),
    worldSeeds: projectWorldSeeds(input),
    map: {
      id: liveMap.id,
      name: liveMap.name,
      gridSize: liveMap.world.gridSize,
      foundation: { edgeMaterial: liveMap.foundation.edgeMaterial, edgeDepth: liveMap.foundation.edgeDepth },
      terrainSummary,
      objects: liveMap.objects.map((object) => ({ id: object.id, assetId: object.assetId, gx: object.gx, gy: object.gy })),
      objectsSummary: summarizeObjects(liveMap.objects),
      buildableSpace: computeBuildableSpace(liveMap.world.gridSize, terrainSummary, liveMap.objects),
      spatialLayout: computeSpatialLayout(liveMap.world, liveMap.objects),
      structure,
    },
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function isGridPoint(value: unknown): value is GridPoint {
  return Boolean(value) && Number.isInteger((value as GridPoint).gx) && Number.isInteger((value as GridPoint).gy);
}

function isValidDnaContent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every((entry) => entry === undefined || typeof entry === "string");
}

export function isValidAiToolContext(value: unknown): value is AiToolContextV1 {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<AiToolContextV1>;
  if (context.version !== 1 || !isNonEmptyString(context.generatedAt)) return false;
  if (!context.game || !isNonEmptyString(context.game.id) || !isNonEmptyString(context.game.name)) return false;

  const map = context.map;
  if (!map || !isNonEmptyString(map.id) || !isNonEmptyString(map.name)) return false;
  if (!Number.isInteger(map.gridSize) || (map.gridSize as number) <= 0) return false;
  if (!map.foundation || !(["soil", "rock", "cliff"] as string[]).includes(map.foundation.edgeMaterial) || !Number.isFinite(map.foundation.edgeDepth)) return false;

  const summary = map.terrainSummary;
  if (!summary || !summary.countsPerTerrainId || typeof summary.countsPerTerrainId !== "object") return false;
  const counts = Object.values(summary.countsPerTerrainId);
  if (!counts.every((count) => Number.isInteger(count) && count > 0)) return false;
  if (!Number.isInteger(summary.paintedCells) || (summary.paintedCells as number) < 0) return false;
  if (counts.reduce<number>((total, count) => total + count, 0) !== summary.paintedCells) return false;

  if (!Array.isArray(map.objects)) return false;
  if (!map.objects.every((object) => object && isNonEmptyString(object.id) && isNonEmptyString(object.assetId) && isGridPoint(object))) return false;

  if (map.objectsSummary !== undefined) {
    const objectsSummary = map.objectsSummary;
    if (!objectsSummary || typeof objectsSummary !== "object") return false;
    if (!Number.isInteger(objectsSummary.total) || (objectsSummary.total as number) < 0) return false;
    if (!objectsSummary.countsPerAssetId || typeof objectsSummary.countsPerAssetId !== "object") return false;
    const assetCounts = Object.values(objectsSummary.countsPerAssetId);
    if (!assetCounts.every((count) => Number.isInteger(count) && count > 0)) return false;
    if (assetCounts.reduce<number>((total, count) => total + count, 0) !== objectsSummary.total) return false;
    if (objectsSummary.total !== map.objects.length) return false;
  }

  if (map.buildableSpace !== undefined) {
    const buildable = map.buildableSpace;
    if (!buildable || typeof buildable !== "object") return false;
    const buildableFields = [buildable.gridSizeCells, buildable.paintedCells, buildable.occupiedByObjectCells, buildable.freeCells];
    if (!buildableFields.every((field) => Number.isInteger(field) && (field as number) >= 0)) return false;
    if (buildable.gridSizeCells !== map.gridSize * map.gridSize) return false;
    if (buildable.paintedCells !== summary.paintedCells) return false;
    const expectedFreeCells = Math.max(0, buildable.gridSizeCells - buildable.paintedCells - buildable.occupiedByObjectCells);
    if (buildable.freeCells !== expectedFreeCells) return false;
  }

  if (map.spatialLayout !== undefined) {
    const spatial = map.spatialLayout;
    if (!spatial || typeof spatial !== "object") return false;
    if (spatial.regionGridSize !== SPATIAL_REGION_GRID_SIZE) return false;
    if (!Array.isArray(spatial.regions)) return false;
    const seenRegionNames = new Set<string>();
    let totalRegionCells = 0;
    for (const region of spatial.regions) {
      if (!region || typeof region !== "object" || !isNonEmptyString(region.region)) return false;
      if (seenRegionNames.has(region.region)) return false;
      seenRegionNames.add(region.region);
      const regionFields = [region.totalCells, region.freeCells];
      if (!regionFields.every((field) => Number.isInteger(field) && (field as number) >= 0)) return false;
      totalRegionCells += region.totalCells;
      if (!region.countsPerAssetId || typeof region.countsPerAssetId !== "object") return false;
      if (!Object.values(region.countsPerAssetId).every((count) => Number.isInteger(count) && count > 0)) return false;
      const hasDominant = region.dominantTerrainId !== undefined;
      const hasShare = region.dominantTerrainShare !== undefined;
      if (hasDominant !== hasShare) return false;
      if (hasDominant && (!isNonEmptyString(region.dominantTerrainId) || !Number.isInteger(region.dominantTerrainShare) || (region.dominantTerrainShare as number) < 1 || (region.dominantTerrainShare as number) > 100)) return false;
      if (region.freeCells > region.totalCells) return false;
    }
    if (totalRegionCells !== map.gridSize * map.gridSize) return false;
  }

  if (context.dna !== undefined && !isValidDnaContent(context.dna)) return false;

  if (context.worldSeeds !== undefined) {
    if (!Array.isArray(context.worldSeeds)) return false;
    if (!context.worldSeeds.every((seed) => seed && isNonEmptyString(seed.label) && (WORLD_SEED_KEY_LOCATION_KINDS as readonly string[]).includes(seed.kind))) return false;
  }

  const structure = map.structure;
  if (structure !== undefined) {
    if (structure.dimensions !== undefined && (!Number.isInteger(structure.dimensions.width) || !Number.isInteger(structure.dimensions.height))) return false;
    if (structure.starterArea !== undefined && !(structure.starterArea && isNonEmptyString(structure.starterArea.id) && isGridPoint(structure.starterArea.center))) return false;
    if (structure.playerEntry !== undefined && !isGridPoint(structure.playerEntry)) return false;
    if (structure.centralGameplayArea !== undefined && !(structure.centralGameplayArea && isNonEmptyString(structure.centralGameplayArea.id) && isGridPoint(structure.centralGameplayArea.center))) return false;
    if (!Array.isArray(structure.keyLocations) || !structure.keyLocations.every((location) => location && isNonEmptyString(location.id) && isNonEmptyString(location.label) && isGridPoint(location))) return false;
    if (!Array.isArray(structure.explorableZones) || !structure.explorableZones.every((zone) => zone && isNonEmptyString(zone.id) && isNonEmptyString(zone.label) && isGridPoint(zone.center))) return false;
    if (!Array.isArray(structure.importantLandmarks) || !structure.importantLandmarks.every((landmark) => landmark && isNonEmptyString(landmark.id) && isNonEmptyString(landmark.label) && isGridPoint(landmark))) return false;
    if (!Array.isArray(structure.paths) || !structure.paths.every((path) => path && isNonEmptyString(path.id) && Number.isInteger(path.pointCount) && path.pointCount >= 0)) return false;
  }

  return true;
}
