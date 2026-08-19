import { useEffect, useMemo, useRef, useState } from "react";
import { NATURE_ASSETS, type NatureAssetKey } from "./naturePack";

const VIEW_W = 640;
const VIEW_H = 400;
const TW = 32;
const TH = 16;
const GRID = 24;
const OX = VIEW_W / 2;
const OY = 54;

const GROUPS: Array<{ label: string; keys: NatureAssetKey[] }> = [
  {
    label: "GRASS",
    keys: ["grassMicro01", "grassMicro02", "grassTuft01", "grassTuft02", "groundDetail01", "groundDetail02"],
  },
  {
    label: "FLOWERS",
    keys: ["tinyFlower01", "tinyFlower02", "wildFlower01", "wildFlower02", "wildFlower03", "mushroom01", "mushroom02", "mushroomCluster01"],
  },
  {
    label: "PLANTS",
    keys: ["smallPlant01", "smallPlant02", "smallPlant03", "fern01", "fern02", "bush01", "bush02", "bush03"],
  },
  {
    label: "ROCKS",
    keys: ["pebble01", "pebble02", "rock01", "rock02", "rock03", "rockCluster01", "rockCluster02"],
  },
  {
    label: "WOOD",
    keys: ["branch01", "branch02", "fallenWoodCluster01", "log01", "log02", "treeStump01"],
  },
  {
    label: "TREES",
    keys: ["treeSmall01", "treeSmall02", "treeMedium01", "treeMedium02", "treeLarge01", "treeLarge02"],
  },
  {
    label: "WATER",
    keys: ["waterPiece01", "waterPiece02", "pondEdgeCluster01", "reed01", "shorelineDetail01", "shorelineDetail02", "waterPlant01"],
  },
];

type Tool = "place" | "erase";
type ObjectPlacement = { id: string; key: NatureAssetKey; gx: number; gy: number };

function iso(gx: number, gy: number) {
  return { x: OX + (gx - gy) * (TW / 2), y: OY + (gx + gy) * (TH / 2) };
}

function unIso(x: number, y: number) {
  const dx = (x - OX) / (TW / 2);
  const dy = (y - OY) / (TH / 2);
  return { gx: (dx + dy) / 2, gy: (dy - dx) / 2 };
}

function fillDiamond(ctx: CanvasRenderingContext2D, color: string) {
  const a = iso(0, 0);
  const b = iso(GRID - 1, 0);
  const c = iso(GRID - 1, GRID - 1);
  const d = iso(0, GRID - 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x + TW / 2, b.y + TH / 2);
  ctx.lineTo(c.x, c.y + TH);
  ctx.lineTo(d.x - TW / 2, d.y + TH / 2);
  ctx.closePath();
  ctx.fill();
}

function pointInsideWorld(gx: number, gy: number) {
  return gx >= 0 && gy >= 0 && gx <= GRID - 1 && gy <= GRID - 1;
}

