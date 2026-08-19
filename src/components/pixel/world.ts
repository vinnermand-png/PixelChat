// Pixel-art isometric world renderer. Fixed internal resolution, nearest-neighbour scaled.

export const VIEW_W = 480;
export const VIEW_H = 300;
export const TW = 32;
export const TH = 16;
export const GRID = 14;
const OX = VIEW_W / 2;
const OY = 46;

// Deterministic pseudo-random helper for tile variation.
// Always returns a value in the range [0, 1).
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export type Vec = { gx: number; gy: number };

export function iso(gx: number, gy: number) {
  return { x: OX + (gx - gy) * (TW / 2), y: OY + (gx + gy) * (TH / 2) };
}

export function unIso(x: number, y: number): Vec {
  const dx = (x - OX) / (TW / 2);
  const dy = (y - OY) / (TH / 2);
  return { gx: (dx + dy) / 2, gy: (dy - dx) / 2 };
}

const C = {
  // Classic, colorful isometric pixel palette for Pixel Chat.
  grassA: "#4f9d2d",
  grassB: "#58a834",
  grassC: "#66b63b",
  grassDark: "#2f6c24",
  grassLight: "#8dca4f",
  dirtA: "#a96e2d",
  dirtB: "#b97a35",
  dirtDark: "#75471f",
  dirtLight: "#c58a49",
  stoneA: "#c0b58c",
  stoneB: "#a3946d",
  stoneDark: "#6f644a",
  trunk: "#6e4024",
  trunkDark: "#3d2618",
  leafDark: "#1d6a2a",
  leafA: "#2f8e32",
  leafB: "#49a83a",
  leafLight: "#79c94a",
  leafHi: "#b5de63",
  flowerPink: "#f17ea8",
  flowerYellow: "#f4d447",
  flowerWhite: "#f6f1cf",
  roofRed: "#b94437",
  roofRedDark: "#7f2a2c",
  wallCream: "#ead7a9",
  wallWarm: "#c99355",
  wallLight: "#f2dfb5",
  wallDark: "#7a4c2d",
  trimBlue: "#5fc2d6",
  window: "#ffe16b",
  water: "#48bfe1",
  waterHi: "#93ecf7",
  shadow: "#2d3b22",
  outline: "#20311d",
  fire1: "#ffd24a",
  fire2: "#ff8c1a",
  fire3: "#e03c14",
  glow: "#ffb94d",
  rock: "#7b816d",
  rockLight: "#a8ad92",
  snowA: "#2a3550",
  snowB: "#243049",
  snowEdge: "#3b4a69",
  snowSpeck: "#5b6d95",
  roofA: "#8fa6c6",
  roofB: "#6d82a0",
  snowCap: "#d7e5f4",
  door: "#59321f",
  win: "#f0c14b",
  logs: "#3a2418",
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1) {
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function tileDiamond(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string, edge = C.grassDark) {
  const { x, y } = iso(gx, gy);
  ctx.fillStyle = color;
  const half = TW / 2;
  for (let row = 0; row < TH; row++) {
    const t = row < TH / 2 ? row : TH - 1 - row;
    const w = (t + 1) * 4;
    px(ctx, x - w / 2, y + row, w, 1);
  }
  ctx.fillStyle = edge;
  px(ctx, x - 2, y, 4, 1);
  px(ctx, x - half + 1, y + TH / 2 - 1, 2, 1);
}

function pathTile(ctx: CanvasRenderingContext2D, gx: number, gy: number, variant = 0) {
  const colors = [C.dirtA, C.dirtB, "#a56a2a"];
  tileDiamond(ctx, gx, gy, colors[variant % colors.length]!, C.dirtDark);
  const p = iso(gx, gy);
  ctx.fillStyle = variant % 2 ? "#c38b49" : "#8f5f2a";
  px(ctx, p.x - 5, p.y + 3, 2, 1);
  px(ctx, p.x + 3, p.y + 7, 1, 1);
  if (variant === 1) px(ctx, p.x - 7, p.y + 8, 1, 1);
}

function grassDetail(ctx: CanvasRenderingContext2D, gx: number, gy: number, seed: number) {
  const p = iso(gx, gy);
  const r = hash(gx + seed * 0.31, gy - seed * 0.17);
  if (r < 0.56) return;
  const x = p.x + Math.round((r * 12) - 6);
  const y = p.y + 5 + Math.round((hash(gy + seed, gx - seed) * 6));
  ctx.fillStyle = r > 0.86 ? C.grassLight : C.grassDark;
  px(ctx, x, y, 1, 2);
  if (r > 0.9) px(ctx, x + 1, y - 1, 1, 1);
}

export function drawGround(ctx: CanvasRenderingContext2D) {
  for (let s = 0; s <= (GRID - 1) * 2; s++) {
    for (let gx = 0; gx < GRID; gx++) {
      const gy = s - gx;
      if (gy < 0 || gy >= GRID) continue;
      tileDiamond(ctx, gx, gy, (gx + gy) % 3 === 0 ? C.snowA : C.snowB, C.snowEdge);
      const h = hash(gx, gy);
      if (h > 0.72) {
        const p = iso(gx, gy);
        ctx.fillStyle = C.snowSpeck;
        px(ctx, p.x + (h * 16 - 8), p.y + 6 + h * 4, 2, 1);
      }
    }
  }
}

export function drawTorvetGround(ctx: CanvasRenderingContext2D) {
  // Torvet is deliberately open and green: one readable north/south path,
  // a compact central plaza, and plenty of breathable grass around it.
  const pathCells = new Set<string>();
  const addPath = (gx: number, gy: number) => pathCells.add(`${gx},${gy}`);

  for (let i = 1; i <= 12; i++) {
    addPath(i, i);
    addPath(i, i + 1);
    if (i > 2 && i < 11) addPath(i + 1, i);
  }

  const plazaCells: Array<[number, number]> = [];
  for (let gx = 4; gx <= 9; gx++) {
    for (let gy = 4; gy <= 9; gy++) {
      const d = Math.hypot(gx - 6.5, gy - 6.5);
      if (d < 2.9) plazaCells.push([gx, gy]);
    }
  }
  for (const [gx, gy] of plazaCells) addPath(gx, gy);

  for (let s = 0; s <= (GRID - 1) * 2; s++) {
    for (let gx = 0; gx < GRID; gx++) {
      const gy = s - gx;
      if (gy < 0 || gy >= GRID) continue;
      const key = `${gx},${gy}`;
      const h = hash(gx, gy);

      if (pathCells.has(key)) {
        pathTile(ctx, gx, gy, Math.floor(h * 3));
        if (h > 0.52) {
          const p = iso(gx, gy);
          ctx.fillStyle = C.dirtLight;
          px(ctx, p.x - 6 + Math.round(h * 6), p.y + 4, 2, 1);
        }
      } else {
        const grass = h > 0.72 ? C.grassC : h > 0.38 ? C.grassB : C.grassA;
        tileDiamond(ctx, gx, gy, grass, C.grassDark);
        grassDetail(ctx, gx, gy, 17 + gx * 3 + gy);
        if (h > 0.82) {
          const p = iso(gx, gy);
          ctx.fillStyle = C.grassLight;
          px(ctx, p.x - 5 + Math.round(h * 7), p.y + 6, 1, 1);
        }
        if (h > 0.92) {
          const p = iso(gx, gy);
          ctx.fillStyle = h > 0.96 ? C.flowerPink : C.flowerWhite;
          px(ctx, p.x + 4, p.y + 7, 1, 1);
          ctx.fillStyle = C.flowerYellow;
          px(ctx, p.x + 5, p.y + 6, 1, 1);
        }
      }
    }
  }

  // A subtle stone ring for the central social area.
  for (const [gx, gy] of plazaCells) {
    const d = Math.hypot(gx - 6.5, gy - 6.5);
    if (d < 2.2 || d > 2.75) continue;
    const p = iso(gx, gy);
    ctx.fillStyle = (gx + gy) % 2 === 0 ? C.stoneA : C.stoneB;
    px(ctx, p.x - 5, p.y + 4, 10, 2);
    ctx.fillStyle = C.stoneDark;
    px(ctx, p.x - 2, p.y + 7, 1, 1);
  }
}

// Dithered warm light around the campfire (checkerboard, no gradient)
export function drawFireLight(ctx: CanvasRenderingContext2D, fire: Vec, t: number) {
  const c = iso(fire.gx, fire.gy);
  const flick = Math.sin(t / 140) > 0 ? 1 : 0;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = C.glow;
  for (let ry = -34; ry < 34; ry++) {
    for (let rx = -70; rx < 70; rx += 2) {
      const d = Math.abs(rx) / 70 + Math.abs(ry) / 30;
      if (d > 1) continue;
      const step = d < 0.45 ? 1 : d < 0.75 ? 2 : 4;
      if (((rx / 2 + ry + flick) | 0) % step !== 0) continue;
      px(ctx, c.x + rx, c.y + ry + 8, 1, 1);
    }
  }
  ctx.restore();
}

export function drawShadow(ctx: CanvasRenderingContext2D, gx: number, gy: number, w = 12) {
  const { x, y } = iso(gx, gy);
  ctx.fillStyle = C.shadow;
  px(ctx, x - w / 2, y + TH / 2 - 1, w, 2);
  px(ctx, x - w / 2 - 2, y + TH / 2, w + 4, 1);
}

export function drawTree(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 13);

  // Small, layered classic pixel tree with a dark outline.
  ctx.fillStyle = C.trunkDark;
  px(ctx, x - 2, base - 12, 5, 12);
  ctx.fillStyle = C.trunk;
  px(ctx, x - 1, base - 11, 3, 11);

  const layers = [
    { top: 9, width: 17, height: 7, fill: C.leafDark, hi: C.leafB },
    { top: 16, width: 14, height: 7, fill: C.leafA, hi: C.leafLight },
    { top: 23, width: 10, height: 6, fill: C.leafB, hi: C.leafHi },
  ];

  for (const layer of layers) {
    for (let row = 0; row < layer.height; row++) {
      const t = row < layer.height / 2 ? row : layer.height - 1 - row;
      const w = Math.max(4, Math.round((layer.width * (t + 3)) / (layer.height + 2)));
      ctx.fillStyle = C.outline;
      px(ctx, x - w / 2 - 1, base - layer.top + row, w + 2, 1);
      ctx.fillStyle = layer.fill;
      px(ctx, x - w / 2, base - layer.top + row, w, 1);
      if (row === 1 || row === 2) {
        ctx.fillStyle = layer.hi;
        px(ctx, x - w / 2 + 1, base - layer.top + row, Math.max(1, Math.floor(w / 3)), 1);
      }
    }
  }
  ctx.fillStyle = C.leafHi;
  px(ctx, x - 1, base - 30, 2, 1);
}

