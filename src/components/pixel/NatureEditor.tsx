import { useEffect, useMemo, useRef, useState } from "react";
import { NATURE_ASSETS, type NatureAssetKey } from "./naturePack";

const VIEW_W = 640;
const VIEW_H = 400;
const TW = 32;
const TH = 16;
const GRID = 24;
const OX = VIEW_W / 2;
const OY = 54;

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

type Tool = "place" | "erase";
type Placement = { id: string; key: NatureAssetKey; gx: number; gy: number };
const SAVE_KEY = "pixelchat-nature-editor-v1";

function iso(gx: number, gy: number) {
  return { x: OX + (gx - gy) * (TW / 2), y: OY + (gx + gy) * (TH / 2) };
}
function unIso(x: number, y: number) {
  const dx = (x - OX) / (TW / 2);
  const dy = (y - OY) / (TH / 2);
  return { gx: (dx + dy) / 2, gy: (dy - dx) / 2 };
}
function fillWorld(ctx: CanvasRenderingContext2D) {
  const a = iso(0, 0), b = iso(GRID - 1, 0), c = iso(GRID - 1, GRID - 1), d = iso(0, GRID - 1);
  ctx.fillStyle = "#4f9d2d";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x + TW / 2, b.y + TH / 2);
  ctx.lineTo(c.x, c.y + TH);
  ctx.lineTo(d.x - TW / 2, d.y + TH / 2);
  ctx.closePath();
  ctx.fill();
}

const cache = new Map<NatureAssetKey, HTMLImageElement>();
function imageFor(key: NatureAssetKey) {
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = NATURE_ASSETS[key].path;
    cache.set(key, img);
  }
  return img;
}

export default function NatureEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [objects, setObjects] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<NatureAssetKey>("grassMicro01");
  const [group, setGroup] = useState("GRASS");
  const [tool, setTool] = useState<Tool>("place");
  const [painting, setPainting] = useState(false);

  const keys = useMemo(() => GROUPS.find((g) => g.label === group)?.keys ?? [], [group]);

  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setObjects(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#0b111c";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    fillWorld(ctx);

    const draw = (obj: Placement) => {
      const img = imageFor(obj.key);
      const meta = NATURE_ASSETS[obj.key];
      if (!img.complete || img.naturalWidth === 0) {
        img.onload = () => draw(obj);
        return;
      }
      const p = iso(obj.gx, obj.gy);
      ctx.drawImage(img, Math.round(p.x - meta.width / 2), Math.round(p.y + TH / 2 - meta.height + 3), meta.width, meta.height);
    };

    [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy)).forEach(draw);
  }, [objects]);

  function pointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (VIEW_W / rect.width),
      y: (event.clientY - rect.top) * (VIEW_H / rect.height),
    };
  }

  function hit(x: number, y: number) {
    const ordered = [...objects].sort((a, b) => (b.gx + b.gy) - (a.gx + a.gy));
    for (const obj of ordered) {
      const meta = NATURE_ASSETS[obj.key];
      const p = iso(obj.gx, obj.gy);
      const left = p.x - meta.width / 2;
      const top = p.y + TH / 2 - meta.height + 3;
      if (x >= left && x <= left + meta.width && y >= top && y <= top + meta.height) return obj;
    }
    return null;
  }

  function edit(event: React.PointerEvent<HTMLCanvasElement>) {
    const p = pointer(event);
    if (!p) return;
    const existing = hit(p.x, p.y);
    if (tool === "erase") {
      if (existing) setObjects((items) => items.filter((item) => item.id !== existing.id));
      return;
    }
    if (existing) return;
    const g = unIso(p.x, p.y);
    const gx = Math.round(g.gx * 2) / 2;
    const gy = Math.round(g.gy * 2) / 2;
    if (gx < 0 || gy < 0 || gx > GRID - 1 || gy > GRID - 1) return;
    setObjects((items) => [...items, { id: crypto.randomUUID(), key: selected, gx, gy }]);
  }

  return (
    <main className="min-h-screen bg-[#080d16] p-4 text-[#d7f5a0]" style={{ fontFamily: '"Courier New", monospace' }}>
      <div className="mx-auto max-w-[1240px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2">
          <div><div className="text-sm font-bold">PIXELCHAT NATURE EDITOR</div><div className="text-xs text-[#6ee7d8]">MANUAL WORLD BUILDER // 24×24</div></div>
          <div className="flex gap-2 text-xs">
            <button className="border-2 border-[#324159] bg-[#d7f5a0] px-3 py-2 text-[#0b111c]" onClick={() => setTool("place")}>PLACE</button>
            <button className="border-2 border-[#324159] bg-[#0d1520] px-3 py-2" onClick={() => setTool("erase")}>ERASE</button>
            <button className="border-2 border-[#324159] bg-[#0d1520] px-3 py-2" onClick={() => localStorage.setItem(SAVE_KEY, JSON.stringify(objects))}>SAVE</button>
            <button className="border-2 border-[#324159] bg-[#0d1520] px-3 py-2" onClick={() => { if (confirm("Clear the Nature Editor world?")) setObjects([]); }}>CLEAR</button>
          </div>
        </header>
        <div className="grid gap-3 lg:grid-cols-[1fr_290px]">
          <section className="border-2 border-[#324159] bg-[#0b111c] p-2">
            <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="block w-full touch-none" style={{ imageRendering: "pixelated" }}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setPainting(true); edit(e); }}
              onPointerMove={(e) => { if (painting && tool === "place") edit(e); }}
              onPointerUp={() => setPainting(false)} onPointerLeave={() => setPainting(false)} />
          </section>
          <aside className="border-2 border-[#324159] bg-[#101826] p-3">
            <div className="mb-2 text-xs text-[#6ee7d8]">ASSET LIBRARY</div>
            <div className="mb-3 flex flex-wrap gap-1">{GROUPS.map((g) => <button key={g.label} className={`border px-2 py-1 text-[10px] ${group === g.label ? "bg-[#a9df5a] text-[#0b111c]" : "bg-[#0b111c]"}`} onClick={() => setGroup(g.label)}>{g.label}</button>)}</div>
            <div className="grid grid-cols-3 gap-2">{keys.map((key) => { const meta = NATURE_ASSETS[key]; return <button key={key} title={key} className={`flex h-20 items-center justify-center border-2 bg-[#0b111c] ${selected === key ? "border-[#d7f5a0]" : "border-[#324159]"}`} onClick={() => { setSelected(key); setTool("place"); }}><img src={meta.path} alt={key} style={{ imageRendering: "pixelated", maxWidth: 64, maxHeight: 64 }} /></button>; })}</div>
            <div className="mt-3 border-t border-[#324159] pt-3 text-[10px] leading-4 text-[#9eb0c8]">Selected: <span className="text-[#d7f5a0]">{selected}</span><br/>Tool: <span className="text-[#d7f5a0]">{tool}</span><br/>Objects: <span className="text-[#d7f5a0]">{objects.length}</span></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
