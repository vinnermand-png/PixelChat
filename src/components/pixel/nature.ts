import { GRID, iso, TH, TW, VIEW_H, VIEW_W } from "./world";
import { NATURE_ASSETS, type NatureAssetKey } from "./naturePack";

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
  const b = iso(GRID - 1, 0);
  const c = iso(GRID - 1, GRID - 1);
  const d = iso(0, GRID - 1);
  return { a, b, c, d };
}

function drawGrassBase(ctx: CanvasRenderingContext2D) {
  const { a, b, c, d } = platformBounds();
  fillPixelPolygon(
    ctx,
    [[a.x, a.y], [b.x + TW / 2, b.y + TH / 2], [c.x, c.y + TH], [d.x - TW / 2, d.y + TH / 2]],
    N.grassBase,
  );
}

function drawGroundVariation(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (let i = 0; i < 150; i++) {
    const gx = hash(i * 1.7, 4.2) * (GRID - 1);
    const gy = hash(i * 2.3, 9.1) * (GRID - 1);
    const p = iso(gx, gy);
    const r = hash(i + 20, i + 91);
    ctx.fillStyle = r > 0.78 ? N.grassLight : r > 0.42 ? N.grassMid : N.grassDark;
    ctx.globalAlpha = r > 0.78 ? 0.34 : 0.20;
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
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "#0b111c";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawGrassBase(ctx);
  drawGroundVariation(ctx);

  const placements: Placement[] = [
    // FOREST EDGE
    P("treeLarge01", 1.0, 4.8),
    P("treeMedium02", 3.6, 1.8),
    P("bush01", 0.8, 6.6),
    P("bush03", 2.5, 5.8),
    P("fern01", 1.6, 6.3),
    P("log01", 1.5, 7.6),
    P("rock02", 2.8, 6.0),
    P("pebble01", 3.4, 5.4),
    P("grassTuft01", 0.6, 7.8),

    // OPEN MEADOW
    P("groundPatch01", 5.4, 7.2),
    P("grassMicro01", 5.2, 5.4),
    P("grassMicro02", 6.2, 6.0),
    P("grassTuft02", 7.0, 5.8),
    P("tinyFlower01", 6.6, 7.0),
    P("wildFlower02", 7.8, 7.3),
    P("mushroom01", 5.4, 8.0),
    P("smallPlant02", 7.0, 8.3),
    P("rock01", 8.0, 7.7),
    P("pebble02", 8.5, 6.9),

    // POND AREA
    P("waterPiece01", 10.8, 3.8),
    P("waterPiece02", 11.7, 4.8),
    P("pondEdgeCluster01", 9.8, 4.2),
    P("shorelineDetail01", 10.0, 5.5),
    P("shorelineDetail02", 12.1, 5.8),
    P("reed01", 9.5, 3.8),
    P("waterPlant01", 12.4, 4.1),
    P("rockCluster01", 13.0, 5.2),
    P("tinyFlower02", 12.5, 6.5),

    // SECONDARY NATURE POCKET
    P("bush02", 10.2, 7.1),
    P("treeSmall01", 12.4, 7.4),
    P("fern02", 11.1, 7.4),
    P("mushroomCluster01", 9.0, 8.0),
    P("fallenWoodCluster01", 10.8, 8.1),
    P("rockCluster02", 12.2, 8.0),
  ];

  placements.sort((a, b) => a.depth - b.depth);
  placements.forEach((p) => drawAsset(ctx, p.key, p.gx, p.gy));
}
