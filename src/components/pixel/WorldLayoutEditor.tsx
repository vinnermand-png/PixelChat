import { useEffect, useMemo, useRef, useState } from "react";
import { NATURE_ASSETS, type NatureAssetKey } from "./naturePack";

const VIEW_W = 640;
const VIEW_H = 400;
const TW = 32;
const TH = 16;
const GRID = 24;
const OX = VIEW_W / 2;
const OY = 54;

type Tool = "place" | "erase";
type PlacedObject = {
  id: string;
  key: NatureAssetKey;
  gx: number;
  gy: number;
};

type Group = { label: string; keys: NatureAssetKey[] };

const GROUPS: Group[] = [
  { label: "GRASS", keys: ["grassMicro01", "grassMicro02", "grassTuft01", "grassTuft02", "groundDetail01", "groundDetail02"] },
  { label: "FLOWERS", keys: ["tinyFlower01", "tinyFlower02", "wildFlower01", "wildFlower02", "wildFlower03", "mushroom01", "mushroom02", "mushroomCluster01"] },
  { label: "PLANTS", keys: ["smallPlant01", "smallPlant02", "smallPlant03", "fern01", "fern02", "bush01", "bush02", "bush03"] },
  { label: "ROCKS", keys: ["pebble01", "pebble02", "rock01", "rock02", "rock03", "rockCluster01", "rockCluster02"] },
  { label: "WOOD", keys: ["branch01", "branch02", "fallenWoodCluster01", "log01", "log02", "treeStump01"] },
  { label: "TREES", keys: ["treeSmall01", "treeSmall02", "treeMedium01", "treeMedium02", "treeLarge01", "treeLarge02"] },
  { label: "WATER", keys: ["waterPiece01", "waterPiece02", "pondEdgeCluster01", "reed01", "shorelineDetail01", "shorelineDetail02", "waterPlant01"] },
];

const STORAGE_KEY = "pixelchat-world-layout-editor-v1";

function iso(gx: number, gy: number) {
  return {
    x: OX + (gx - gy) * (TW / 2),
    y: OY + (gx + gy) * (TH / 2),
  };
}

function unIso(x: number, y: number) {
  const dx = (x - OX) / (TW / 2);
  const dy = (y - OY) / (TH / 2);
  return { gx: (dx + dy) / 2, gy: (dy - dx) / 2 };
}

function drawDiamond(ctx: CanvasRenderingContext2D, fill: string) {
  const a = iso(0, 0);
  const b = iso(GRID - 1, 0);
  const c = iso(GRID - 1, GRID - 1);
  const d = iso(0, GRID - 1);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x + TW / 2, b.y + TH / 2);
  ctx.lineTo(c.x, c.y + TH);
  ctx.lineTo(d.x - TW / 2, d.y + TH / 2);
  ctx.closePath();
  ctx.fill();
}

