import type { AssetDefinition, AssetId, AssetCategory } from "./types";

const PIXELCHAT_ASSET_ROOT = "/assets/pixelchat";
const TEST_TREE_PNG = `${PIXELCHAT_ASSET_ROOT}/nature/trees/tree-01.png`;

export const ASSET_LIBRARY: readonly AssetDefinition[] = [
  {
    id: "testTree",
    name: "Test Tree",
    category: "trees",
    sprite: {
      src: TEST_TREE_PNG
    },
    render: {
      bounds: { width: 32, height: 48 },
      anchor: { x: 0.5, y: 1 }
    },
    collision: {
      enabled: true,
      footprint: [{ gx: 0, gy: 0 }]
    }
  },
  {
    id: "testLargeTree",
    name: "Test Large Tree",
    category: "trees",
    sprite: {
      src: TEST_TREE_PNG
    },
    render: {
      bounds: { width: 32, height: 48 },
      anchor: { x: 0.5, y: 1 }
    },
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

export { PIXELCHAT_ASSET_ROOT };

export function getAsset(id: AssetId) {
  return ASSET_LIBRARY.find((asset) => asset.id === id);
}

export function getAssetsByCategory(category: AssetCategory) {
  return ASSET_LIBRARY.filter((asset) => asset.category === category);
}
