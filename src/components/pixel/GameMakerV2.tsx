import { useEffect, useRef, useState } from "react";
import { TH, TW, VIEW_H, VIEW_W, iso, unIso } from "@/components/pixel/world";

type TerrainKey = "grass";
type Tool = "paint" | "erase";
type Cell = { gx: number; gy: number };
type WorldData = {
  gridSize: number;
  terrain: Record<string, TerrainKey>;
};

const DEFAULT_GRID_SIZE = 14;
const DEFAULT_WORLD: WorldData = {
  gridSize: DEFAULT_GRID_SIZE,
  terrain: {},
};

// STEP 4: foundation is its own renderer and configuration.
// It is intentionally independent from the top terrain material.
const GRASS_COLOR = "#4f9d2d";
const SOIL_COLOR = "#8b5a2b";
const SOIL_RIGHT_SHADE = "#74461f";
const SOIL_LEFT_SHADE = "#9a6430";
const FOUNDATION_DEPTH = 12;

function cellKey(gx: number, gy: number) {
  return `${gx},${gy}`;
}

function inBounds(gx: number, gy: number, gridSize: number) {
  return gx >= 0 && gy >= 0 && gx < gridSize && gy < gridSize;
}

function traceDiamond(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const p = iso(gx, gy);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + TW / 2, p.y + TH / 2);
  ctx.lineTo(p.x, p.y + TH);
  ctx.lineTo(p.x - TW / 2, p.y + TH / 2);
  ctx.closePath();
}

function drawFoundationFace(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + FOUNDATION_DEPTH);
  ctx.lineTo(a.x, a.y + FOUNDATION_DEPTH);
  ctx.closePath();
  ctx.fill();
}

// STEP 4: inspect terrain neighbours and draw foundation only where a
// terrain cell meets empty space. Internal terrain-to-terrain borders are skipped.
function drawFoundation(
  ctx: CanvasRenderingContext2D,
  terrain: Record<string, TerrainKey>,
  gridSize: number,
) {
  const hasTerrain = (gx: number, gy: number) =>
    inBounds(gx, gy, gridSize) && Boolean(terrain[cellKey(gx, gy)]);

  for (let s = 0; s <= (gridSize - 1) * 2; s++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const gy = s - gx;
      if (!inBounds(gx, gy, gridSize) || !hasTerrain(gx, gy)) continue;

      const p = iso(gx, gy);
      const right = { x: p.x + TW / 2, y: p.y + TH / 2 };
      const bottom = { x: p.x, y: p.y + TH };
      const left = { x: p.x - TW / 2, y: p.y + TH / 2 };

      // These are the two visible lower perimeter directions.
      if (!hasTerrain(gx + 1, gy)) {
        drawFoundationFace(ctx, right, bottom, SOIL_RIGHT_SHADE);
      }
      if (!hasTerrain(gx, gy + 1)) {
        drawFoundationFace(ctx, left, bottom, SOIL_LEFT_SHADE);
      }
    }
  }
}

function drawTerrainSurface(
  ctx: CanvasRenderingContext2D,
  terrain: Record<string, TerrainKey>,
  gridSize: number,
) {
  ctx.fillStyle = GRASS_COLOR;
  ctx.beginPath();

  let hasTerrain = false;
  for (let s = 0; s <= (gridSize - 1) * 2; s++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const gy = s - gx;
      if (!inBounds(gx, gy, gridSize)) continue;
      if (!terrain[cellKey(gx, gy)]) continue;

      const p = iso(gx, gy);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + TW / 2, p.y + TH / 2);
      ctx.lineTo(p.x, p.y + TH);
      ctx.lineTo(p.x - TW / 2, p.y + TH / 2);
      ctx.closePath();
      hasTerrain = true;
    }
  }

  if (hasTerrain) ctx.fill();
}

