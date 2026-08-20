export const TERRAIN_ASSET_IDS = ["grass", "dirt", "snow", "sand", "stone"] as const;
export type TerrainAssetId = typeof TERRAIN_ASSET_IDS[number];

export type TerrainAssetDefinition = {
  id: TerrainAssetId;
  name: string;
  category: "terrain";
  thumbnail: {
    color: string;
  };
  surface: {
    color: string;
  };
};

export const TERRAIN_LIBRARY: readonly TerrainAssetDefinition[] = [
  {
    id: "grass",
    name: "Grass",
    category: "terrain",
    thumbnail: { color: "#4f9d2d" },
    surface: { color: "#4f9d2d" },
  },
  {
    id: "dirt",
    name: "Dirt",
    category: "terrain",
    thumbnail: { color: "#9a6430" },
    surface: { color: "#9a6430" },
  },
  {
    id: "snow",
    name: "Snow",
    category: "terrain",
    thumbnail: { color: "#e8f2f8" },
    surface: { color: "#e8f2f8" },
  },
  {
    id: "sand",
    name: "Sand",
    category: "terrain",
    thumbnail: { color: "#d9b96e" },
    surface: { color: "#d9b96e" },
  },
  {
    id: "stone",
    name: "Stone",
    category: "terrain",
    thumbnail: { color: "#7b8490" },
    surface: { color: "#7b8490" },
  },
];

export function getTerrainAsset(id: TerrainAssetId) {
  return TERRAIN_LIBRARY.find((asset) => asset.id === id);
}
