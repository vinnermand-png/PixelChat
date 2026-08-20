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
  const render = asset.render;
  if (!sprite || !render) return false;

  const image = getAssetSpriteImage(asset);
  if (!image || !image.complete || !image.naturalWidth) return false;

  const p = iso(gx, gy);
  const groundX = p.x;
  const groundY = p.y + TH / 2;
  const { width, height } = render.bounds;
  const { x: anchorX, y: anchorY } = render.anchor;
  const x = Math.round(groundX - width * anchorX);
  const y = Math.round(groundY - height * anchorY);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
  return true;
}
