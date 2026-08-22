const MAP_STORAGE_KEY = "pixelchat-game-maker-v2-map-v1";

type TerrainId = "grass" | "dirt" | "snow" | "sand" | "stone";
type GridPoint = { gx: number; gy: number };
type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };
type TerrainZone = { terrainId: TerrainId; bounds: WorldBounds };
type TerrainPath = { points: GridPoint[]; terrainId: "dirt" };
type KeyLocation = { id: string; label: string; kind: string; gx: number; gy: number; worldId: string; mapId: string };
type ExplorableZone = { id: string; label: string; bounds: WorldBounds; center: GridPoint; worldId: string; mapId: string };
type ImportantLandmark = { id: string; label: string; kind: string; gx: number; gy: number; worldId: string; mapId: string };
type MaterializationStructure = {
  dimensions?: { width: number; height: number; bounds: WorldBounds };
  playerEntry?: { gx: number; gy: number; worldId: string; mapId: string };
  centralGameplayArea?: { center: GridPoint; bounds: WorldBounds; worldId: string; mapId: string };
  keyLocations?: KeyLocation[];
  additionalExplorableZones?: ExplorableZone[];
  importantLandmarks?: ImportantLandmark[];
  terrain?: { zones?: TerrainZone[]; paths?: TerrainPath[] };
  playable?: { id: string };
};
type PlacedObject = { id: string; assetId: string; gx: number; gy: number };
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
  objects: PlacedObject[];
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

function materializePointSet(
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
    { gx: center.gx - 1, gy: center.gy - 1 },
    { gx: center.gx + 1, gy: center.gy + 1 },
  ];
  return points.reduce((didChange, point) => {
    if (!inBounds(point, bounds)) return didChange;
    return setMaterializedTerrain(terrain, point, terrainId, getBaseTerrainAt(point, zones)) || didChange;
  }, false);
}

function keyLocationTerrain(kind: string): TerrainId {
  const value = kind.toLowerCase();
  if (value === "fishing") return "sand";
  if (value === "combat") return "stone";
  if (value === "adventure") return "dirt";
  return "dirt";
}

function explorableZoneTerrain(label: string): TerrainId {
  const value = label.toLowerCase();
  if (/beach|shore|harbor|harbour|coast|dock|pier/.test(value)) return "sand";
  if (/forest|wood|woods|grove/.test(value)) return "grass";
  if (/mountain|rock|cliff|cave/.test(value)) return "stone";
  return "dirt";
}

function getObjectFootprint(object: PlacedObject) {
  const footprint = object.assetId === "testLargeTree"
    ? [{ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 }, { gx: 1, gy: 1 }]
    : [{ gx: 0, gy: 0 }];
  return footprint.map((offset) => ({ gx: object.gx + offset.gx, gy: object.gy + offset.gy }));
}

function canPlaceObject(objects: PlacedObject[], assetId: string, point: GridPoint, bounds: WorldBounds) {
  const candidate: PlacedObject = { id: "candidate", assetId, gx: point.gx, gy: point.gy };
  const candidateCells = getObjectFootprint(candidate);
  if (candidateCells.some((cell) => !inBounds(cell, bounds))) return false;
  const occupied = new Set(objects.flatMap(getObjectFootprint).map(cellKey));
  return !candidateCells.some((cell) => occupied.has(cellKey(cell)));
}

function addMaterializedObject(objects: PlacedObject[], object: PlacedObject, bounds: WorldBounds, alternatives: GridPoint[]) {
  if (objects.some((candidate) => candidate.id === object.id)) return false;
  const candidatePoint = [
    { gx: object.gx, gy: object.gy },
    ...alternatives,
  ].find((point) => canPlaceObject(objects, object.assetId, point, bounds));
  if (!candidatePoint) return false;
  objects.push({ ...object, gx: candidatePoint.gx, gy: candidatePoint.gy });
  return true;
}

function materializeForestMarker(objects: PlacedObject[], zone: ExplorableZone, dimensions: WorldBounds) {
  const offsets = [
    { gx: 0, gy: 0 },
    { gx: -2, gy: 1 },
    { gx: 2, gy: -1 },
  ];
  let changed = false;
  offsets.forEach((offset, index) => {
    const point = { gx: zone.center.gx + offset.gx, gy: zone.center.gy + offset.gy };
    const alternatives = [
      { gx: point.gx + 1, gy: point.gy },
      { gx: point.gx - 1, gy: point.gy },
      { gx: point.gx, gy: point.gy + 1 },
      { gx: point.gx, gy: point.gy - 1 },
    ];
    changed ||= addMaterializedObject(objects, {
      id: `materialized-zone-${zone.id}-${index + 1}`,
      assetId: "testTree",
      gx: point.gx,
      gy: point.gy,
    }, dimensions, alternatives);
  });
  return changed;
}

