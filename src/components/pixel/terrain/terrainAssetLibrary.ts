export type TerrainAssetId = "grass" | "dirt" | "snow" | "sand" | "stone";

type TerrainVisualSprite = {
  src: string;
};

type TerrainVisualThumbnail = {
  src: string;
};

type TerrainVisual = {
  topColor: string;
  /**
   * Temporary runtime compatibility with the existing STEP 25 GameMaker renderer.
   * The renderer currently reads visual.surfaceColor; topColor remains the central
   * STEP 26 visual field and both values are kept identical until the renderer is
   * migrated in its own isolated change.
   */
  surfaceColor: string;
  sprite?: TerrainVisualSprite;
  thumbnail?: TerrainVisualThumbnail;
};

export type TerrainAssetDefinition = {
  id: TerrainAssetId;
  name: string;
  category: "terrain";
  thumbnail: {
    color: string;
  };
  visual: TerrainVisual;
};

export const TERRAIN_LIBRARY: TerrainAssetDefinition[] = [
  {
    id: "grass",
    name: "Grass",
    category: "terrain",
    thumbnail: { color: "#4f9d2d" },
    visual: { topColor: "#4f9d2d", surfaceColor: "#4f9d2d" },
  },
  {
    id: "dirt",
    name: "Dirt",
    category: "terrain",
    thumbnail: { color: "#8a5a32" },
    visual: { topColor: "#8a5a32", surfaceColor: "#8a5a32" },
  },
  {
    id: "snow",
    name: "Snow",
    category: "terrain",
    thumbnail: { color: "#e8f3ff" },
    visual: { topColor: "#f3f6f8", surfaceColor: "#f3f6f8" },
  },
  {
    id: "sand",
    name: "Sand",
    category: "terrain",
    thumbnail: { color: "#d9b96e" },
    visual: { topColor: "#d8b36a", surfaceColor: "#d8b36a" },
  },
  {
    id: "stone",
    name: "Stone",
    category: "terrain",
    thumbnail: { color: "#7b8794" },
    visual: { topColor: "#7c858d", surfaceColor: "#7c858d" },
  },
];

export function getTerrainAsset(id: TerrainAssetId) {
  return TERRAIN_LIBRARY.find((asset) => asset.id === id);
}
