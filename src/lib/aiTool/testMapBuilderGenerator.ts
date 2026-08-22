import type { AiToolRequestV1 } from "./aiToolRequest";
import type { MapBuilderAiResultV2 } from "./mapBuilderAiResult";

export function generateTestMapBuilderResult(request: AiToolRequestV1): MapBuilderAiResultV2 {
  const text = request.request.toLowerCase();
  if (text.includes("rock") || text.includes("stone")) {
    return {
      version: 2,
      summary: `Map Builder would shape a rocky clearing for: ${request.request.trim()}`,
      operations: [
        { type: "paint-terrain", terrain: "stone", target: "rocky-clearing" },
        { type: "place-object", object: "testLargeTree", target: "rocky-clearing-edge" },
      ],
    };
  }
  if (text.includes("snow") || text.includes("winter") || text.includes("ice")) {
    return {
      version: 2,
      summary: `Map Builder would lay out a snowy grove for: ${request.request.trim()}`,
      operations: [
        { type: "paint-terrain", terrain: "snow", target: "snowy-grove" },
        { type: "place-object", object: "testTree", target: "snowy-grove-edge" },
      ],
    };
  }
  if (text.includes("sand") || text.includes("beach") || text.includes("desert")) {
    return {
      version: 2,
      summary: `Map Builder would open a sandy rest spot for: ${request.request.trim()}`,
      operations: [
        { type: "paint-terrain", terrain: "sand", target: "sandy-rest-spot" },
        { type: "place-object", object: "testTree", target: "sandy-rest-spot-shade" },
      ],
    };
  }
  return {
    version: 2,
    summary: `Map Builder would create a small forest gathering area for: ${request.request.trim()}`,
    operations: [
      { type: "paint-terrain", terrain: "dirt", target: "forest-gathering-clearing" },
      { type: "place-object", object: "testTree", target: "forest-gathering-edge" },
      { type: "place-object", object: "testLargeTree", target: "forest-gathering-backdrop" },
    ],
  };
}
