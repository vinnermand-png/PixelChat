import { buildAiToolContext, isValidAiToolContext, type AiToolContextV1, type BuildAiToolContextInput } from "./buildAiToolContext";

export type AiToolId = "map-builder";

export const AI_TOOL_IDS: readonly AiToolId[] = ["map-builder"];

export interface AiToolRequestV1 {
  version: 1;
  tool: AiToolId;
  request: string;
  context: AiToolContextV1;
}

export function buildAiToolRequest(input: {
  tool: AiToolId;
  request: string;
} & Pick<BuildAiToolContextInput, "foundation" | "buildPlan">): AiToolRequestV1 {
  if (!input?.request?.trim()) throw new Error("An AI tool request requires a non-empty request description.");
  return {
    version: 1,
    tool: input.tool,
    request: input.request.trim(),
    context: buildAiToolContext({ foundation: input.foundation, buildPlan: input.buildPlan }),
  };
}

export function isValidAiToolRequest(value: unknown): value is AiToolRequestV1 {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<AiToolRequestV1>;
  return request.version === 1
    && typeof request.tool === "string"
    && (AI_TOOL_IDS as readonly string[]).includes(request.tool)
    && typeof request.request === "string"
    && Boolean(request.request.trim())
    && isValidAiToolContext(request.context);
}
