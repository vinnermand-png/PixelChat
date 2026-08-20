import type { AssetDefinition, AssetId } from "./types";

const PIXELCHAT_ASSET_ROOT = "/assets/pixelchat";
const TEST_TREE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAwCAYAAABwrHhvAAABCUlEQVR4nGNgGAUjHTCSqiF/n/1/bOITnQ6SbBYDAwMDC7EK9WuNsFqMS/5i8zmiHMRErANoBQbcAURFgf9c3f8MDL/xqlFQ+M3w4AEryQ4Y/CEASVwI3z+4/w6rOgVFIQYFRWQRSKIklBiJigIFRSEMMVwOIRUMeBQMXwcoKPxmUFD4Dc1BuAHWNECo1CMVwMzDliCJLooJAXITJU4HKCgQznqwggdZLalg+CbCUQeMOoBYQJVygJx2AEEHUGIoKWDAo2DUAQPuAIKdB0qrZkJtwsEfArhAlr0CSshMO/iALLMGPARGHTDqgFEHkJx3wwwk8ZaMqy48J8nMAQ+BUQeMOmDAHTDgAACPmkBMtKS70wAAAABJRU5ErkJggg==";

export const ASSET_LIBRARY: readonly AssetDefinition[] = [
  {
    id: "testTree",
    name: "Test Tree",
    category: "nature",
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

export { PIXELCHAT_ASSET_ROOT };

export function getAsset(id: AssetId) {
  return ASSET_LIBRARY.find((asset) => asset.id === id);
}

export function getAssetsByCategory(category: AssetDefinition["category"]) {
  return ASSET_LIBRARY.filter((asset) => asset.category === category);
}
