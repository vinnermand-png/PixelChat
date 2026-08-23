import type { AiToolRequestV1 } from "./aiToolRequest";
import type { MapBuilderAiResultV2 } from "./mapBuilderAiResult";

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
  return {
    version: 2,
    summary: `Map Builder would create a small forest gathering area for: ${request.request.trim()} (${worldNote})`,
    operations: [
      { type: "paint-terrain", terrain: "dirt", target: "forest-gathering-clearing" },
      { type: "place-object", object: trees.primary, target: "forest-gathering-edge" },
      { type: "place-object", object: trees.secondary, target: "forest-gathering-backdrop" },
    ],
  };
}
