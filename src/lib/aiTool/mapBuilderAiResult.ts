export const MAP_BUILDER_OPERATION_TYPES = ["paint-terrain", "place-object"] as const;
export type MapBuilderOperationType = (typeof MAP_BUILDER_OPERATION_TYPES)[number];

export type MapBuilderOperation =
  | {
      type: "paint-terrain";
      terrain: string;
      target: string;
    }
  | {
      type: "place-object";
      object: string;
      target: string;
    };

export interface MapBuilderAiResultV2 {
  version: 2;
  summary: string;
  operations: MapBuilderOperation[];
}

export const MAP_BUILDER_MIN_OPERATIONS = 1;
export const MAP_BUILDER_MAX_OPERATIONS = 32;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function isValidMapBuilderOperation(value: unknown): value is MapBuilderOperation {
  if (!value || typeof value !== "object") return false;
  const operation = value as Record<string, unknown>;
  if (!isNonEmptyString(operation.target)) return false;
  switch (operation.type) {
    case "paint-terrain":
      return isNonEmptyString(operation.terrain);
    case "place-object":
      return isNonEmptyString(operation.object);
    default:
      return false;
  }
}

export function isValidMapBuilderAiResultV2(value: unknown): value is MapBuilderAiResultV2 {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<MapBuilderAiResultV2>;
  if (result.version !== 2) return false;
  if (!isNonEmptyString(result.summary)) return false;
  if (!Array.isArray(result.operations)) return false;
  if (result.operations.length < MAP_BUILDER_MIN_OPERATIONS) return false;
  if (result.operations.length > MAP_BUILDER_MAX_OPERATIONS) return false;
  return result.operations.every((operation) => isValidMapBuilderOperation(operation));
}
