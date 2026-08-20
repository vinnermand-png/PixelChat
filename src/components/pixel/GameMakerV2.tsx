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

function cellKey(gx: number, gy: number) {
  return `${gx},${gy}`;
}

function inBounds(gx: number, gy: number, gridSize: number) {
  return gx >= 0 && gy >= 0 && gx < gridSize && gy < gridSize;
}

function drawCellDiamond(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  color: string,
) {
  const p = iso(gx, gy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + TW / 2, p.y + TH / 2);
  ctx.lineTo(p.x, p.y + TH);
  ctx.lineTo(p.x - TW / 2, p.y + TH / 2);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  terrain: Record<string, TerrainKey>,
  gridSize: number,
) {
  for (let s = 0; s <= (gridSize - 1) * 2; s++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const gy = s - gx;
      if (!inBounds(gx, gy, gridSize)) continue;
      if (!terrain[cellKey(gx, gy)]) continue;
      drawCellDiamond(ctx, gx, gy, "#4f9d2d");
    }
  }
}

function drawHover(ctx: CanvasRenderingContext2D, hover: Cell | null) {
  if (!hover) return;
  const p = iso(hover.gx, hover.gy);
  ctx.strokeStyle = "#f7d44a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(p.x), Math.round(p.y) + 0.5);
  ctx.lineTo(Math.round(p.x + TW / 2), Math.round(p.y + TH / 2) + 0.5);
  ctx.lineTo(Math.round(p.x), Math.round(p.y + TH) + 0.5);
  ctx.lineTo(Math.round(p.x - TW / 2), Math.round(p.y + TH / 2) + 0.5);
  ctx.closePath();
  ctx.stroke();
}

function screenToCell(x: number, y: number, gridSize: number): Cell | null {
  const raw = unIso(x, y);
  const baseGx = Math.floor(raw.gx);
  const baseGy = Math.floor(raw.gy);

  // Check the mathematically likely cell plus immediate neighbours and use
  // the actual diamond hit test. This avoids incorrect picks around edges.
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#15202b";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    drawTerrain(ctx, world.terrain, world.gridSize);
    drawHover(ctx, hover);
  }, [world, hover]);

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
        <h1 style={{ margin: "6px 0 8px" }}>STEP 1 — WORLD FOUNDATION</h1>
        <p style={{ margin: 0, color: "#9fb0c2" }}>
          Minimal world data, verified isometric cell picking, hover and terrain cell editing. No foundation, objects or grid overlay yet.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 18 }}>
        <aside style={{ border: "1px solid #33475c", background: "#101820", padding: 14 }}>
          <h2 style={{ fontSize: 14, marginTop: 0 }}>TOOLS</h2>
          <button onClick={() => setTool("paint")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "paint" ? 800 : 400 }}>
            PAINT GRASS
          </button>
          <button onClick={() => setTool("erase")} style={{ width: "100%", marginBottom: 16, padding: 10, fontWeight: tool === "erase" ? 800 : 400 }}>
            ERASE CELL
          </button>
          <button onClick={clearWorld} style={{ width: "100%", padding: 10 }}>CLEAR WORLD</button>

          <div style={{ marginTop: 22, color: "#9fb0c2", fontSize: 13, lineHeight: 1.6 }}>
            <div><b>GRID DATA:</b> {world.gridSize} × {world.gridSize}</div>
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
