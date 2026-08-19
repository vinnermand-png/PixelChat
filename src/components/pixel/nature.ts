import { TH, TW } from "./world";
import { NATURE_ASSETS, type NatureAssetKey } from "./naturePack";

// Nature Test has its own larger presentation world so it can evolve without
// changing the gameplay world's smaller Torvet grid.
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

function drawGroundVariation(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (let i = 320; i >= 0; i--) {
    const gx = 0.25 + hash(i * 1.7, 4.2) * (NATURE_GRID - 1.5);
    const gy = 0.25 + hash(i * 2.3, 9.1) * (NATURE_GRID - 1.5);
    const p = iso(gx, gy);
    const r = hash(i + 20, i + 91);
    ctx.fillStyle = r > 0.78 ? N.grassLight : r > 0.42 ? N.grassMid : N.grassDark;
    ctx.globalAlpha = r > 0.78 ? 0.30 : 0.18;
    px(ctx, p.x + Math.round((r - 0.5) * 10), p.y + 5 + Math.round(hash(i + 33, i + 55) * 7), 1, 1);
  }
  ctx.restore();
}

const imageCache = new Map<NatureAssetKey, HTMLImageElement>();
function getAsset(key: NatureAssetKey) {
  if (typeof window === "undefined") return null;
  const meta = NATURE_ASSETS[key];
  let img = imageCache.get(key);
  if (!img) {
    img = new Image();
    img.decoding = "sync";
    img.src = meta.path;
    imageCache.set(key, img);
  }
  return img;
}

function drawAsset(ctx: CanvasRenderingContext2D, key: NatureAssetKey, gx: number, gy: number) {
  const img = getAsset(key);
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const { width: w, height: h } = NATURE_ASSETS[key];
  const p = iso(gx, gy);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y + TH / 2 - h + 3), w, h);
  ctx.restore();
}

type Placement = { key: NatureAssetKey; gx: number; gy: number; depth: number };
const P = (key: NatureAssetKey, gx: number, gy: number): Placement => ({ key, gx, gy, depth: gx + gy });

export function drawNatureTest(ctx: CanvasRenderingContext2D, _t = 0) {
  ctx.clearRect(0, 0, NATURE_VIEW_W, NATURE_VIEW_H);
  ctx.fillStyle = "#0b111c";
  ctx.fillRect(0, 0, NATURE_VIEW_W, NATURE_VIEW_H);

  drawGrassBase(ctx);
  drawGroundVariation(ctx);

  const placements: Placement[] = [
    // NORTH-WEST FOREST EDGE: large anchors pushed outward to create depth.
    P("treeLarge01", 2.0, 5.0),
    P("treeMedium02", 6.0, 2.0),
    P("treeSmall01", 1.3, 8.4),
    P("bush01", 1.4, 7.2),
    P("bush03", 3.7, 6.4),
    P("fern01", 2.8, 7.2),
    P("log01", 2.5, 9.0),
    P("rock02", 4.4, 7.4),
    P("pebble01", 5.2, 8.1),
    P("fallenWoodCluster01", 4.0, 9.0),

    // NORTH CENTER: breathing room + light meadow details.
    P("treeLarge02", 11.6, 1.8),
    P("bush02", 9.6, 4.0),
    P("fern02", 10.0, 4.8),
    P("wildFlower01", 8.4, 6.1),
    P("wildFlower03", 12.7, 5.6),
    P("grassTuft01", 9.0, 6.4),
    P("grassMicro01", 10.3, 6.2),
    P("tinyFlower01", 11.8, 7.0),

    // CENTRAL MEADOW: intentionally sparse enough for future player movement.
    P("groundPatch01", 8.0, 9.2),
    P("groundPatch02", 11.1, 9.6),
    P("groundDetail01", 7.1, 10.4),
    P("groundDetail02", 12.4, 10.8),
    P("grassTuft02", 8.8, 11.0),
    P("grassMicro02", 10.2, 10.6),
    P("tinyFlower02", 11.4, 11.6),
    P("mushroom01", 7.1, 11.8),
    P("smallPlant02", 13.0, 9.3),
    P("rock01", 13.8, 11.0),
    P("pebble02", 14.4, 9.9),

    // EAST POND: compact landmark with a clear meadow buffer around it.
    P("waterPiece01", 17.3, 4.8),
    P("waterPiece02", 18.5, 5.7),
    P("pondEdgeCluster01", 16.1, 5.0),
    P("shorelineDetail01", 16.2, 6.4),
    P("shorelineDetail02", 19.6, 6.7),
    P("reed01", 15.8, 4.3),
    P("waterPlant01", 19.8, 5.0),
    P("rockCluster01", 20.3, 6.0),
    P("bush03", 20.0, 7.8),
    P("tinyFlower02", 18.9, 8.1),

    // SOUTH-EAST FOREST POCKET.
    P("treeSmall02", 19.4, 11.6),
    P("treeMedium01", 21.2, 9.6),
    P("bush01", 18.7, 10.2),
    P("fern02", 19.6, 9.2),
    P("mushroomCluster01", 16.0, 11.8),
    P("fallenWoodCluster01", 17.7, 12.6),
    P("rockCluster02", 20.8, 12.2),
    P("branch02", 15.2, 13.0),

    // SOUTH-WEST LOW-DENSITY EDGE.
    P("treeSmall02", 4.0, 16.8),
    P("bush02", 5.8, 15.6),
    P("smallPlant01", 7.4, 15.1),
    P("wildFlower02", 8.2, 16.3),
    P("grassTuft01", 9.4, 15.7),
    P("rock03", 6.8, 17.2),
    P("branch01", 8.4, 17.8),
  ];

  placements.sort((a, b) => a.depth - b.depth);
  placements.forEach((p) => drawAsset(ctx, p.key, p.gx, p.gy));

  // The micro-grass layer is intentionally dense but subtle. It makes the enlarged
  // platform read as a meadow rather than an empty green canvas.
  const skip = (gx: number, gy: number) => {
    // Keep a broad central movement corridor and the pond itself readable.
    if (gx > 6 && gx < 16 && gy > 7 && gy < 14) return true;
    if (gx > 15 && gx < 21 && gy > 3 && gy < 9) return true;
    return false;
  };

  for (let i = 0; i < 110; i++) {
    const gx = 0.8 + hash(i * 2.1, 13.4) * 21.3;
    const gy = 0.8 + hash(i * 1.4, 18.2) * 21.0;
    if (skip(gx, gy)) continue;
    const variants: NatureAssetKey[] = ["grassMicro01", "grassMicro02", "groundDetail01", "groundDetail02"];
    drawAsset(ctx, variants[i % variants.length]!, gx, gy);
  }
}
