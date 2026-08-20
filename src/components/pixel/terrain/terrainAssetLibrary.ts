export type TerrainAssetId = "grass" | "dirt" | "snow" | "sand" | "stone";

export type TerrainAssetDefinition = {
  id: TerrainAssetId;
  name: string;
  category: "terrain";
  thumbnail: {
    color: string;
  };
  surfaceColor: string;
};

export const TERRAIN_LIBRARY: TerrainAssetDefinition[] = [
  {
    id: "grass",
    name: "Grass",
    category: "terrain",
    thumbnail: { color: "#4f9d2d" },
    surfaceColor: "#4f9d2d",
  },
  {
    id: "dirt",
    name: "Dirt",
    category: "terrain",
    thumbnail: { color: "#8a5a32" },
    surfaceColor: "#8a5a32",
  },
  {
    id: "snow",
    name: "Snow",
    category: "terrain",
    thumbnail: { color: "#e8f3ff" },
    surfaceColor: "#e8f3ff",
  },
  {
    id: "sand",
    name: "Sand",
    category: "terrain",
    thumbnail: { color: "#d9b96e" },
    surfaceColor: "#d9b96e",
  },
  {
    id: "stone",
    name: "Stone",
    category: "terrain",
    thumbnail: { color: "#7b8794" },
    surfaceColor: "#7b8794",
  },
];

export function getTerrainAsset(id: TerrainAssetId) {
  return TERRAIN_LIBRARY.find((asset) => asset.id === id);
}
