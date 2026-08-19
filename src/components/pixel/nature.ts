import { TH, TW } from "./world";
import { NATURE_ASSETS } from "./naturePack";

// Nature Test foundation: one thing at a time. v4.1 is grass-only.
export const NATURE_VIEW_W = 640;
export const NATURE_VIEW_H = 400;
export const NATURE_GRID = 24;
const NATURE_OX = NATURE_VIEW_W / 2;
const NATURE_OY = 54;

const N = {
  grassBase: "#4f9d2d",
  grassMid: "#58a834",
  grassLight: "#72b83e",
  grassDark: "#3d8627",
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1) {
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function iso(gx: number, gy: number) {
  return {
    x: NATURE_OX + (gx - gy) * (TW / 2),
    y: NATURE_OY + (gx + gy) * (TH / 2),
  };
}

function fillPixelPolygon(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0]![0]), Math.round(points[0]![1]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(Math.round(points[i]![0]), Math.round(points[i]![1]));
  ctx.closePath();
  ctx.fill();
}

function platformBounds() {
  const a = iso(0, 0);
  const b = iso(NATURE_GRID - 1, 0);
  const c = iso(NATURE_GRID - 1, NATURE_GRID - 1);
  const d = iso(0, NATURE_GRID - 1);
  return { a, b, c, d };
}

function drawGrassBase(ctx: CanvasRenderingContext2D) {
  const { a, b, c, d } = platformBounds();
  fillPixelPolygon(
    ctx,
    [
      [a.x, a.y],
      [b.x + TW / 2, b.y + TH / 2],
      [c.x, c.y + TH],
      [d.x - TW / 2, d.y + TH / 2],
    ],
    N.grassBase,
  );
}

function drawGrassVariation(ctx: CanvasRenderingContext2D) {
  // Subtle painted variation underneath the grass sprites.
  for (let i = 0; i < 180; i++) {
    const gx = 0.35 + hash(i * 1.7, 4.2) * (NATURE_GRID - 1.7);
    const gy = 0.35 + hash(i * 2.3, 9.1) * (NATURE_GRID - 1.7);
    const p = iso(gx, gy);
    const r = hash(i + 20, i + 91);
    ctx.fillStyle = r > 0.78 ? N.grassLight : r > 0.42 ? N.grassMid : N.grassDark;
    ctx.globalAlpha = r > 0.78 ? 0.20 : 0.12;
    px(ctx, p.x + Math.round((r - 0.5) * 8), p.y + 5 + Math.round(hash(i + 33, i + 55) * 6), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawAsset(ctx: CanvasRenderingContext2D, key: "grassMicro01" | "grassMicro02", gx: number, gy: number) {
  const meta = NATURE_ASSETS[key];
  let img = grassImageCache.get(key);
  if (!img) {
    img = new Image();
    img.decoding = "sync";
    img.src = meta.path;
    grassImageCache.set(key, img);
  }
  if (!img.complete || img.naturalWidth === 0) return;
  const p = iso(gx, gy);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(p.x - meta.width / 2), Math.round(p.y + TH / 2 - meta.height + 2), meta.width, meta.height);
  ctx.restore();
}

const grassImageCache = new Map<"grassMicro01" | "grassMicro02", HTMLImageElement>();

export function drawNatureTest(ctx: CanvasRenderingContext2D, _t = 0) {
  ctx.clearRect(0, 0, NATURE_VIEW_W, NATURE_VIEW_H);
  ctx.fillStyle = "#0b111c";
  ctx.fillRect(0, 0, NATURE_VIEW_W, NATURE_VIEW_H);

  // Step 1: establish the full grass platform only.
  drawGrassBase(ctx);
  drawGrassVariation(ctx);

  // Step 2: spread only the two micro-grass assets across the entire platform.
  // Distribution is deterministic, subtle, and intentionally not perfectly uniform.
  for (let i = 0; i < 185; i++) {
    const gx = 0.7 + hash(i * 2.13, 3.7) * (NATURE_GRID - 1.35);
    const gy = 0.7 + hash(i * 1.71, 8.4) * (NATURE_GRID - 1.35);
    const key = i % 2 === 0 ? "grassMicro01" : "grassMicro02";
    drawAsset(ctx, key, gx, gy);
  }
}