function pointInWorld(gx: number, gy: number) {
  return gx >= 0 && gy >= 0 && gx <= GRID - 1 && gy <= GRID - 1;
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WorldLayoutEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<NatureAssetKey, HTMLImageElement>>(new Map());
  const [objects, setObjects] = useState<PlacedObject[]>([]);
  const [selected, setSelected] = useState<NatureAssetKey>("grassMicro01");
  const [tool, setTool] = useState<Tool>("place");
  const [group, setGroup] = useState("GRASS");
  const [showGrid, setShowGrid] = useState(false);
  const [showMask, setShowMask] = useState(true);
  const [background, setBackground] = useState("#4f9d2d");
  const [dragging, setDragging] = useState(false);

  const activeKeys = useMemo(() => GROUPS.find((item) => item.label === group)?.keys ?? [], [group]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { objects?: PlacedObject[]; background?: string };
      if (Array.isArray(parsed.objects)) setObjects(parsed.objects);
      if (typeof parsed.background === "string") setBackground(parsed.background);
    } catch {
      // Ignore malformed local editor state.
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#080d16";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // This is the exact locked world surface. Everything is authored inside this diamond.
    drawDiamond(ctx, background);

    if (showGrid) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = "#d7f5a0";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < GRID; gx++) {
        for (let gy = 0; gy < GRID; gy++) {
          const p = iso(gx, gy);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + TW / 2, p.y + TH / 2);
          ctx.lineTo(p.x, p.y + TH);
          ctx.lineTo(p.x - TW / 2, p.y + TH / 2);
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const sorted = [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const obj of sorted) {
      const meta = NATURE_ASSETS[obj.key];
      let img = imagesRef.current.get(obj.key);
      if (!img) {
        img = new Image();
        img.src = meta.path;
        imagesRef.current.set(obj.key, img);
      }
      const draw = () => {
        const p = iso(obj.gx, obj.gy);
        ctx.drawImage(img!, Math.round(p.x - meta.width / 2), Math.round(p.y + TH / 2 - meta.height + 3), meta.width, meta.height);
      };
      if (img.complete && img.naturalWidth > 0) draw();
      else img.onload = () => draw();
    }

    if (showMask) {
      ctx.save();
      ctx.strokeStyle = "#a9df5a";
      ctx.lineWidth = 2;
      const a = iso(0, 0);
      const b = iso(GRID - 1, 0);
      const c = iso(GRID - 1, GRID - 1);
      const d = iso(0, GRID - 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x + TW / 2, b.y + TH / 2);
      ctx.lineTo(c.x, c.y + TH);
      ctx.lineTo(d.x - TW / 2, d.y + TH / 2);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }, [objects, background, showGrid, showMask]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (VIEW_W / rect.width),
      y: (event.clientY - rect.top) * (VIEW_H / rect.height),
    };
  };

  const edit = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointFromEvent(event);
    if (!point) return;
    const world = unIso(point.x, point.y);
    const gx = Math.round(world.gx * 2) / 2;
    const gy = Math.round(world.gy * 2) / 2;
    if (!pointInWorld(gx, gy)) return;

    if (tool === "erase") {
      setObjects((current) => {
        let best: PlacedObject | null = null;
        let bestDist = Infinity;
        for (const obj of current) {
          const d = Math.hypot(obj.gx - gx, obj.gy - gy);
          if (d < bestDist && d < 1.35) {
            best = obj;
            bestDist = d;
          }
        }
        return best ? current.filter((item) => item.id !== best!.id) : current;
      });
      return;
    }

    setObjects((current) => [...current, { id: crypto.randomUUID(), key: selected, gx, gy }]);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, grid: GRID, tile: { width: TW, height: TH }, background, objects }));
  };

  const clear = () => {
    if (confirm("Clear this world layout?")) setObjects([]);
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "pixelchat-world-layout.png";
    link.click();
  };

  const exportJson = () => {
    download("pixelchat-world-layout.json", JSON.stringify({ version: 1, grid: GRID, tile: { width: TW, height: TH }, background, objects }, null, 2), "application/json");
  };

  return (
    <main className="min-h-screen bg-[#080d16] p-4 text-[#d7f5a0]" style={{ fontFamily: '"Courier New", monospace' }}>
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2">
          <div>
            <div className="text-sm font-bold">PIXELCHAT WORLD LAYOUT EDITOR</div>
            <div className="text-xs text-[#6ee7d8]">LOCKED WORLD TEMPLATE // {GRID}×{GRID} // {TW}×{TH} TILE</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={() => setTool("place")} className={`border-2 px-3 py-2 ${tool === "place" ? "bg-[#d7f5a0] text-[#0b111c]" : "bg-[#0d1520]"}`}>PLACE</button>
            <button onClick={() => setTool("erase")} className={`border-2 px-3 py-2 ${tool === "erase" ? "bg-[#f4d447] text-[#0b111c]" : "bg-[#0d1520]"}`}>ERASE</button>
            <button onClick={save} className="border-2 bg-[#0d1520] px-3 py-2">SAVE</button>
            <button onClick={clear} className="border-2 bg-[#0d1520] px-3 py-2">CLEAR</button>
            <button onClick={exportPng} className="border-2 bg-[#a9df5a] px-3 py-2 text-[#0b111c]">EXPORT PNG</button>
            <button onClick={exportJson} className="border-2 bg-[#0d1520] px-3 py-2">EXPORT JSON</button>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <section className="border-2 border-[#324159] bg-[#0b111c] p-2">
            <canvas
              ref={canvasRef}
              width={VIEW_W}
              height={VIEW_H}
              className="block w-full touch-none"
              style={{ imageRendering: "pixelated", cursor: tool === "erase" ? "crosshair" : "cell" }}
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); edit(event); }}
              onPointerMove={(event) => { if (dragging && tool === "place") edit(event); }}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
            />
          </section>

          <aside className="border-2 border-[#324159] bg-[#101826] p-3">
            <div className="mb-2 text-xs text-[#6ee7d8]">WORLD CONTROLS</div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
              <label className="border border-[#324159] p-2">BASE GRASS<input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="mt-1 h-8 w-full bg-transparent" /></label>
              <button className="border border-[#324159] p-2 text-left" onClick={() => setShowGrid((v) => !v)}>GRID: {showGrid ? "ON" : "OFF"}</button>
              <button className="border border-[#324159] p-2 text-left" onClick={() => setShowMask((v) => !v)}>MASK: {showMask ? "ON" : "OFF"}</button>
              <div className="border border-[#324159] p-2">OBJECTS: {objects.length}</div>
            </div>

            <div className="mb-2 text-xs text-[#6ee7d8]">ASSET LIBRARY</div>
            <div className="mb-3 flex flex-wrap gap-1">
              {GROUPS.map((item) => (
                <button key={item.label} onClick={() => setGroup(item.label)} className={`border px-2 py-1 text-[10px] ${group === item.label ? "bg-[#a9df5a] text-[#0b111c]" : "bg-[#0b111c]"}`}>{item.label}</button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {activeKeys.map((key) => {
                const meta = NATURE_ASSETS[key];
                return (
                  <button key={key} title={key} onClick={() => { setSelected(key); setTool("place"); }} className={`flex h-20 items-center justify-center border-2 bg-[#0b111c] p-1 ${selected === key && tool === "place" ? "border-[#d7f5a0]" : "border-[#324159]"}`}>
                    <img src={meta.path} alt={key} style={{ imageRendering: "pixelated", maxWidth: "76px", maxHeight: "76px" }} />
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-[#324159] pt-3 text-[10px] leading-4 text-[#9eb0c8]">
              Selected: <span className="text-[#d7f5a0]">{selected}</span><br />
              Tool: <span className="text-[#d7f5a0]">{tool}</span><br /><br />
              Paint directly on the locked diamond. The outside area is never part of the exported world image. SAVE stores the layout in this browser.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