function hitTestPlacement(x: number, y: number, objects: ObjectPlacement[]) {
  const ordered = [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
  let hit: ObjectPlacement | null = null;
  for (const obj of ordered) {
    const meta = NATURE_ASSETS[obj.key];
    const p = iso(obj.gx, obj.gy);
    const left = p.x - meta.width / 2;
    const top = p.y + TH / 2 - meta.height + 3;
    if (x >= left && x <= left + meta.width && y >= top && y <= top + meta.height) hit = obj;
  }
  return hit;
}

export default function NatureTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [objects, setObjects] = useState<ObjectPlacement[]>([]);
  const [selected, setSelected] = useState<NatureAssetKey>("grassMicro01");
  const [tool, setTool] = useState<Tool>("place");
  const [activeGroup, setActiveGroup] = useState("GRASS");
  const [dragging, setDragging] = useState(false);

  const activeKeys = useMemo(() => GROUPS.find((g) => g.label === activeGroup)?.keys ?? [], [activeGroup]);

  useEffect(() => {
    const saved = localStorage.getItem("pixelchat-nature-editor-v1");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ObjectPlacement[];
      if (Array.isArray(parsed)) setObjects(parsed);
    } catch {
      // Ignore malformed local saves.
    }
  }, []);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0b111c";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    fillDiamond(ctx, "#4f9d2d");

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#72b83e";
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const p = iso(gx, gy);
        ctx.fillRect(Math.round(p.x), Math.round(p.y + 5), 1, 1);
      }
    }
    ctx.restore();

    [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy)).forEach((obj) => {
      const img = new Image();
      const meta = NATURE_ASSETS[obj.key];
      img.src = meta.path;
      img.onload = () => {
        const p = iso(obj.gx, obj.gy);
        ctx.drawImage(img, Math.round(p.x - meta.width / 2), Math.round(p.y + TH / 2 - meta.height + 3), meta.width, meta.height);
      };
    });
  };

  useEffect(() => {
    render();
  }, [objects]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (VIEW_W / rect.width),
      y: (event.clientY - rect.top) * (VIEW_H / rect.height),
    };
  };

  const editAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    if (!point) return;
    const hit = hitTestPlacement(point.x, point.y, objects);
    if (tool === "erase") {
      if (hit) setObjects((current) => current.filter((item) => item.id !== hit.id));
      return;
    }
    const world = unIso(point.x, point.y);
    const gx = Math.round(world.gx * 2) / 2;
    const gy = Math.round(world.gy * 2) / 2;
    if (!pointInsideWorld(gx, gy)) return;
    if (hit) return;
    setObjects((current) => [...current, { id: crypto.randomUUID(), key: selected, gx, gy }]);
  };

  const save = () => {
    localStorage.setItem("pixelchat-nature-editor-v1", JSON.stringify(objects));
  };

  const clear = () => {
    if (confirm("Clear the whole Nature Test world?")) setObjects([]);
  };

  return (
    <main className="min-h-screen bg-[#080d16] p-4 text-[#d7f5a0]" style={{ fontFamily: '"Courier New", monospace' }}>
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2">
          <div>
            <div className="text-sm font-bold">PIXELCHAT NATURE EDITOR</div>
            <div className="text-xs text-[#6ee7d8]">MANUAL WORLD BUILDER // 24×24</div>
          </div>
          <div className="flex gap-2 text-xs">
            <button className={`border-2 px-3 py-2 ${tool === "place" ? "bg-[#d7f5a0] text-[#0b111c]" : "bg-[#0d1520]"}`} onClick={() => setTool("place")}>PLACE</button>
            <button className={`border-2 px-3 py-2 ${tool === "erase" ? "bg-[#f4d447] text-[#0b111c]" : "bg-[#0d1520]"}`} onClick={() => setTool("erase")}>ERASE</button>
            <button className="border-2 bg-[#0d1520] px-3 py-2" onClick={save}>SAVE</button>
            <button className="border-2 bg-[#0d1520] px-3 py-2" onClick={clear}>CLEAR</button>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <section className="border-2 border-[#324159] bg-[#0b111c] p-2">
            <canvas
              ref={canvasRef}
              width={VIEW_W}
              height={VIEW_H}
              className="block w-full pixelated touch-none"
              style={{ imageRendering: "pixelated" }}
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); editAt(event); }}
              onPointerMove={(event) => { if (dragging && tool === "place") editAt(event); }}
              onPointerUp={() => setDragging(false)}
              onPointerLeave={() => setDragging(false)}
            />
          </section>

          <aside className="border-2 border-[#324159] bg-[#101826] p-3">
            <div className="mb-2 text-xs text-[#6ee7d8]">ASSET LIBRARY</div>
            <div className="mb-3 flex flex-wrap gap-1">
              {GROUPS.map((group) => (
                <button
                  key={group.label}
                  className={`border px-2 py-1 text-[10px] ${activeGroup === group.label ? "bg-[#a9df5a] text-[#0b111c]" : "bg-[#0b111c]"}`}
                  onClick={() => setActiveGroup(group.label)}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {activeKeys.map((key) => {
                const meta = NATURE_ASSETS[key];
                return (
                  <button
                    key={key}
                    title={key}
                    className={`flex h-20 items-center justify-center border-2 bg-[#0b111c] p-1 ${selected === key && tool === "place" ? "border-[#d7f5a0]" : "border-[#324159]"}`}
                    onClick={() => { setSelected(key); setTool("place"); }}
                  >
                    <img src={meta.path} alt={key} style={{ imageRendering: "pixelated", maxWidth: "64px", maxHeight: "64px" }} />
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-[#324159] pt-3 text-[10px] leading-4 text-[#9eb0c8]">
              Selected: <span className="text-[#d7f5a0]">{selected}</span><br />
              Tool: <span className="text-[#d7f5a0]">{tool}</span><br />
              Objects: <span className="text-[#d7f5a0]">{objects.length}</span><br /><br />
              Click to place. Drag with PLACE for repeated details. ERASE removes the top object under the cursor. SAVE stores the world in this browser.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
