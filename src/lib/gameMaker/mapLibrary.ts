export const MAP_LIBRARY_STORAGE_KEY = "pixelchat-game-maker-v2-maps-v1";
export const MAP_LIBRARY_VERSION = 1;

export type MapLibraryRecord<TMap> = {
  map: TMap;
  savedAt: number;
};

export type MapLibraryState<TMap> = {
  version: typeof MAP_LIBRARY_VERSION;
  activeMapId: string;
  maps: Array<MapLibraryRecord<TMap>>;
};

export function isMapLibraryState<TMap>(value: unknown): value is MapLibraryState<TMap> {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<MapLibraryState<TMap>>;
  return state.version === MAP_LIBRARY_VERSION
    && typeof state.activeMapId === "string"
    && Array.isArray(state.maps)
    && state.maps.every((entry) => Boolean(entry) && typeof entry === "object" && typeof (entry as MapLibraryRecord<TMap>).savedAt === "number" && Boolean((entry as MapLibraryRecord<TMap>).map));
}
