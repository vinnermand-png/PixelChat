import { TH, iso } from "@/components/pixel/world";
import type { AssetDefinition } from "./types";

const imageCache = new Map<string, HTMLImageElement>();

export function getAssetSpriteImage(asset: AssetDefinition) {
  const src = asset.sprite?.src;
  if (!src) return null;
  let image = imageCache.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    imageCache.set(src, image);
  }
  return image;
}

export function drawAssetSprite(ctx: CanvasRenderingContext2D, asset: AssetDefinition, gx: number, gy: number) {
  const sprite = asset.sprite;
  if (!sprite) return false;
  const image = getAssetSpriteImage(asset);
  if (!image || !image.complete || !image.naturalWidth) return false;

  const p = iso(gx, gy);
  const anchorX = sprite.anchorX ?? 0.5;
  const anchorY = sprite.anchorY ?? 1;
  const x = Math.round(p.x - sprite.width * anchorX);
  const y = Math.round(p.y + TH / 2 - sprite.height * anchorY);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, sprite.width, sprite.height);
  ctx.restore();
  return true;
}
