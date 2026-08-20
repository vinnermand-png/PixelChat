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
