import { GRID, iso, TH, TW, VIEW_H, VIEW_W } from "./world";

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
  fillPixelPolygon(ctx, [[a.x, a.y], [b.x + TW / 2, b.y + TH / 2], [c.x, c.y + TH], [d.x - TW / 2, d.y + TH / 2]], N.grassBase);
}

function drawGroundVariation(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (let i = 0; i < 120; i++) {
    const gx = hash(i * 1.7, 4.2) * (GRID - 1);
    const gy = hash(i * 2.3, 9.1) * (GRID - 1);
    const p = iso(gx, gy);
    const r = hash(i + 20, i + 91);
    ctx.fillStyle = r > 0.78 ? N.grassLight : r > 0.42 ? N.grassMid : N.grassDark;
    ctx.globalAlpha = r > 0.78 ? 0.35 : 0.22;
    px(ctx, p.x + Math.round((r - 0.5) * 10), p.y + 5 + Math.round(hash(i + 33, i + 55) * 7), 1, 1);
  }
  ctx.restore();
}

const ASSET_SOURCES = {
  tree1: "/nature-assets/Tree-tree-01.png", tree2: "/nature-assets/Tree-tree-02.png", tree3: "/nature-assets/Tree-tree-03.png", tree4: "/nature-assets/Tree-tree-04.png",
  bush1: "/nature-assets/Bush-bush-01.png", bush2: "/nature-assets/Bush-bush-02.png", bush3: "/nature-assets/Bush-bush-03.png", bush4: "/nature-assets/Bush-bush-04.png",
  flower1: "/nature-assets/Flower-flower-01.png", flower2: "/nature-assets/Flower-flower-02.png", flower3: "/nature-assets/Flower-flower-03.png", flower4: "/nature-assets/Flower-flower-04.png",
  grass1: "/nature-assets/GrassTufts-grass-01.png", grass2: "/nature-assets/GrassTufts-grass-02.png", grass3: "/nature-assets/GrassTufts-grass-03.png", grass4: "/nature-assets/GrassTufts-grass-04.png",
  ground1: "/nature-assets/Ground-decoration-ground-decoration-01.png", ground2: "/nature-assets/Ground-decoration-ground-decoration-02.png", ground3: "/nature-assets/Ground-decoration-ground-decoration-03.png", ground4: "/nature-assets/Ground-decoration-ground-decoration-04.png",
  log1: "/nature-assets/Logs-TreeStumps-FallenWood-log-01.png", log2: "/nature-assets/Logs-TreeStumps-FallenWood-log-02.png", log3: "/nature-assets/Logs-TreeStumps-FallenWood-log-03.png", log4: "/nature-assets/Logs-TreeStumps-FallenWood-log-04.png",
  mushroom1: "/nature-assets/Mushroom-mushroom-01.png", mushroom2: "/nature-assets/Mushroom-mushroom-02.png", mushroom3: "/nature-assets/Mushroom-mushroom-03.png", mushroom4: "/nature-assets/Mushroom-mushroom-04.png",
  plant1: "/nature-assets/Plants-plant-01.png", plant2: "/nature-assets/Plants-plant-02.png", plant3: "/nature-assets/Plants-plant-03.png", plant4: "/nature-assets/Plants-plant-04.png",
  rock1: "/nature-assets/Rock-rocks-01.png", rock2: "/nature-assets/Rock-rocks-02.png", rock3: "/nature-assets/Rock-rocks-03.png", rock4: "/nature-assets/Rock-rocks-04.png",
  water1: "/nature-assets/water-nature-elements-water-01.png", water2: "/nature-assets/water-nature-elements-water-02.png", water3: "/nature-assets/water-nature-elements-water-03.png", water4: "/nature-assets/water-nature-elements-water-04.png",
} as const;

