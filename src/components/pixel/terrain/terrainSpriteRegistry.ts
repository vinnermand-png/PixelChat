import type { TerrainAssetId } from "./terrainAssetLibrary";
import type { TerrainVisualState } from "./terrainNeighbors";

/**
 * Central registry for future terrain PNG sprite paths.
 *
 * STEP 34 intentionally does not load or render sprites. The registry only
 * resolves a terrainId + visualState pair to an optional sprite path so the
 * future terrain sprite pipeline has a single source of truth.
 */
export type TerrainSpriteRegistry = Partial<
  Record<TerrainAssetId, Partial<Record<TerrainVisualState, string>>>
>;

export const TERRAIN_SPRITE_REGISTRY: TerrainSpriteRegistry = {
  grass: {
    center: "/assets/pixelchat/terrain/grass/center.png",
  },
};

/**
 * Returns the registered sprite path for a terrain visual state.
 * Returns undefined when no PNG sprite is registered, allowing the existing
 * color renderer to remain the fallback until sprite rendering is added.
 */
export function getTerrainSpritePath(
  terrainId: TerrainAssetId,
  visualState: TerrainVisualState,
): string | undefined {
  return TERRAIN_SPRITE_REGISTRY[terrainId]?.[visualState];
}