export function drawRock(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 9);
  ctx.fillStyle = C.outline;
  px(ctx, x - 5, base - 4, 10, 4);
  ctx.fillStyle = C.rock;
  px(ctx, x - 4, base - 5, 8, 4);
  px(ctx, x - 2, base - 7, 4, 2);
  ctx.fillStyle = C.rockLight;
  px(ctx, x - 2, base - 6, 3, 1);
}

export function drawOldInn(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 30);

  // Compact landmark: readable at a glance, never dominating the plaza.
  ctx.fillStyle = C.outline;
  px(ctx, x - 15, base - 18, 30, 18);
  ctx.fillStyle = C.wallWarm;
  px(ctx, x - 14, base - 17, 28, 16);
  ctx.fillStyle = C.wallLight;
  px(ctx, x - 13, base - 16, 12, 7);

  ctx.fillStyle = C.outline;
  px(ctx, x - 18, base - 22, 36, 3);
  px(ctx, x - 12, base - 26, 24, 4);
  px(ctx, x - 6, base - 29, 12, 3);
  ctx.fillStyle = C.roofRedDark;
  px(ctx, x - 16, base - 21, 32, 2);
  px(ctx, x - 10, base - 25, 20, 3);
  px(ctx, x - 5, base - 28, 10, 2);
  ctx.fillStyle = C.roofRed;
  px(ctx, x - 13, base - 21, 26, 2);
  px(ctx, x - 8, base - 25, 16, 2);

  ctx.fillStyle = C.door;
  px(ctx, x - 4, base - 12, 8, 12);
  ctx.fillStyle = C.window;
  px(ctx, x - 12, base - 12, 6, 5);
  px(ctx, x + 6, base - 12, 6, 5);
  ctx.fillStyle = C.outline;
  px(ctx, x - 11, base - 11, 1, 4);
  px(ctx, x - 12, base - 9, 6, 1);
  px(ctx, x + 11, base - 11, 1, 4);
  px(ctx, x + 6, base - 9, 6, 1);

  ctx.fillStyle = C.outline;
  px(ctx, x - 10, base - 18, 20, 5);
  ctx.fillStyle = C.trimBlue;
  px(ctx, x - 7, base - 16, 14, 1);
  ctx.fillStyle = C.flowerYellow;
  px(ctx, x - 4, base - 15, 8, 1);
}

