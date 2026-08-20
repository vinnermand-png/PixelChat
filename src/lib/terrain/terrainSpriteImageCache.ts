type TerrainSpriteCacheEntry = {
  image: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
};

const imageCache = new Map<string, TerrainSpriteCacheEntry>();

/**
 * Returns the single cached Image instance for a terrain sprite path.
 * The API is intentionally synchronous so callers can immediately decide
 * whether to draw the loaded image or use their existing fallback renderer.
 */
export function getTerrainSpriteImage(
  spritePath: string | undefined,
): HTMLImageElement | undefined {
  if (!spritePath) return undefined;

  const cached = imageCache.get(spritePath);
  if (cached) return cached.image;

  const image = new Image();
  const entry: TerrainSpriteCacheEntry = {
    image,
    loaded: false,
    failed: false,
  };

  image.addEventListener(
    "load",
    () => {
      entry.loaded = true;
      entry.failed = false;
    },
    { once: true },
  );

  image.addEventListener(
    "error",
    () => {
      entry.loaded = false;
      entry.failed = true;
    },
    { once: true },
  );

  image.src = spritePath;
  imageCache.set(spritePath, entry);

  return image;
}

/**
 * Returns whether a cached terrain sprite has finished loading successfully.
 * This is optional helper state for future renderers; it does not perform
 * loading or rendering itself.
 */
export function isTerrainSpriteLoaded(spritePath: string | undefined): boolean {
  if (!spritePath) return false;
  return imageCache.get(spritePath)?.loaded ?? false;
}

/**
 * Returns whether a cached terrain sprite failed to load.
 * A failed entry stays cached so repeated lookups do not create duplicate
 * Image instances or repeatedly start the same failing request.
 */
export function hasTerrainSpriteLoadFailed(spritePath: string | undefined): boolean {
  if (!spritePath) return false;
  return imageCache.get(spritePath)?.failed ?? false;
}
