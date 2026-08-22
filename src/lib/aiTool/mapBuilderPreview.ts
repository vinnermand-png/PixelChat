import { ASSET_LIBRARY } from "@/components/pixel/assets/assetLibrary";
import type { MapBuilderOperation } from "./mapBuilderAiResult";

export type MapBuilderPreviewTerrainCell = { gx: number; gy: number; terrainId: string };
export type MapBuilderPreviewObjectGhost = { assetId: string; gx: number; gy: number };
export type MapBuilderPreviewTargetArea = { label: string; minX: number; minY: number; maxX: number; maxY: number };

export interface MapBuilderPreviewPlanV1 {
  version: 1;
  terrainCells: MapBuilderPreviewTerrainCell[];
  objectGhosts: MapBuilderPreviewObjectGhost[];
  targetAreas: MapBuilderPreviewTargetArea[];
}

export interface MapBuilderPreviewMapInput {
  gridSize: number;
  occupiedCellKeys: string[];
}

const PREVIEW_PATCH_SIZE = 5;

const GHOST_SLOT_OFFSETS: Array<{ gx: number; gy: number }> = [
  { gx: 2, gy: 2 },
  { gx: 1, gy: 1 },
  { gx: 3, gy: 1 },
  { gx: 1, gy: 3 },
  { gx: 3, gy: 3 },
  { gx: 2, gy: 1 },
  { gx: 1, gy: 2 },
  { gx: 3, gy: 2 },
];

function cellKey(gx: number, gy: number) {
  return `${gx},${gy}`;
}

function resolvePatchBounds(index: number, gridSize: number): MapBuilderPreviewTargetArea {
  const size = Math.min(PREVIEW_PATCH_SIZE, gridSize);
  const half = Math.floor(size / 2);
  const center = Math.floor(gridSize / 2);
  const maxX = gridSize - size;
  const minX = Math.min(Math.max(0, center - half + index * PREVIEW_PATCH_SIZE), Math.max(0, maxX));
  const minY = Math.min(Math.max(0, center - half + index * PREVIEW_PATCH_SIZE), Math.max(0, maxX));
  return { label: "", minX, minY, maxX: minX + size - 1, maxY: minY + size - 1 };
}

function footprintCellsForAsset(assetId: string, gx: number, gy: number): Array<{ gx: number; gy: number }> {
  const asset = ASSET_LIBRARY.find((candidate) => candidate.id === assetId);
  const footprint = asset?.collision.enabled ? asset.collision.footprint : [{ gx: 0, gy: 0 }];
  return footprint.map((offset) => ({ gx: gx + offset.gx, gy: gy + offset.gy }));
}

export function buildMapBuilderPreviewPlan(map: MapBuilderPreviewMapInput, operations: MapBuilderOperation[]): MapBuilderPreviewPlanV1 {
  const targetLabels: string[] = [];
  for (const operation of operations) {
    if (!targetLabels.includes(operation.target)) targetLabels.push(operation.target);
  }

  const targetAreas = new Map<string, MapBuilderPreviewTargetArea>();
  targetLabels.forEach((label, index) => {
    targetAreas.set(label, { ...resolvePatchBounds(index, map.gridSize), label });
  });

  const terrainCells: MapBuilderPreviewTerrainCell[] = [];
  const seenTerrainKeys = new Set<string>();
  for (const operation of operations) {
    if (operation.type !== "paint-terrain") continue;
    const area = targetAreas.get(operation.target);
    if (!area) continue;
    for (let gx = area.minX; gx <= area.maxX; gx++) {
      for (let gy = area.minY; gy <= area.maxY; gy++) {
        const key = cellKey(gx, gy);
        if (seenTerrainKeys.has(key)) continue;
        seenTerrainKeys.add(key);
        terrainCells.push({ gx, gy, terrainId: operation.terrain });
      }
    }
  }

  const occupied = new Set(map.occupiedCellKeys);
  const reservedByGhosts = new Set<string>();
  const objectGhosts: MapBuilderPreviewObjectGhost[] = [];
  for (const operation of operations) {
    if (operation.type !== "place-object") continue;
    const area = targetAreas.get(operation.target);
    if (!area) continue;
    for (const slot of GHOST_SLOT_OFFSETS) {
      const gx = area.minX + slot.gx;
      const gy = area.minY + slot.gy;
      if (gx > area.maxX || gy > area.maxY) continue;
      const cells = footprintCellsForAsset(operation.object, gx, gy);
      if (!cells.every((cell) => cell.gx <= area.maxX && cell.gy <= area.maxY)) continue;
      if (!cells.every((cell) => !occupied.has(cellKey(cell.gx, cell.gy)) && !reservedByGhosts.has(cellKey(cell.gx, cell.gy)))) continue;
      for (const cell of cells) reservedByGhosts.add(cellKey(cell.gx, cell.gy));
      objectGhosts.push({ assetId: operation.object, gx, gy });
      break;
    }
  }

  return {
    version: 1,
    terrainCells,
    objectGhosts,
    targetAreas: [...targetAreas.values()],
  };
}
