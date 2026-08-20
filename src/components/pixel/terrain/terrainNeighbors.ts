import type { TerrainAssetId } from "./terrainAssetLibrary";

export type TerrainNeighbors = {
  north: TerrainAssetId | undefined;
  south: TerrainAssetId | undefined;
  east: TerrainAssetId | undefined;
  west: TerrainAssetId | undefined;
};

export type TerrainSameTypeNeighbors = {
  northSame: boolean;
  southSame: boolean;
  eastSame: boolean;
  westSame: boolean;
};

export type TerrainVisualState =
  | "center"
  | "isolated"
  | "north-edge"
  | "south-edge"
  | "east-edge"
  | "west-edge"
  | "corner"
  | "edge";

export type TerrainVisualStateResult = TerrainSameTypeNeighbors & {
  terrainId: TerrainAssetId | undefined;
  state: TerrainVisualState;
};

function cellKey(gx: number, gy: number) {
  return `${gx},${gy}`;
}

export function getTerrainNeighbors(
  terrain: Record<string, TerrainAssetId>,
  gx: number,
  gy: number,
): TerrainNeighbors {
  return {
    north: terrain[cellKey(gx, gy - 1)],
    south: terrain[cellKey(gx, gy + 1)],
    east: terrain[cellKey(gx + 1, gy)],
    west: terrain[cellKey(gx - 1, gy)],
  };
}

export function getTerrainSameTypeNeighbors(
  terrain: Record<string, TerrainAssetId>,
  gx: number,
  gy: number,
): TerrainSameTypeNeighbors {
  const terrainId = terrain[cellKey(gx, gy)];
  const neighbors = getTerrainNeighbors(terrain, gx, gy);

  return {
    northSame: terrainId !== undefined && neighbors.north === terrainId,
    southSame: terrainId !== undefined && neighbors.south === terrainId,
    eastSame: terrainId !== undefined && neighbors.east === terrainId,
    westSame: terrainId !== undefined && neighbors.west === terrainId,
  };
}

export function getTerrainVisualState(
  terrain: Record<string, TerrainAssetId>,
  gx: number,
  gy: number,
): TerrainVisualStateResult {
  const terrainId = terrain[cellKey(gx, gy)];
  const sameTypeNeighbors = getTerrainSameTypeNeighbors(terrain, gx, gy);
  const { northSame, southSame, eastSame, westSame } = sameTypeNeighbors;

  const sameCount = [northSame, southSame, eastSame, westSame].filter(Boolean).length;

  let state: TerrainVisualState;

  if (sameCount === 4) {
    state = "center";
  } else if (sameCount === 0) {
    state = "isolated";
  } else if (sameCount === 3) {
    if (!northSame) state = "north-edge";
    else if (!southSame) state = "south-edge";
    else if (!eastSame) state = "east-edge";
    else state = "west-edge";
  } else if (
    sameCount === 2 &&
    ((northSame && eastSame) ||
      (eastSame && southSame) ||
      (southSame && westSame) ||
      (westSame && northSame))
  ) {
    state = "corner";
  } else {
    state = "edge";
  }

  return {
    terrainId,
    ...sameTypeNeighbors,
    state,
  };
}
