export type Cell = { gx: number; gy: number };

export const ASSET_CATEGORIES = ["trees", "bushes", "rocks", "decorations", "buildings", "characters"] as const;
export type AssetCategory = typeof ASSET_CATEGORIES[number];
export type AssetId = string;

export type CollisionDefinition = {
  enabled: boolean;
  footprint: Cell[];
};

export type AssetSpriteDefinition = {
  src: string;
};

export type AssetRenderBounds = {
  width: number;
  height: number;
};

export type AssetRenderAnchor = {
  x: number;
  y: number;
};

export type AssetRenderSettings = {
  bounds: AssetRenderBounds;
  anchor: AssetRenderAnchor;
};

export type AssetDefinition = {
  id: AssetId;
  name: string;
  category: AssetCategory;
  sprite?: AssetSpriteDefinition;
  render?: AssetRenderSettings;
  collision: CollisionDefinition;
};
