export type Cell = { gx: number; gy: number };

export type AssetCategory = "nature" | "decoration";
export type AssetId = string;

export type CollisionDefinition = {
  enabled: boolean;
  footprint: Cell[];
};

export type AssetDefinition = {
  id: AssetId;
  name: string;
  category: AssetCategory;
  collision: CollisionDefinition;
};
