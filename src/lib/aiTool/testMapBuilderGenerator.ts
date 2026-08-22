import type { AiToolRequestV1 } from "./aiToolRequest";
import type { MapBuilderAiResultV1 } from "./mapBuilderAiResult";

export function generateTestMapBuilderResult(request: AiToolRequestV1): MapBuilderAiResultV1 {
  return {
    version: 1,
    summary: `Map Builder understood the request: ${request.request.trim()}`,
  };
}
