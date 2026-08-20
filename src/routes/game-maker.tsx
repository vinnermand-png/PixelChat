import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  GRID,
  TH,
  TW,
  VIEW_H,
  VIEW_W,
  drawRock,
  drawTorvetGround,
  drawTree,
  iso,
  unIso,
} from "@/components/pixel/world";

type AssetType = "tree" | "rock";
type Tool = "place" | "select" | "erase";
type WorldObject = {
  id: string;
  type: AssetType;
  gx: number;
  gy: number;
};

const STORAGE_KEY = "pixelchat-game-maker-v1";

export const Route = createFileRoute("/game-maker")({
  component: GameMaker,
});

function GameMaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("place");
  const [asset, setAsset] = useState<AssetType>("tree");
  const [objects, setObjects] = useState<WorldObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ gx: number; gy: number } | null>(null);
  const [status, setStatus] = useState("READY · 14 × 14 ISO GRID · 32 × 16 TILES");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as WorldObject[];
      if (Array.isArray(saved)) setObjects(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawTorvetGround(ctx);

    const ordered = [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const object of ordered) {
      if (object.type === "tree") drawTree(ctx, object.gx, object.gy);
      if (object.type === "rock") drawRock(ctx, object.gx, object.gy);
    }

    if (hover) {
      const p = iso(hover.gx, hover.gy);
      ctx.save();
      ctx.strokeStyle = "#f0c14b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(p.x), Math.round(p.y));
      ctx.lineTo(Math.round(p.x + TW / 2), Math.round(p.y + TH / 2));
      ctx.lineTo(Math.round(p.x), Math.round(p.y + TH));
      ctx.lineTo(Math.round(p.x - TW / 2), Math.round(p.y + TH / 2));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }, [objects, hover]);

  const getCell = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_H;
    const raw = unIso(x, y);
    const gx = Math.round(raw.gx);
    const gy = Math.round(raw.gy);
    if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return null;
    return { gx, gy };
  };

  const saveWorld = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(objects));
    setStatus(`SAVED · ${objects.length} OBJECT${objects.length === 1 ? "" : "S"} · PIXELCHAT WORLD V1`);
  };

  const loadWorld = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("NO SAVED WORLD FOUND");
      return;
    }
    try {
      const saved = JSON.parse(raw) as WorldObject[];
      setObjects(Array.isArray(saved) ? saved : []);
      setStatus(`LOADED · ${Array.isArray(saved) ? saved.length : 0} OBJECTS`);
    } catch {
      setStatus("SAVE DATA IS INVALID");
    }
  };

  const clearWorld = () => {
    setObjects([]);
    setSelectedId(null);
    setStatus("WORLD CLEARED · NOT SAVED YET");
  };

  return (
    <main className="min-h-screen bg-background px-3 py-5 text-foreground">
      <section className="mx-auto max-w-[1180px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-2 border-border bg-card px-4 py-3 shadow-[4px_4px_0_hsl(var(--border))]">
          <div>
            <h1 className="text-[18px] text-primary">PIXEL<span className="text-accent">GAME MAKER</span></h1>
            <p className="mt-1 text-[8px] text-muted-foreground">PIXELCHAT PLATFORM V1 · PRECISION EDITOR</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="pixel-btn" onClick={saveWorld}>SAVE</button>
            <button className="pixel-btn" onClick={loadWorld}>LOAD</button>
            <button className="pixel-btn" onClick={clearWorld}>CLEAR</button>
            <a className="pixel-btn" href="/">PLAY CHAT</a>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)_220px]">
          <aside className="border-2 border-border bg-card p-3">
            <h2 className="mb-3 text-[11px] text-primary">ASSET LIBRARY</h2>
            <p className="mb-2 text-[8px] text-muted-foreground">PLATFORM-LOCKED ASSETS</p>
            <div className="space-y-2">
              <button className={`pixel-btn w-full text-left ${asset === "tree" ? "ring-2 ring-primary" : ""}`} onClick={() => { setAsset("tree"); setTool("place"); }}>
                🌲 TREE
              </button>
              <button className={`pixel-btn w-full text-left ${asset === "rock" ? "ring-2 ring-primary" : ""}`} onClick={() => { setAsset("rock"); setTool("place"); }}>
                🪨 ROCK
              </button>
            </div>
            <div className="mt-5 border-t-2 border-border pt-4">
              <h3 className="mb-2 text-[10px] text-primary">TOOLS</h3>
              <div className="space-y-2">
                <button className={`pixel-btn w-full ${tool === "place" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("place")}>PLACE</button>
                <button className={`pixel-btn w-full ${tool === "select" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("select")}>SELECT</button>
                <button className={`pixel-btn w-full ${tool === "erase" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("erase")}>ERASE</button>
              </div>
            </div>
          </aside>

          <section className="border-2 border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[8px] text-muted-foreground">
              <span>LIVE ISO WORLD</span>
              <span>{hover ? `GRID ${hover.gx}, ${hover.gy}` : "MOVE OVER MAP"}</span>
            </div>
            <div className="overflow-hidden border-2 border-border bg-[#0d1423]">
              <canvas
                ref={canvasRef}
                width={VIEW_W}
                height={VIEW_H}
                className="block h-auto w-full cursor-crosshair [image-rendering:pixelated]"
                onPointerMove={(event) => setHover(getCell(event))}
                onPointerLeave={() => setHover(null)}
                onPointerDown={(event) => {
                  const cell = getCell(event);
                  if (!cell) return;
                  const matches = objects.filter((object) => object.gx === cell.gx && object.gy === cell.gy);

                  if (tool === "erase") {
                    setObjects((current) => current.filter((object) => !(object.gx === cell.gx && object.gy === cell.gy)));
                    setStatus(`ERASED GRID ${cell.gx}, ${cell.gy}`);
                    return;
                  }

                  if (tool === "select") {
                    const hit = matches[matches.length - 1];
                    setSelectedId(hit?.id ?? null);
                    setStatus(hit ? `SELECTED ${hit.type.toUpperCase()} · GRID ${cell.gx}, ${cell.gy}` : `EMPTY GRID ${cell.gx}, ${cell.gy}`);
                    return;
                  }

                  if (matches.some((object) => object.type === asset)) {
                    setStatus(`GRID ${cell.gx}, ${cell.gy} ALREADY HAS ${asset.toUpperCase()}`);
                    return;
                  }

                  const object: WorldObject = {
                    id: `${asset}-${cell.gx}-${cell.gy}-${Date.now()}`,
                    type: asset,
                    gx: cell.gx,
                    gy: cell.gy,
                  };
                  setObjects((current) => [...current, object]);
                  setSelectedId(object.id);
                  setStatus(`PLACED ${asset.toUpperCase()} · GRID ${cell.gx}, ${cell.gy} · AUTO-ANCHORED`);
                }}
              />
            </div>
            <p className="mt-3 text-[8px] leading-[1.7] text-muted-foreground">
              {status}
            </p>
          </section>

          <aside className="border-2 border-border bg-card p-3">
            <h2 className="mb-3 text-[11px] text-primary">PLATFORM INSPECTOR</h2>
            <dl className="space-y-3 text-[9px]">
              <div><dt className="text-muted-foreground">TILE</dt><dd>32 × 16 PX</dd></div>
              <div><dt className="text-muted-foreground">GRID</dt><dd>14 × 14</dd></div>
              <div><dt className="text-muted-foreground">VIEWPORT</dt><dd>480 × 300 PX</dd></div>
              <div><dt className="text-muted-foreground">RENDERING</dt><dd>PIXEL PERFECT</dd></div>
              <div><dt className="text-muted-foreground">SNAP</dt><dd>AUTOMATIC</dd></div>
              <div><dt className="text-muted-foreground">DEPTH</dt><dd>AUTO SORT</dd></div>
            </dl>
            <div className="mt-5 border-t-2 border-border pt-4 text-[8px] text-muted-foreground">
              <p className="mb-1 text-primary">SELECTED</p>
              {selectedId ? <p>{objects.find((object) => object.id === selectedId)?.type.toUpperCase() ?? "NONE"}</p> : <p>NONE</p>}
              <p className="mt-3">OBJECTS: {objects.length}</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
