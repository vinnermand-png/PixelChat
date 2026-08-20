import type { TerrainAssetId } from "./terrainAssetLibrary";
import type { TerrainVisualState } from "./terrainNeighbors";

/**
 * Central registry for future terrain PNG sprite paths.
 *
 * Registry keys use the existing central TerrainAssetId and TerrainVisualState
 * unions, so invalid terrain IDs or visual states cannot be added without a
 * TypeScript error.
 */
export type TerrainSpriteRegistry = Partial<
  Record<TerrainAssetId, Partial<Record<TerrainVisualState, string>>>
>;

/**
 * Complete central list of the currently supported terrain visual states.
 * Coverage always reports every valid state, whether or not a PNG is registered.
 */
export const TERRAIN_VISUAL_STATES = [
  "isolated",
  "center",
  "north-edge",
  "south-edge",
  "east-edge",
  "west-edge",
  "north-west-corner",
  "north-east-corner",
  "south-west-corner",
  "south-east-corner",
] as const satisfies readonly TerrainVisualState[];

export type TerrainSpriteCoverage = Record<TerrainVisualState, boolean>;

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

/**
 * Returns complete sprite coverage for one valid terrain type.
 * Every central TerrainVisualState is represented. true means a PNG path is
 * registered; false means the state will remain available for fallback rendering.
 */
export function getTerrainSpriteCoverage(
  terrainId: TerrainAssetId,
): TerrainSpriteCoverage {
  const registeredStates = TERRAIN_SPRITE_REGISTRY[terrainId];

  return TERRAIN_VISUAL_STATES.reduce<TerrainSpriteCoverage>((coverage, state) => {
    coverage[state] = registeredStates?.[state] !== undefined;
    return coverage;
  }, {} as TerrainSpriteCoverage);
}