type AssetKey = keyof typeof ASSET_SOURCES;
const ASSET_SIZE: Record<AssetKey, [number, number]> = {
  tree1:[128,128], tree2:[128,128], tree3:[128,128], tree4:[128,128],
  bush1:[64,64], bush2:[64,64], bush3:[64,64], bush4:[64,64],
  flower1:[32,32], flower2:[32,32], flower3:[32,32], flower4:[32,32],
  grass1:[32,32], grass2:[32,32], grass3:[32,32], grass4:[32,32],
  ground1:[32,32], ground2:[32,32], ground3:[32,32], ground4:[32,32],
  log1:[64,64], log2:[64,64], log3:[64,64], log4:[64,64],
  mushroom1:[32,32], mushroom2:[32,32], mushroom3:[32,32], mushroom4:[32,32],
  plant1:[64,64], plant2:[64,64], plant3:[64,64], plant4:[64,64],
  rock1:[64,64], rock2:[64,64], rock3:[64,64], rock4:[64,64],
  water1:[64,64], water2:[64,64], water3:[64,64], water4:[64,64],
};

const imageCache = new Map<AssetKey, HTMLImageElement>();
function getAsset(key: AssetKey) {
  if (typeof window === "undefined") return null;
  let img = imageCache.get(key);
  if (!img) {
    img = new Image();
    img.decoding = "sync";
    img.src = ASSET_SOURCES[key];
    imageCache.set(key, img);
  }
  return img;
}

function drawAsset(ctx: CanvasRenderingContext2D, key: AssetKey, gx: number, gy: number) {
  const img = getAsset(key);
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const [w, h] = ASSET_SIZE[key];
  const p = iso(gx, gy);
  const x = Math.round(p.x - w / 2);
  const y = Math.round(p.y + TH / 2 - h + 3);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

type Placement = { key: AssetKey; gx: number; gy: number; depth: number };
const P = (key: AssetKey, gx: number, gy: number): Placement => ({ key, gx, gy, depth: gx + gy });

export function drawNatureTest(ctx: CanvasRenderingContext2D, _t = 0) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "#0b111c";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawGrassBase(ctx);
  drawGroundVariation(ctx);

  const placements: Placement[] = [
    // FOREST EDGE
    P("tree3", 0.8, 5.2), P("tree2", 4.1, 1.4), P("bush1", 0.7, 7.0), P("bush3", 2.4, 5.7),
    P("plant2", 1.7, 6.5), P("log1", 1.4, 7.8), P("rock2", 2.8, 6.0), P("rock4", 3.4, 5.4), P("grass1", 0.5, 7.8),

    // LAKE V3.3 — overlapping water tiles form one connected landmark instead of a single isolated asset.
    P("water1", 9.2, 2.9), P("water2", 10.4, 3.1), P("water3", 11.4, 3.8),
    P("water4", 9.8, 4.1), P("water1", 10.8, 4.8), P("water2", 11.9, 5.0),

    // NORTH / WEST SHORE
    P("rock4", 8.7, 2.6), P("rock2", 9.4, 2.0), P("grass3", 8.4, 3.3), P("grass4", 9.0, 4.6),
    P("plant1", 8.5, 4.2), P("plant3", 8.9, 5.1), P("bush2", 8.2, 5.3),

    // SOUTH / EAST SHORE
    P("rock1", 12.4, 4.3), P("rock3", 12.8, 5.5), P("rock2", 11.9, 6.0), P("grass2", 12.6, 3.6),
    P("plant4", 12.5, 6.3), P("bush4", 10.7, 7.0), P("flower2", 11.8, 6.6), P("ground3", 12.9, 6.6),

    // Small supporting nature pockets around the lake.
    P("flower1", 8.0, 6.1), P("ground1", 8.7, 6.4), P("mushroom2", 7.7, 6.8), P("grass1", 9.2, 6.8),
  ];

  placements.sort((a, b) => a.depth - b.depth);
  placements.forEach((p) => drawAsset(ctx, p.key, p.gx, p.gy));

  ctx.fillStyle = N.grassLight;
  for (let i = 0; i < 14; i++) {
    const gx = 1.0 + hash(i * 1.9, 9.1) * 11.5;
    const gy = 1.0 + hash(i * 2.1, 12.7) * 11.5;
    const p = iso(gx, gy);
    px(ctx, p.x + Math.round(hash(i + 4, i + 8) * 8 - 4), p.y + 6 + Math.round(hash(i + 12, i + 31) * 5), 1, 1);
  }
}
