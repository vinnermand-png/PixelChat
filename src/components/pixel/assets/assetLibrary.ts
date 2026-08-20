import type { AssetDefinition, AssetId } from "./types";

export const ASSET_LIBRARY: readonly AssetDefinition[] = [
  {
    id: "testTree",
    name: "Test Tree",
    category: "nature",
    collision: {
      enabled: true,
      footprint: [{ gx: 0, gy: 0 }]
    }
  },
  {
    id: "testLargeTree",
    name: "Test Large Tree",
    category: "nature",
    collision: {
      enabled: true,
      footprint: [
        { gx: 0, gy: 0 },
        { gx: 1, gy: 0 },
        { gx: 0, gy: 1 },
        { gx: 1, gy: 1 }
      ]
    }
  }
];

export function getAsset(id: AssetId) {
  return ASSET_LIBRARY.find((asset) => asset.id === id);
}

export function getAssetsByCategory(category: AssetDefinition["category"]) {
  return ASSET_LIBRARY.filter((asset) => asset.category === category);
}
