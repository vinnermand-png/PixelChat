import { getAsset } from "./assetLibrary";
import type { AssetId, Cell } from "./types";

type PlacedObjectLike = {
  assetId: AssetId;
  gx: number;
  gy: number;
};

export function getAssetFootprintCells(assetId: AssetId, gx: number, gy: number): Cell[] | null {
  const asset = getAsset(assetId);
  if (!asset) return null;
  return asset.collision.footprint.map((offset) => ({
    gx: gx + offset.gx,
    gy: gy + offset.gy,
  }));
}

export function validateAssetPlacement(
  assetId: AssetId,
  gx: number,
  gy: number,
  terrain: Record<string, unknown>,
  objects: PlacedObjectLike[],
): boolean {
  const footprintCells = getAssetFootprintCells(assetId, gx, gy);
  if (!footprintCells) return false;

  const occupiedCells = new Set<string>();
  for (const object of objects) {
    const objectCells = getAssetFootprintCells(object.assetId, object.gx, object.gy);
    if (!objectCells) continue;
    for (const cell of objectCells) occupiedCells.add(`${cell.gx},${cell.gy}`);
  }

  return footprintCells.every((cell) => {
    const key = `${cell.gx},${cell.gy}`;
    return Boolean(terrain[key]) && !occupiedCells.has(key);
  });
}
