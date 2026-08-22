const MAP_STORAGE_KEY = "pixelchat-game-maker-v2-map-v1";

type TerrainId = "grass" | "dirt" | "snow" | "sand" | "stone";
type GridPoint = { gx: number; gy: number };
type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };
type TerrainZone = { terrainId: TerrainId; bounds: WorldBounds };
type TerrainPath = { points: GridPoint[]; terrainId: "dirt" };
type MaterializationStructure = {
  dimensions?: { width: number; height: number; bounds: WorldBounds };
  playerEntry?: { gx: number; gy: number; worldId: string; mapId: string };
  centralGameplayArea?: { center: GridPoint; bounds: WorldBounds; worldId: string; mapId: string };
  terrain?: { zones?: TerrainZone[]; paths?: TerrainPath[] };
  playable?: { id: string };
};
type StoredMap = {
  version: 1;
  id: string;
  name: string;
  world: {
    gridSize: number;
    width?: number;
    height?: number;
    terrain: Record<string, TerrainId>;
    structure?: MaterializationStructure;
  };
  foundation: { edgeMaterial: "soil" | "rock" | "cliff"; edgeDepth: number };
  objects: Array<{ id: string; assetId: string; gx: number; gy: number }>;
};

function cellKey(point: GridPoint) {
  return `${point.gx},${point.gy}`;
}

function inBounds(point: GridPoint, bounds: WorldBounds) {
  return point.gx >= bounds.minX && point.gx <= bounds.maxX && point.gy >= bounds.minY && point.gy <= bounds.maxY;
}

function parseStoredMap(raw: string | null): StoredMap {
  if (!raw) throw new Error("The canonical GameMaker map is unavailable.");
  const map = JSON.parse(raw) as StoredMap;
  if (!map.world || !map.world.structure || !map.world.terrain) {
    throw new Error("The canonical world structure is not available for materialization.");
  }
  return map;
}

function getBaseTerrainAt(point: GridPoint, zones: TerrainZone[]) {
  return zones.find((candidate) => inBounds(point, candidate.bounds))?.terrainId;
}

function setMaterializedTerrain(
  terrain: Record<string, TerrainId>,
  point: GridPoint,
  terrainId: TerrainId,
  baseTerrain: TerrainId | undefined,
) {
  const key = cellKey(point);
  const current = terrain[key];
  if (!current || current === baseTerrain) {
    terrain[key] = terrainId;
    return current !== terrainId;
  }
  return false;
}

function materializeArea(
  terrain: Record<string, TerrainId>,
  bounds: WorldBounds,
  terrainId: TerrainId,
  zones: TerrainZone[],
) {
  const center = {
    gx: Math.floor((bounds.minX + bounds.maxX) / 2),
    gy: Math.floor((bounds.minY + bounds.maxY) / 2),
  };
  const points: GridPoint[] = [
    center,
    { gx: center.gx - 1, gy: center.gy },
    { gx: center.gx + 1, gy: center.gy },
    { gx: center.gx, gy: center.gy - 1 },
    { gx: center.gx, gy: center.gy + 1 },
  ];
  return points.reduce((didChange, point) => {
    if (!inBounds(point, bounds)) return didChange;
    return setMaterializedTerrain(terrain, point, terrainId, getBaseTerrainAt(point, zones)) || didChange;
  }, false);
}

export function materializeCompletedWorld(): { changed: boolean; summary: string } {
  if (typeof window === "undefined") throw new Error("World materialization requires the browser GameMaker runtime.");
  const map = parseStoredMap(localStorage.getItem(MAP_STORAGE_KEY));
  const structure = map.world.structure!;
  const dimensions = structure.dimensions;
  const zones = structure.terrain?.zones ?? [];
  const paths = structure.terrain?.paths ?? [];
  const playerEntry = structure.playerEntry;
  const centralGameplayArea = structure.centralGameplayArea;

  if (!structure.playable || !dimensions || !zones.length || !playerEntry || !centralGameplayArea) {
    throw new Error("World dimensions, terrain zones, player entry and central gameplay area are required before materialization.");
  }
  if (playerEntry.worldId !== structure.playable.id || playerEntry.mapId !== map.id) {
    throw new Error("The player entry does not reference the active world and map.");
  }
  if (centralGameplayArea.worldId !== structure.playable.id || centralGameplayArea.mapId !== map.id) {
    throw new Error("The central gameplay area does not reference the active world and map.");
  }

  const terrain = { ...map.world.terrain };
  let changed = false;

  const gridSize = Math.max(dimensions.width, dimensions.height);
  if (map.world.gridSize !== gridSize) {
    map.world.gridSize = gridSize;
    changed = true;
  }
  if (map.world.width !== dimensions.width || map.world.height !== dimensions.height) {
    map.world.width = dimensions.width;
    map.world.height = dimensions.height;
    changed = true;
  }

  for (const path of paths) {
    for (const point of path.points) {
      if (!inBounds(point, dimensions.bounds)) throw new Error("A persisted terrain path is outside the playable world bounds.");
      changed ||= setMaterializedTerrain(terrain, point, path.terrainId, getBaseTerrainAt(point, zones));
    }
  }

  changed ||= materializeArea(terrain, centralGameplayArea.bounds, "dirt", zones);

  const entryPoint = { gx: playerEntry.gx, gy: playerEntry.gy };
  if (!inBounds(entryPoint, dimensions.bounds)) {
    throw new Error("The player entry is outside the playable world bounds.");
  }
  const pathPoints = new Set(paths.flatMap((path) => path.points.map(cellKey)));
  const entryKey = cellKey(entryPoint);
  const entryCurrent = terrain[entryKey];
  if (entryCurrent === undefined || entryCurrent === getBaseTerrainAt(entryPoint, zones) || (entryCurrent === "dirt" && !pathPoints.has(entryKey))) {
    if (entryCurrent !== "stone") {
      terrain[entryKey] = "stone";
      changed = true;
    }
  }

  if (JSON.stringify(map.world.terrain) !== JSON.stringify(terrain)) {
    map.world.terrain = terrain;
    changed = true;
  }

  if (!changed) return { changed: false, summary: "World already materialized; no duplicate terrain or markers were added." };

  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
  const loadButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Load");
  if (!loadButton) throw new Error("The existing GameMaker Load action is unavailable.");
  loadButton.click();

  return {
    changed: true,
    summary: `Materialized ${dimensions.width} × ${dimensions.height} world bounds, terrain paths, central gathering area and player entry into the existing GameMaker map.`,
  };
}
