import type { AiToolRequestV1 } from "./aiToolRequest";
import type { MapBuilderAiResultV2 } from "./mapBuilderAiResult";

const REGION_ROW_NAMES = ["upper", "center", "lower"] as const;
const REGION_COL_NAMES = ["left", "center", "right"] as const;

interface RegionPosition {
  name: string;
  row: number;
  col: number;
  freeCells: number;
  totalCells: number;
  countsPerAssetId: Record<string, number>;
  dominantTerrainId?: string;
  order: number;
}

function loadRegions(request: AiToolRequestV1): RegionPosition[] {
  const spatial = request.context?.map.spatialLayout;
  if (!spatial) return [];
  return spatial.regions.map((region, order) => {
    let row = -1;
    let col = -1;
    const parts = region.region.split("-");
    parts.forEach((part) => {
      const rowIndex = (REGION_ROW_NAMES as readonly string[]).indexOf(part);
      const colIndex = (REGION_COL_NAMES as readonly string[]).indexOf(part);
      if (rowIndex >= 0 && colIndex >= 0) {
        if (row < 0 && col < 0) {
          row = 1;
          col = 1;
        } else if (row < 0) {
          row = 1;
        } else if (col < 0) {
          col = 1;
        }
      } else if (rowIndex >= 0) {
        row = rowIndex;
      } else if (colIndex >= 0) {
        col = colIndex;
      }
    });
    return {
      name: region.region,
      row: row < 0 ? 1 : row,
      col: col < 0 ? 1 : col,
      freeCells: region.freeCells,
      totalCells: region.totalCells,
      countsPerAssetId: region.countsPerAssetId,
      dominantTerrainId: region.dominantTerrainId,
      order,
    };
  });
}

function chebyshevDistance(a: RegionPosition, b: RegionPosition): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function pickMostOpenRegion(regions: RegionPosition[]): RegionPosition | null {
  const candidates = [...regions].sort((a, b) => b.freeCells - a.freeCells || a.order - b.order);
  return candidates[0] ?? null;
}

function describeExistingWorld(request: AiToolRequestV1): string {
  const map = request.context?.map;
  if (!map) return "the current map";
  const dominant = Object.entries(map.terrainSummary.countsPerTerrainId).sort((a, b) => b[1] - a[1])[0]?.[0];
  const objectTotal = map.objectsSummary?.total ?? map.objects.length;
  const terrainPart = dominant ? `${dominant}-led` : "unpainted";
  return `fits the existing ${terrainPart} map with ${objectTotal} placed objects`;
}

function pickTreePair(request: AiToolRequestV1): { primary: string; secondary: string } {
  const counts = request.context?.map.objectsSummary?.countsPerAssetId ?? {};
  const testTreeCount = counts.testTree ?? 0;
  const testLargeTreeCount = counts.testLargeTree ?? 0;
  return testTreeCount >= testLargeTreeCount
    ? { primary: "testTree", secondary: "testLargeTree" }
    : { primary: "testLargeTree", secondary: "testTree" };
}

function planForestGathering(request: AiToolRequestV1): { target: string; rationale: string } {
  const regions = loadRegions(request);
  if (!regions.length) return { target: "forest-gathering-clearing", rationale: "no spatial context is available yet" };
  const treeCount = (region: RegionPosition) => (region.countsPerAssetId.testTree ?? 0) + (region.countsPerAssetId.testLargeTree ?? 0);
  const clusters = [...regions].filter((region) => treeCount(region) >= 2).sort((a, b) => treeCount(b) - treeCount(a) || a.order - b.order);
  const cluster = clusters[0];
  if (cluster) {
    const open = [...regions].sort((a, b) => chebyshevDistance(a, cluster) - chebyshevDistance(b, cluster) || b.freeCells - a.freeCells || a.order - b.order)
      .find((region) => region.name !== cluster.name && region.totalCells > 0 && region.freeCells / region.totalCells >= 0.5);
    if (open) {
      if (open.dominantTerrainId === "dirt") {
        return { target: "pathside-gathering", rationale: `the ${cluster.name} tree cluster frames it and the existing dirt ground gives natural access` };
      }
      if (chebyshevDistance(open, cluster) <= 1) {
        return { target: "forest-edge-gathering", rationale: `it extends the ${cluster.name} tree cluster into the adjacent open ${open.name} area with a natural transition` };
      }
      return { target: `${open.name}-gathering-area`, rationale: `it balances the ${cluster.name} tree cluster with an open social space at ${open.name}` };
    }
    return { target: "forest-gathering-clearing", rationale: `the ${cluster.name} trees already frame the map and remaining space is tight` };
  }
  const center = regions.find((region) => region.name === "center");
  if (center && center.totalCells > 0 && center.freeCells / center.totalCells >= 0.5) {
    return { target: "central-gathering-area", rationale: "the open middle of the platform is the natural focal point for a gathering space" };
  }
  const open = pickMostOpenRegion(regions);
  if (open) {
    return { target: `${open.name}-gathering-area`, rationale: `${open.name} offers the most room to compose a new area on this map` };
  }
  return { target: "forest-gathering-clearing", rationale: "no spatial context is available yet" };
}

export function generateTestMapBuilderResult(request: AiToolRequestV1): MapBuilderAiResultV2 {
  const text = request.request.toLowerCase();
  const worldNote = describeExistingWorld(request);
  const trees = pickTreePair(request);
  if (text.includes("rock") || text.includes("stone")) {
    return {
      version: 2,
      summary: `Map Builder would shape a rocky clearing for: ${request.request.trim()} (${worldNote})`,
      operations: [
        { type: "paint-terrain", terrain: "stone", target: "rocky-clearing" },
        { type: "place-object", object: trees.secondary, target: "rocky-clearing-edge" },
      ],
    };
  }
  if (text.includes("snow") || text.includes("winter") || text.includes("ice")) {
    return {
      version: 2,
      summary: `Map Builder would lay out a snowy grove for: ${request.request.trim()} (${worldNote})`,
      operations: [
        { type: "paint-terrain", terrain: "snow", target: "snowy-grove" },
        { type: "place-object", object: trees.secondary, target: "snowy-grove-edge" },
      ],
    };
  }
  if (text.includes("sand") || text.includes("beach") || text.includes("desert")) {
    return {
      version: 2,
      summary: `Map Builder would open a sandy rest spot for: ${request.request.trim()} (${worldNote})`,
      operations: [
        { type: "paint-terrain", terrain: "sand", target: "sandy-rest-spot" },
        { type: "place-object", object: trees.secondary, target: "sandy-rest-spot-shade" },
      ],
    };
  }
  const forest = planForestGathering(request);
  return {
    version: 2,
    summary: `Map Builder would create a forest gathering area at ${forest.target.replace(/-/g, " ")} because ${forest.rationale}, for: ${request.request.trim()} (${worldNote})`,
    operations: [
      { type: "paint-terrain", terrain: "dirt", target: forest.target },
      { type: "place-object", object: trees.primary, target: `${forest.target}-edge` },
      { type: "place-object", object: trees.secondary, target: `${forest.target}-backdrop` },
    ],
  };
}