function materializeLandmark(objects: PlacedObject[], landmark: ImportantLandmark, dimensions: WorldBounds) {
  const point = { gx: landmark.gx, gy: landmark.gy };
  if (!inBounds(point, dimensions)) throw new Error(`Important landmark ${landmark.id} is outside the playable world bounds.`);
  const alternatives = [
    { gx: point.gx + 2, gy: point.gy },
    { gx: point.gx - 2, gy: point.gy },
    { gx: point.gx, gy: point.gy + 2 },
    { gx: point.gx, gy: point.gy - 2 },
  ];
  return addMaterializedObject(objects, {
    id: `materialized-landmark-${landmark.id}`,
    assetId: "testLargeTree",
    gx: point.gx,
    gy: point.gy,
  }, dimensions, alternatives);
}

export function materializeCompletedWorld(): { changed: boolean; summary: string } {
  if (typeof window === "undefined") throw new Error("World materialization requires the browser GameMaker runtime.");
  const map = parseStoredMap(localStorage.getItem(MAP_STORAGE_KEY));
  const structure = map.world.structure!;
  const dimensions = structure.dimensions;
  const zones = structure.terrain?.zones ?? [];
  const paths = structure.terrain?.paths ?? [];
  const keyLocations = structure.keyLocations ?? [];
  const additionalExplorableZones = structure.additionalExplorableZones ?? [];
  const importantLandmarks = structure.importantLandmarks ?? [];
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
  if (keyLocations.some((location) => location.worldId !== structure.playable!.id || location.mapId !== map.id)) {
    throw new Error("A key location does not reference the active world and map.");
  }
  if (additionalExplorableZones.some((zone) => zone.worldId !== structure.playable!.id || zone.mapId !== map.id)) {
    throw new Error("An explorable zone does not reference the active world and map.");
  }
  if (importantLandmarks.some((landmark) => landmark.worldId !== structure.playable!.id || landmark.mapId !== map.id)) {
    throw new Error("An important landmark does not reference the active world and map.");
  }

  const terrain = { ...map.world.terrain };
  const objects = map.objects.map((object) => ({ ...object }));
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

  for (const location of keyLocations) {
    const point = { gx: location.gx, gy: location.gy };
    if (!inBounds(point, dimensions.bounds)) throw new Error(`Key location ${location.id} is outside the playable world bounds.`);
    const bounds = { minX: point.gx - 1, minY: point.gy - 1, maxX: point.gx + 1, maxY: point.gy + 1 };
    changed ||= materializePointSet(terrain, bounds, keyLocationTerrain(location.kind), zones);
  }

  for (const zone of additionalExplorableZones) {
    const bounds = {
      minX: Math.max(dimensions.bounds.minX, zone.bounds.minX),
      minY: Math.max(dimensions.bounds.minY, zone.bounds.minY),
      maxX: Math.min(dimensions.bounds.maxX, zone.bounds.maxX),
      maxY: Math.min(dimensions.bounds.maxY, zone.bounds.maxY),
    };
    if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) throw new Error(`Explorable zone ${zone.id} is outside the playable world bounds.`);
    const zoneTerrain = explorableZoneTerrain(zone.label);
    changed ||= materializePointSet(terrain, bounds, zoneTerrain, zones);
    if (zoneTerrain === "grass") changed ||= materializeForestMarker(objects, zone, dimensions.bounds);
  }

  for (const landmark of importantLandmarks) {
    changed ||= materializeLandmark(objects, landmark, dimensions.bounds);
  }

  if (JSON.stringify(map.world.terrain) !== JSON.stringify(terrain)) {
    map.world.terrain = terrain;
    changed = true;
  }
  if (JSON.stringify(map.objects) !== JSON.stringify(objects)) {
    map.objects = objects;
    changed = true;
  }

  if (!changed) return { changed: false, summary: "World already materialized; no duplicate areas, objects or markers were added." };

  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
  const loadButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Load");
  if (!loadButton) throw new Error("The existing GameMaker Load action is unavailable.");
  loadButton.click();

  return {
    changed: true,
    summary: `Materialized ${dimensions.width} × ${dimensions.height} world bounds, terrain paths, central area, ${keyLocations.length} key location(s), ${additionalExplorableZones.length} explorable zone(s) and ${importantLandmarks.length} landmark(s) into the existing GameMaker map.`,
  };
}
