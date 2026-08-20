import type { TerrainAssetId } from "./terrainAssetLibrary";
import type { TerrainVisualState } from "./terrainNeighbors";

/**
 * Central registry for future terrain PNG sprite paths.
 *
 * STEP 35 keeps both registry keys on the existing central TerrainAssetId and
 * TerrainVisualState unions, so invalid terrain IDs or visual states cannot be
 * added to the registry without a TypeScript error.
 */
export type TerrainSpriteRegistry = Partial<
  Record<TerrainAssetId, Partial<Record<TerrainVisualState, string>>>
>;

export const TERRAIN_SPRITE_REGISTRY = {
  grass: {
    center: "/assets/pixelchat/terrain/grass/center.png",
  },
} satisfies TerrainSpriteRegistry;

/**
 * Returns the registered sprite path for a valid terrain ID + visual state.
 * Returns undefined when that valid combination has no registered PNG.
 */
export function getTerrainSpritePath(
  terrainId: TerrainAssetId,
  visualState: TerrainVisualState,
): string | undefined {
  return TERRAIN_SPRITE_REGISTRY[terrainId]?.[visualState];
}
