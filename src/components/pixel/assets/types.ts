export type Cell = { gx: number; gy: number };

export type AssetCategory = "nature" | "decoration";
export type AssetId = string;

export type CollisionDefinition = {
  enabled: boolean;
  footprint: Cell[];
};

export type AssetSpriteDefinition = {
  src: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

export type AssetDefinition = {
  id: AssetId;
  name: string;
  category: AssetCategory;
  sprite?: AssetSpriteDefinition;
  collision: CollisionDefinition;
};
