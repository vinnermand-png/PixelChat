import { useEffect, useMemo, useRef, useState } from "react";
import { NATURE_ASSETS, type NatureAssetKey } from "./naturePack";

const MAP_W = 1254;
const MAP_H = 1254;
const MAP_SRC = "/nature-test-map.png";
const SAVE_KEY = "pixelchat-nature-map-v1";

type Tool = "place" | "erase";
type Placement = { id: string; key: NatureAssetKey; x: number; y: number };
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

const cache = new Map<NatureAssetKey, HTMLImageElement>();
function getAsset(key: NatureAssetKey) {
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = NATURE_ASSETS[key].path;
    cache.set(key, img);
  }
  return img;
}

export default function NatureMapEditor() {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);
  const [objects, setObjects] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<NatureAssetKey>("grassMicro01");
  const [group, setGroup] = useState("GRASS");
  const [tool, setTool] = useState<Tool>("place");
  const [painting, setPainting] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const activeKeys = useMemo(() => GROUPS.find((g) => g.label === group)?.keys ?? [], [group]);

  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Placement[];
      if (Array.isArray(parsed)) setObjects(parsed);
    } catch {
      // Ignore malformed saved map objects.
    }
  }, []);

  const redraw = () => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    ctx.imageSmoothingEnabled = false;

    const ordered = [...objects].sort((a, b) => a.y - b.y);
    for (const obj of ordered) {
      const img = getAsset(obj.key);
      const meta = NATURE_ASSETS[obj.key];
      const draw = () => ctx.drawImage(img, Math.round(obj.x - meta.width / 2), Math.round(obj.y - meta.height), meta.width, meta.height);
      if (img.complete && img.naturalWidth > 0) draw();
      else img.onload = draw;
    }
  };

  useEffect(() => {
    if (mapReady) redraw();
  }, [objects, mapReady]);

  const mapPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (MAP_W / rect.width),
      y: (event.clientY - rect.top) * (MAP_H / rect.height),
    };
  };

  const hit = (x: number, y: number) => {
    for (const obj of [...objects].reverse()) {
      const meta = NATURE_ASSETS[obj.key];
      const left = obj.x - meta.width / 2;
      const top = obj.y - meta.height;
      if (x >= left && x <= left + meta.width && y >= top && y <= top + meta.height) return obj;
    }
    return null;
  };

  const editAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const p = mapPoint(event);
    if (!p || !mapReady) return;

    if (tool === "erase") {
      const existing = hit(p.x, p.y);
      if (existing) setObjects((items) => items.filter((item) => item.id !== existing.id));
      return;
    }

    if (hit(p.x, p.y)) return;
    setObjects((items) => [...items, { id: crypto.randomUUID(), key: selected, x: p.x, y: p.y }]);
  };

  const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(objects));
  const clear = () => {
    if (confirm("Clear all added game objects from this map?")) setObjects([]);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ map: MAP_SRC, width: MAP_W, height: MAP_H, objects }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pixelchat-nature-map.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPng = () => {
    const map = mapImageRef.current;
    if (!map || !mapReady) return;
    const out = document.createElement("canvas");
    out.width = MAP_W;
    out.height = MAP_H;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map, 0, 0, MAP_W, MAP_H);
    const overlay = overlayRef.current;
    if (overlay) ctx.drawImage(overlay, 0, 0, MAP_W, MAP_H);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = "pixelchat-nature-map-composite.png";
    a.click();
  };

  return (
    <main className="min-h-screen bg-[#080d16] p-4 text-[#d7f5a0]" style={{ fontFamily: '"Courier New", monospace' }}>
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2">
          <div>
            <div className="text-sm font-bold">PIXELCHAT NATURE WORLD MAP</div>
            <div className="text-xs text-[#6ee7d8]">FIXED GRAPHIC MAP // 1254×1254 // DYNAMIC GAME OBJECTS ON TOP</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button className={`border-2 px-3 py-2 ${tool === "place" ? "bg-[#d7f5a0] text-[#0b111c]" : "bg-[#0d1520]"}`} onClick={() => setTool("place")}>PLACE</button>
            <button className={`border-2 px-3 py-2 ${tool === "erase" ? "bg-[#f4d447] text-[#0b111c]" : "bg-[#0d1520]"}`} onClick={() => setTool("erase")}>ERASE</button>
            <button className="border-2 bg-[#0d1520] px-3 py-2" onClick={save}>SAVE</button>
            <button className="border-2 bg-[#0d1520] px-3 py-2" onClick={clear}>CLEAR</button>
            <button className="border-2 bg-[#a9df5a] px-3 py-2 text-[#0b111c]" onClick={exportPng}>EXPORT PNG</button>
            <button className="border-2 bg-[#0d1520] px-3 py-2" onClick={exportJson}>EXPORT JSON</button>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
          <section className="border-2 border-[#324159] bg-[#0b111c] p-2">
            <div className="relative mx-auto w-full max-w-[1254px] overflow-hidden">
              <img
                ref={mapImageRef}
                src={MAP_SRC}
                alt="PixelChat Nature World Map"
                className="block h-auto w-full select-none"
                draggable={false}
                onLoad={() => setMapReady(true)}
              />
              <canvas
                ref={overlayRef}
                width={MAP_W}
                height={MAP_H}
                className="absolute inset-0 h-full w-full touch-none"
                style={{ imageRendering: "pixelated", cursor: tool === "erase" ? "crosshair" : "cell" }}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setPainting(true); editAt(event); }}
                onPointerMove={(event) => { if (painting && tool === "place") editAt(event); }}
                onPointerUp={() => setPainting(false)}
                onPointerCancel={() => setPainting(false)}
              />
            </div>
          </section>

          <aside className="border-2 border-[#324159] bg-[#101826] p-3">
            <div className="mb-2 text-xs text-[#6ee7d8]">ASSET LIBRARY</div>
            <div className="mb-3 flex flex-wrap gap-1">
              {GROUPS.map((g) => (
                <button key={g.label} onClick={() => setGroup(g.label)} className={`border px-2 py-1 text-[10px] ${group === g.label ? "bg-[#a9df5a] text-[#0b111c]" : "bg-[#0b111c]"}`}>{g.label}</button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {activeKeys.map((key) => {
                const meta = NATURE_ASSETS[key];
                return (
                  <button key={key} title={key} onClick={() => { setSelected(key); setTool("place"); }} className={`flex h-20 items-center justify-center border-2 bg-[#0b111c] p-1 ${selected === key && tool === "place" ? "border-[#d7f5a0]" : "border-[#324159]"}`}>
                    <img src={meta.path} alt={key} style={{ imageRendering: "pixelated", maxWidth: 76, maxHeight: 76 }} />
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-[#324159] pt-3 text-[10px] leading-4 text-[#9eb0c8]">
              Selected: <span className="text-[#d7f5a0]">{selected}</span><br />
              Tool: <span className="text-[#d7f5a0]">{tool}</span><br />
              Objects: <span className="text-[#d7f5a0]">{objects.length}</span><br /><br />
              The uploaded map is the fixed world art. Place only dynamic gameplay objects on top of it.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
