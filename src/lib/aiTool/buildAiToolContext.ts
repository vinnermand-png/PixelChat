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

export interface AiToolContextV1Map {
  id: string;
  name: string;
  gridSize: number;
  foundation: { edgeMaterial: string; edgeDepth: number };
  terrainSummary: AiToolContextV1TerrainSummary;
  objects: Array<{ id: string; assetId: string; gx: number; gy: number }>;
  objectsSummary?: AiToolContextV1ObjectsSummary;
  buildableSpace?: AiToolContextV1BuildableSpace;
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