export function drawCabin(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 38);
  ctx.fillStyle = C.outline;
  px(ctx, x - 19, base - 20, 38, 20);
  ctx.fillStyle = C.wallWarm;
  px(ctx, x - 18, base - 19, 36, 19);
  ctx.fillStyle = C.wallLight;
  px(ctx, x - 18, base - 19, 18, 19);
  ctx.fillStyle = C.wallDark;
  px(ctx, x - 18, base - 10, 36, 2);
  // Small gabled roof.
  ctx.fillStyle = C.outline;
  px(ctx, x - 22, base - 26, 44, 4);
  px(ctx, x - 16, base - 30, 32, 4);
  px(ctx, x - 10, base - 33, 20, 3);
  ctx.fillStyle = C.roofRedDark;
  px(ctx, x - 20, base - 25, 40, 3);
  px(ctx, x - 14, base - 29, 28, 3);
  px(ctx, x - 8, base - 32, 16, 2);
  ctx.fillStyle = C.roofRed;
  px(ctx, x - 17, base - 25, 34, 2);
  px(ctx, x - 11, base - 29, 22, 2);

  // Door + warm window.
  ctx.fillStyle = C.door;
  px(ctx, x - 4, base - 13, 8, 13);
  ctx.fillStyle = C.window;
  px(ctx, x + 8, base - 15, 6, 6);
  ctx.fillStyle = C.outline;
  px(ctx, x + 10, base - 15, 1, 6);
  px(ctx, x + 8, base - 12, 6, 1);
}

