export type TerrainAssetId = "grass" | "dirt" | "snow" | "sand" | "stone";

export type TerrainAssetDefinition = {
  id: TerrainAssetId;
  name: string;
  category: "terrain";
  thumbnail: {
    color: string;
  };
  visual: {
    surfaceColor: string;
  };
};

export const TERRAIN_LIBRARY: TerrainAssetDefinition[] = [
  {
    id: "grass",
    name: "Grass",
    category: "terrain",
    thumbnail: { color: "#4f9d2d" },
    visual: { surfaceColor: "#4f9d2d" },
  },
  {
    id: "dirt",
    name: "Dirt",
    category: "terrain",
    thumbnail: { color: "#8a5a32" },
    visual: { surfaceColor: "#8a5a32" },
  },
  {
    id: "snow",
    name: "Snow",
    category: "terrain",
    thumbnail: { color: "#e8f3ff" },
    visual: { surfaceColor: "#f3f6f8" },
  },
  {
    id: "sand",
    name: "Sand",
    category: "terrain",
    thumbnail: { color: "#d9b96e" },
    visual: { surfaceColor: "#d8b36a" },
  },
  {
    id: "stone",
    name: "Stone",
    category: "terrain",
    thumbnail: { color: "#7b8794" },
    visual: { surfaceColor: "#7c858d" },
  },
];

export function getTerrainAsset(id: TerrainAssetId) {
  return TERRAIN_LIBRARY.find((asset) => asset.id === id);
}