// Editor-only visual overlay. It reads world geometry but never changes data.
function drawGridOverlay(ctx: CanvasRenderingContext2D, gridSize: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(185, 205, 225, 0.55)";
  ctx.lineWidth = 1;

  for (let s = 0; s <= (gridSize - 1) * 2; s++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const gy = s - gx;
      if (!inBounds(gx, gy, gridSize)) continue;
      traceDiamond(ctx, gx, gy);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawHover(ctx: CanvasRenderingContext2D, hover: Cell | null) {
  if (!hover) return;
  ctx.save();
  ctx.strokeStyle = "#f7d44a";
  ctx.lineWidth = 1;
  traceDiamond(ctx, hover.gx, hover.gy);
  ctx.stroke();
  ctx.restore();
}

function screenToCell(x: number, y: number, gridSize: number): Cell | null {
  const raw = unIso(x, y);
  const baseGx = Math.floor(raw.gx);
  const baseGy = Math.floor(raw.gy);

  for (let gy = baseGy - 1; gy <= baseGy + 1; gy++) {
    for (let gx = baseGx - 1; gx <= baseGx + 1; gx++) {
      if (!inBounds(gx, gy, gridSize)) continue;
      const p = iso(gx, gy);
      const centerX = p.x;
      const centerY = p.y + TH / 2;
      const distance = Math.abs(x - centerX) / (TW / 2) + Math.abs(y - centerY) / (TH / 2);
      if (distance <= 1) return { gx, gy };
    }
  }

  return null;
}

export default function GameMakerV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<WorldData>(DEFAULT_WORLD);
  const [tool, setTool] = useState<Tool>("paint");
  const [hover, setHover] = useState<Cell | null>(null);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#15202b";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Fixed V2 render pipeline. Each layer owns only its own responsibility.
    drawFoundation(ctx, world.terrain, world.gridSize);
    drawTerrainSurface(ctx, world.terrain, world.gridSize);
    if (showGrid) drawGridOverlay(ctx, world.gridSize);
    drawHover(ctx, hover);
  }, [world, hover, showGrid]);

  function getCell(event: React.PointerEvent<HTMLCanvasElement>): Cell | null {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_H;
    return screenToCell(x, y, world.gridSize);
  }

  function paint(cell: Cell) {
    const key = cellKey(cell.gx, cell.gy);
    setWorld((current) => {
      const terrain = { ...current.terrain };
      if (tool === "paint") terrain[key] = "grass";
      else delete terrain[key];
      return { ...current, terrain };
    });
  }

  function clearWorld() {
    setWorld((current) => ({ ...current, terrain: {} }));
  }

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 24, color: "#e8eef7" }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ color: "#7f95aa", fontSize: 12, letterSpacing: 2 }}>PIXELCHAT · GAME MAKER V2</div>
        <h1 style={{ margin: "6px 0 8px" }}>STEP 4 — FOUNDATION SYSTEM</h1>
        <p style={{ margin: 0, color: "#9fb0c2" }}>
          Soil foundation is rendered separately below the top terrain. Only outer terrain edges receive foundation faces; internal cell borders never do.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 18 }}>
        <aside style={{ border: "1px solid #33475c", background: "#101820", padding: 14 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>TOOLS</h2>
          <button onClick={() => setTool("paint")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "paint" ? 800 : 400 }}>
            PAINT GRASS
          </button>
          <button onClick={() => setTool("erase")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "erase" ? 800 : 400 }}>
            ERASE CELL
          </button>
          <button
            onClick={() => setShowGrid((current) => !current)}
            style={{ width: "100%", marginBottom: 16, padding: 10, fontWeight: 800 }}
          >
            GRID · {showGrid ? "ON" : "OFF"}
          </button>
          <button onClick={clearWorld} style={{ width: "100%", padding: 10 }}>CLEAR WORLD</button>

          <div style={{ marginTop: 22, color: "#9fb0c2", fontSize: 13, lineHeight: 1.6 }}>
            <div><b>GRID DATA:</b> {world.gridSize} × {world.gridSize}</div>
            <div><b>GRID OVERLAY:</b> {showGrid ? "ON" : "OFF"}</div>
            <div><b>FOUNDATION:</b> SOIL · {FOUNDATION_DEPTH}px</div>
            <div><b>TERRAIN CELLS:</b> {Object.keys(world.terrain).length}</div>
            <div><b>TOOL:</b> {tool.toUpperCase()}</div>
            <div><b>HOVER:</b> {hover ? `${hover.gx}, ${hover.gy}` : "OUTSIDE WORLD"}</div>
          </div>
        </aside>

        <section style={{ border: "1px solid #33475c", background: "#0b1118", padding: 12 }}>
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            onPointerMove={(event) => setHover(getCell(event))}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(event) => {
              const cell = getCell(event);
              if (cell) paint(cell);
            }}
            style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", imageRendering: "pixelated", touchAction: "none" }}
          />
        </section>
      </section>
    </main>
  );
}