export function drawCampfire(ctx: CanvasRenderingContext2D, gx: number, gy: number, t: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  ctx.fillStyle = C.rock;
  px(ctx, x - 14, base - 4, 28, 5);
  px(ctx, x - 10, base - 6, 20, 3);
  ctx.fillStyle = C.logs;
  px(ctx, x - 10, base - 8, 20, 3);
  px(ctx, x - 3, base - 12, 6, 5);
  const f = Math.floor(t / 110) % 3;
  const heights = ([[10, 16, 12], [12, 20, 10], [8, 18, 14]] as const)[f]!;
  const cols = [C.fire3, C.fire2, C.fire1];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = cols[i]!;
    const h = heights[i]! - i * 2;
    const w = 12 - i * 4;
    for (let r = 0; r < h; r++) {
      const ww = Math.max(2, Math.round((w * (h - r)) / h));
      px(ctx, x - ww / 2, base - 8 - h + r, ww, 1);
    }
  }
  // sparks
  for (let s = 0; s < 3; s++) {
    const p = ((t / 12 + s * 33) % 60) | 0;
    ctx.fillStyle = C.fire1;
    px(ctx, x - 6 + ((s * 5 + f) % 12), base - 20 - p / 2, 1, 1);
  }
}

const SPRITE = [
  "  hhhh  ",
  " hhhhhh ",
  " hssssh ",
  " sesses ",
  " ssssss ",
  "  bbbb  ",
  " bbbbbb ",
  " bbbbbb ",
  " Bbbbbb ",
  "  bb bb ",
  "  pp pp ",
  "  kk kk ",
];

export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  body: string,
  hair: string,
  walking: boolean,
  t: number,
) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 12);
  const bob = walking && Math.floor(t / 130) % 2 === 0 ? -1 : 0;
  const map: Record<string, string> = {
    h: hair,
    s: "#f0c9a4",
    e: "#1b1b28",
    b: body,
    B: "#f0c9a4",
    p: "#28324c",
    k: "#171d2c",
  };
  const S = 2;
  for (let r = 0; r < SPRITE.length; r++) {
    for (let c = 0; c < 8; c++) {
      const ch = SPRITE[r]![c]!;
      if (ch === " ") continue;
      ctx.fillStyle = map[ch]!;
      px(ctx, x - 8 + c * S, base - SPRITE.length * S + r * S + bob, S, S);
    }
  }
}

export type ItemKind = "log" | "berry" | "shard";

const ITEM_COLORS: Record<ItemKind, [string, string]> = {
  log: ["#5a3a1e", "#3a2418"],
  berry: ["#e0574f", "#7d2a26"],
  shard: ["#6fd6e6", "#2f7f96"],
};

