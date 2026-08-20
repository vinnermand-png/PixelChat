import type { TerrainVisualState } from "./terrainNeighbors";

export type TerrainAssetId = "grass" | "dirt" | "snow" | "sand" | "stone";

export type TerrainVisualSprite = {
  src: string;
};

export type TerrainVisualThumbnail = {
  src: string;
};

export type TerrainVisualStateDefinition = {
  sprite?: TerrainVisualSprite;
};

export type TerrainVisual = {
  topColor: string;
  /**
   * Temporary runtime compatibility with the existing STEP 25 GameMaker renderer.
   * The renderer currently reads visual.surfaceColor; topColor remains the central
   * STEP 26 visual field and both values are kept identical until the renderer is
   * migrated in its own isolated change.
   */
  surfaceColor: string;
  sprite?: TerrainVisualSprite;
  thumbnail?: TerrainVisualThumbnail;
  states: Record<TerrainVisualState, TerrainVisualStateDefinition>;
};

export type TerrainAssetDefinition = {
  id: TerrainAssetId;
  name: string;
  category: "terrain";
  thumbnail: {
    color: string;
  };
  visual: TerrainVisual;
};

const TERRAIN_VISUAL_STATES: Record<TerrainVisualState, TerrainVisualStateDefinition> = {
  isolated: {},
  center: {},
  "north-edge": {},
  "south-edge": {},
  "east-edge": {},
  "west-edge": {},
  "north-west-corner": {},
  "north-east-corner": {},
  "south-west-corner": {},
  "south-east-corner": {},
};

function createTerrainVisual(topColor: string): TerrainVisual {
  return {
    topColor,
    surfaceColor: topColor,
    sprite: undefined,
    thumbnail: undefined,
    states: { ...TERRAIN_VISUAL_STATES },
  };
}

export const TERRAIN_LIBRARY: TerrainAssetDefinition[] = [
  {
    id: "grass",
    name: "Grass",
    category: "terrain",
    thumbnail: { color: "#4f9d2d" },
    visual: createTerrainVisual("#4f9d2d"),
  },
  {
    id: "dirt",
    name: "Dirt",
    category: "terrain",
    thumbnail: { color: "#8a5a32" },
    visual: createTerrainVisual("#8a5a32"),
  },
  {
    id: "snow",
    name: "Snow",
    category: "terrain",
    thumbnail: { color: "#e8f3ff" },
    visual: createTerrainVisual("#f3f6f8"),
  },
  {
    id: "sand",
    name: "Sand",
    category: "terrain",
    thumbnail: { color: "#d9b96e" },
    visual: createTerrainVisual("#d8b36a"),
  },
  {
    id: "stone",
    name: "Stone",
    category: "terrain",
    thumbnail: { color: "#7b8794" },
    visual: createTerrainVisual("#7c858d"),
  },
];

export type ResolvedTerrainVisualDefinition = TerrainVisualStateDefinition & {
  fallbackColor: string;
  sprite?: TerrainVisualSprite;
  thumbnail?: TerrainVisualThumbnail;
};

/**
 * Central terrain visual resolver. Future renderers resolve all state-specific
 * sprite, thumbnail and fallback data through this function.
 */
export function getTerrainVisualDefinition(
  terrainId: TerrainAssetId | undefined,
  visualState: TerrainVisualState,
): ResolvedTerrainVisualDefinition | undefined {
  if (terrainId === undefined) return undefined;

  const terrain = getTerrainAsset(terrainId);
  if (terrain === undefined) return undefined;

  const stateVisual = terrain.visual.states[visualState];

  return {
    fallbackColor: terrain.visual.topColor,
    sprite: stateVisual.sprite ?? terrain.visual.sprite,
    thumbnail: terrain.visual.thumbnail,
  };
}

export function getTerrainAsset(id: TerrainAssetId) {
  return TERRAIN_LIBRARY.find((asset) => asset.id === id);
}
