export type Cell = { gx: number; gy: number };

export type AssetCategory = "nature" | "decoration";
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