export function drawItem(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  kind: ItemKind,
  t: number,
) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  const bob = Math.floor(t / 260) % 2 === 0 ? 0 : -1;
  const [a, b] = ITEM_COLORS[kind];
  drawShadow(ctx, gx, gy, 8);
  if (kind === "log") {
    ctx.fillStyle = b;
    px(ctx, x - 6, base - 5 + bob, 12, 4);
    ctx.fillStyle = a;
    px(ctx, x - 6, base - 6 + bob, 12, 2);
  } else if (kind === "berry") {
    ctx.fillStyle = b;
    px(ctx, x - 3, base - 6 + bob, 6, 5);
    ctx.fillStyle = a;
    px(ctx, x - 2, base - 6 + bob, 3, 3);
  } else {
    ctx.fillStyle = b;
    px(ctx, x - 3, base - 8 + bob, 6, 8);
    ctx.fillStyle = a;
    px(ctx, x - 2, base - 7 + bob, 2, 6);
  }
  ctx.fillStyle = C.snowCap;
  px(ctx, x - 1, base - 10 + bob, 1, 1);
}

// Wooden notice board: a gathering point players can read.
export function drawSign(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 14);
  ctx.fillStyle = C.outline;
  px(ctx, x - 1, base - 16, 3, 16);
  px(ctx, x - 11, base - 27, 22, 12);
  ctx.fillStyle = "#a86b2c";
  px(ctx, x - 10, base - 26, 20, 10);
  ctx.fillStyle = "#f5d76b";
  px(ctx, x - 7, base - 23, 14, 1);
  px(ctx, x - 7, base - 20, 10, 1);
  px(ctx, x - 7, base - 17, 13, 1);
}

export function drawBush(ctx: CanvasRenderingContext2D, gx: number, gy: number, tint = 0) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 13);
  ctx.fillStyle = C.outline;
  px(ctx, x - 9, base - 7, 18, 7);
  const a = tint % 2 ? C.leafA : C.leafB;
  const b = tint % 2 ? C.leafLight : C.leafHi;
  ctx.fillStyle = a;
  px(ctx, x - 8, base - 8, 16, 7);
  px(ctx, x - 5, base - 10, 10, 4);
  ctx.fillStyle = b;
  px(ctx, x - 5, base - 8, 4, 2);
  px(ctx, x + 2, base - 6, 3, 2);
}

export function drawFlower(ctx: CanvasRenderingContext2D, gx: number, gy: number, color: string) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  ctx.fillStyle = C.grassDark;
  px(ctx, x, base - 4, 1, 4);
  ctx.fillStyle = color;
  px(ctx, x - 1, base - 6, 3, 2);
  ctx.fillStyle = C.flowerWhite;
  px(ctx, x, base - 7, 1, 1);
}

export function drawPlazaSurface(ctx: CanvasRenderingContext2D) {
  // A small, tile-by-tile paved ring around the fountain; keep most of the green map visible.
  for (let gy = 4; gy <= 9; gy++) {
    for (let gx = 4; gx <= 9; gx++) {
      const d = Math.abs(gx - 6.5) + Math.abs(gy - 6.5);
      if (d > 3.4) continue;
      const p = iso(gx, gy);
      ctx.fillStyle = (gx + gy) % 2 ? "#d0c59d" : "#b7aa7e";
      px(ctx, p.x - 6, p.y + 4, 12, 2);
      ctx.fillStyle = "#887c59";
      px(ctx, p.x - 3, p.y + 7, 1, 1);
    }
  }
}

export function drawBench(ctx: CanvasRenderingContext2D, gx: number, gy: number, flip = false) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 12);
  ctx.fillStyle = C.outline;
  px(ctx, x - 9, base - 7, 18, 3);
  ctx.fillStyle = "#9a6032";
  px(ctx, x - 8, base - 7, 16, 2);
  ctx.fillStyle = "#c38243";
  px(ctx, x - 7, base - 10, 14, 2);
  ctx.fillStyle = C.outline;
  px(ctx, x - 6, base - 4, 2, 5);
  px(ctx, x + 4, base - 4, 2, 5);
  if (flip) {
    ctx.fillStyle = "#e0a35f";
    px(ctx, x - 5, base - 9, 10, 1);
  }
}

export function drawLamp(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 8);
  ctx.fillStyle = C.outline;
  px(ctx, x - 1, base - 17, 2, 17);
  px(ctx, x - 4, base - 20, 8, 2);
  px(ctx, x - 3, base - 18, 6, 6);
  ctx.fillStyle = C.window;
  px(ctx, x - 2, base - 17, 4, 4);
  ctx.fillStyle = C.flowerWhite;
  px(ctx, x - 1, base - 16, 2, 1);
}

