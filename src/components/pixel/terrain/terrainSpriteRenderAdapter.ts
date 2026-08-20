import {
  getTerrainVisualDefinition,
  type TerrainAssetId,
} from "./terrainAssetLibrary";
import type { TerrainVisualState } from "./terrainNeighbors";
import { getTerrainSpritePath } from "./terrainSpriteRegistry";

/**
 * Render-ready terrain visual data resolved from the existing terrain visual
 * definition and central sprite registry. This adapter contains no canvas or
 * image-loading logic.
 */
export type TerrainRenderVisual = {
  terrainId: TerrainAssetId;
  visualState: TerrainVisualState;
  spritePath: string | undefined;
  fallbackColor: string;
};

/**
 * Resolves all renderer-facing terrain visual decisions through one central
 * adapter. Future renderers can choose sprite rendering when spritePath exists,
 * otherwise they can keep the existing fallback color rendering.
 */
export function resolveTerrainRenderVisual(
  terrainId: TerrainAssetId,
  visualState: TerrainVisualState,
): TerrainRenderVisual {
  const visualDefinition = getTerrainVisualDefinition(terrainId, visualState);

  if (visualDefinition === undefined) {
    throw new Error(
      `Unable to resolve terrain visual definition for ${terrainId}:${visualState}`,
    );
  }

  return {
    terrainId,
    visualState,
    spritePath: getTerrainSpritePath(terrainId, visualState),
    fallbackColor: visualDefinition.fallbackColor,
  };
}
