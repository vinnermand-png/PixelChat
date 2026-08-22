export interface MapBuilderAiResultV1 {
  version: 1;
  summary: string;
}

export function isValidMapBuilderAiResult(value: unknown): value is MapBuilderAiResultV1 {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<MapBuilderAiResultV1>;
  return result.version === 1 && typeof result.summary === "string" && Boolean(result.summary.trim());
}