export function drawFountain(ctx: CanvasRenderingContext2D, gx: number, gy: number, t: number) {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 28);

  // Compact iconic fountain sized for the player scale.
  ctx.fillStyle = C.outline;
  px(ctx, x - 15, base - 4, 30, 5);
  ctx.fillStyle = C.stoneA;
  px(ctx, x - 12, base - 8, 24, 5);
  ctx.fillStyle = C.water;
  px(ctx, x - 9, base - 8, 18, 3);
  ctx.fillStyle = C.waterHi;
  px(ctx, x - 5, base - 7, 10, 1);

  ctx.fillStyle = C.outline;
  px(ctx, x - 6, base - 17, 12, 9);
  ctx.fillStyle = C.stoneB;
  px(ctx, x - 5, base - 17, 10, 8);
  ctx.fillStyle = C.stoneA;
  px(ctx, x - 3, base - 19, 6, 2);

  const phase = Math.floor(t / 180) % 3;
  const h = [7, 9, 8][phase]!;
  ctx.fillStyle = C.waterHi;
  for (let r = 0; r < h; r++) {
    const w = r < h / 2 ? 3 : 1;
    px(ctx, x - Math.floor(w / 2), base - 31 + r, w, 1);
  }
  ctx.fillStyle = C.water;
  px(ctx, x - 12, base - 7, 2, 4);
  px(ctx, x + 10, base - 8, 2, 5);
}

export function drawSmallStore(ctx: CanvasRenderingContext2D, gx: number, gy: number, kind: "cafe" | "arcade" | "house") {
  const { x, y } = iso(gx, gy);
  const base = y + TH / 2;
  drawShadow(ctx, gx, gy, 38);

  const wall = kind === "arcade" ? "#7a4b89" : kind === "cafe" ? "#c68d53" : "#d6ae73";
  const wallLight = kind === "arcade" ? "#9d6db0" : kind === "cafe" ? "#e4b66f" : "#efd394";
  const roof = kind === "arcade" ? "#2f4960" : "#7f3f35";
  ctx.fillStyle = C.outline;
  px(ctx, x - 20, base - 20, 40, 20);
  ctx.fillStyle = wall;
  px(ctx, x - 19, base - 19, 38, 19);
  ctx.fillStyle = wallLight;
  px(ctx, x - 18, base - 18, 17, 7);
  // Smaller roof, with visible dark outline.
  ctx.fillStyle = C.outline;
  px(ctx, x - 23, base - 24, 46, 3);
  px(ctx, x - 17, base - 28, 34, 4);
  px(ctx, x - 9, base - 31, 18, 3);
  ctx.fillStyle = roof;
  px(ctx, x - 21, base - 23, 42, 2);
  px(ctx, x - 15, base - 27, 30, 3);
  px(ctx, x - 8, base - 30, 16, 2);

  // Door and windows.
  ctx.fillStyle = C.outline;
  px(ctx, x - 4, base - 13, 8, 13);
  ctx.fillStyle = C.door;
  px(ctx, x - 3, base - 12, 6, 12);
  ctx.fillStyle = kind === "arcade" ? "#63e4f0" : C.window;
  px(ctx, x - 15, base - 14, 7, 6);
  px(ctx, x + 8, base - 14, 7, 6);
  ctx.fillStyle = C.outline;
  px(ctx, x - 13, base - 14, 1, 6);
  px(ctx, x + 10, base - 14, 1, 6);

  // Small sign plaque.
  ctx.fillStyle = C.outline;
  px(ctx, x - 14, base - 24, 28, 6);
  ctx.fillStyle = kind === "arcade" ? "#f265d4" : kind === "cafe" ? "#ffe263" : C.trimBlue;
  px(ctx, x - 9, base - 22, 18, 1);
  px(ctx, x - 7, base - 20, 14, 1);

  if (kind === "cafe") {
    ctx.fillStyle = "#f4d447";
    px(ctx, x + 20, base - 14, 2, 6);
    px(ctx, x + 18, base - 15, 6, 2);
    ctx.fillStyle = "#f17ea8";
    px(ctx, x - 26, base - 14, 3, 3);
  }
  if (kind === "arcade") {
    ctx.fillStyle = "#63e4f0";
    px(ctx, x + 21, base - 10, 3, 8);
    ctx.fillStyle = "#f265d4";
    px(ctx, x + 22, base - 13, 2, 3);
  }
}

export function drawPark(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  drawBench(ctx, gx, gy, true);
  drawBush(ctx, gx - 0.9, gy + 0.2, 0);
  drawBush(ctx, gx + 0.9, gy - 0.2, 1);
  drawFlower(ctx, gx - 0.4, gy + 0.8, C.flowerPink);
  drawFlower(ctx, gx + 0.8, gy + 0.5, C.flowerYellow);
}

