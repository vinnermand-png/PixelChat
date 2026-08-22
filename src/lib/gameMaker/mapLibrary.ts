export const MAP_LIBRARY_STORAGE_KEY = "pixelchat-game-maker-v2-maps-v1";
export const MAP_LIBRARY_VERSION = 1;

export type MapLibraryRecord<TMap> = {
  map: TMap;
  savedAt: number;
  gameSessionId?: string;
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
    && state.maps.every((entry) => Boolean(entry) && typeof entry === "object" && typeof (entry as MapLibraryRecord<TMap>).savedAt === "number" && Boolean((entry as MapLibraryRecord<TMap>).map) && ((entry as MapLibraryRecord<TMap>).gameSessionId === undefined || typeof (entry as MapLibraryRecord<TMap>).gameSessionId === "string"));
}

export function readActiveSavedMapSessionId(mapStorageKey: string): string | null {
  try {
    const rawMap = localStorage.getItem(mapStorageKey);
    const rawLibrary = localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
    if (!rawMap || !rawLibrary) return null;
    const parsedMap: unknown = JSON.parse(rawMap);
    const mapId = typeof parsedMap === "object" && parsedMap !== null && typeof (parsedMap as { id?: unknown }).id === "string" ? (parsedMap as { id: string }).id : null;
    if (!mapId || !mapId.trim()) return null;
    const parsedLibrary: unknown = JSON.parse(rawLibrary);
    if (!isMapLibraryState(parsedLibrary)) return null;
    const record = parsedLibrary.maps.find((entry) => (entry.map as { id?: unknown }).id === mapId);
    const sessionId = record?.gameSessionId;
    return typeof sessionId === "string" && sessionId.trim() ? sessionId : null;
  } catch {
    return null;
  }
}

export function deleteSavedMap<TMap>(mapId: string): MapLibraryState<TMap> {
  const raw = localStorage.getItem(MAP_LIBRARY_STORAGE_KEY);
  if (!raw) {
    return { version: MAP_LIBRARY_VERSION, activeMapId: "", maps: [] };
  }

  const parsed: unknown = JSON.parse(raw);
  if (!isMapLibraryState<TMap>(parsed)) {
    throw new Error("Saved map library is invalid.");
  }

  const maps = parsed.maps.filter((record) => {
    const recordMap = record.map as { id?: unknown };
    return recordMap.id !== mapId;
  });

  const activeMapId = parsed.activeMapId === mapId ? "" : parsed.activeMapId;
  const nextLibrary: MapLibraryState<TMap> = {
    version: MAP_LIBRARY_VERSION,
    activeMapId: maps.some((record) => (record.map as { id?: unknown }).id === activeMapId) ? activeMapId : "",
    maps,
  };

  localStorage.setItem(MAP_LIBRARY_STORAGE_KEY, JSON.stringify(nextLibrary));
  return nextLibrary;
}
