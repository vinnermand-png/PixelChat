import { useEffect, useMemo, useRef, useState } from "react";
import { TH, TW, VIEW_H, VIEW_W, drawTorvetGround, iso, unIso } from "@/components/pixel/world";

type Mode = "empty" | "grass" | "test";
type Tool = "paint" | "fill" | "place" | "select" | "erase";
type Cat = "terrain" | "nature" | "building" | "furniture" | "character" | "effect";
type TerrainKey = "grass" | "dirt" | "stone" | "water" | "sand" | "moss" | "snow" | "forest";
type Settings = { grid: number; startMode: Mode; smoothing: boolean; snap: boolean };
type Obj = { id: string; assetId: string; gx: number; gy: number };
type Spec = { key: string; label: string; cat: Exclude<Cat, "terrain">; prompt: string; w: number; h: number };
type Asset = { id: string; title: string; image: string; spec: Spec };
type Draft = { id: string; v: number; spec: Spec; prompt: string };

const SK = "pixelchat-platform-settings-v3";
const PK = "pixelchat-project-v4";
const LK = "pixelchat-library-v6";
const CK = "pixelchat-ai-cache-v5";
const DEF: Settings = { grid: 14, startMode: "empty", smoothing: false, snap: true };

const TERRAIN: { key: TerrainKey; label: string; color: string; edge: string; hint: string }[] = [
  { key: "grass", label: "GRASS", color: "#4b922d", edge: "#6aaa3d", hint: "Default natural ground" },
  { key: "dirt", label: "DIRT", color: "#a96a2b", edge: "#c17d36", hint: "Paths and bare earth" },
  { key: "stone", label: "STONE GROUND", color: "#59606b", edge: "#737c88", hint: "Rocky floor" },
  { key: "water", label: "WATER", color: "#287fa3", edge: "#43a5c4", hint: "Water surface" },
  { key: "sand", label: "SAND", color: "#c9ad63", edge: "#e2c878", hint: "Beach and desert" },
  { key: "moss", label: "MOSS", color: "#356f3b", edge: "#4b944e", hint: "Dark natural ground" },
  { key: "snow", label: "SNOW", color: "#d7e4ee", edge: "#ffffff", hint: "Winter ground" },
  { key: "forest", label: "FOREST FLOOR", color: "#56452f", edge: "#745f42", hint: "Forest soil and leaves" },
];

const S: Spec[] = [
  { cat: "nature", key: "tree", label: "TREE", prompt: "A natural forest tree", w: 64, h: 96 },
  { cat: "nature", key: "pine", label: "PINE TREE", prompt: "A tall compact pine tree", w: 56, h: 96 },
  { cat: "nature", key: "bush", label: "BUSH", prompt: "A compact green forest bush", w: 48, h: 40 },
  { cat: "nature", key: "plant", label: "PLANT", prompt: "A small green plant", w: 28, h: 36 },
  { cat: "nature", key: "flower", label: "FLOWER", prompt: "A small wild flower", w: 22, h: 28 },
  { cat: "nature", key: "mushroom", label: "MUSHROOM", prompt: "A small forest mushroom", w: 24, h: 24 },
  { cat: "nature", key: "rock", label: "ROCK", prompt: "A compact natural grey rock", w: 36, h: 28 },
  { cat: "nature", key: "boulder", label: "BOULDER", prompt: "A rounded natural boulder", w: 48, h: 36 },
  { cat: "nature", key: "log", label: "LOG", prompt: "A fallen forest log", w: 48, h: 24 },
  { cat: "nature", key: "stump", label: "TREE STUMP", prompt: "A small cut tree stump", w: 34, h: 30 },
  { cat: "nature", key: "crystal", label: "CRYSTAL", prompt: "A small magical crystal", w: 34, h: 42 },
  { cat: "building", key: "house", label: "HOUSE", prompt: "A small cozy game house", w: 96, h: 96 },
  { cat: "building", key: "cabin", label: "CABIN", prompt: "A rustic wooden cabin", w: 96, h: 96 },
  { cat: "building", key: "shop", label: "SHOP", prompt: "A small fantasy shop", w: 96, h: 96 },
  { cat: "furniture", key: "table", label: "TABLE", prompt: "A simple wooden table", w: 44, h: 40 },
  { cat: "furniture", key: "chair", label: "CHAIR", prompt: "A simple wooden chair", w: 32, h: 46 },
  { cat: "furniture", key: "bed", label: "BED", prompt: "A cozy bed", w: 56, h: 40 },
  { cat: "character", key: "player", label: "PLAYER", prompt: "A friendly game player", w: 32, h: 48 },
  { cat: "character", key: "npc", label: "NPC", prompt: "A friendly town NPC", w: 32, h: 48 },
  { cat: "effect", key: "fire", label: "FIRE", prompt: "A small magical fire effect", w: 32, h: 44 },
  { cat: "effect", key: "smoke", label: "SMOKE", prompt: "A small pixel smoke effect", w: 32, h: 44 },
];

const FIRST = S[0];
const panel: React.CSSProperties = { background: "#151f2e", border: "2px solid #3b4c63" };
const heading: React.CSSProperties = { color: "#f2c34d", fontWeight: 900, letterSpacing: 1.2, margin: 0 };

function Button({ kind = "primary", active = false, children, style, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "nav" | "danger" | "success"; active?: boolean }) {
  const palette = {
    primary: { background: "#f6c431", color: "#111827", border: "#8f6c16" },
    nav: { background: active ? "#24384d" : "#172435", color: active ? "#ffffff" : "#d9e5f0", border: active ? "#47b9d0" : "#40546d" },
    danger: { background: "#8d3d35", color: "#fff3ef", border: "#d26b5f" },
    success: { background: "#176b61", color: "#e9fffb", border: "#45c7b5" },
  }[kind];
  return <button {...props} style={{ background: palette.background, color: palette.color, border: `2px solid ${palette.border}`, boxShadow: active ? "0 0 0 1px #f6c431" : "2px 2px #0b1320", padding: "11px 16px", minHeight: 42, fontFamily: "monospace", fontSize: 14, fontWeight: 900, letterSpacing: .4, cursor: "pointer", ...style }}>{children}</button>;
}

function cellKey(gx: number, gy: number) { return `${gx},${gy}`; }
function allCells(grid: number, terrain: TerrainKey) {
  const out: Record<string, TerrainKey> = {};
  for (let gx = 0; gx < grid; gx++) for (let gy = 0; gy < grid; gy++) out[cellKey(gx, gy)] = terrain;
  return out;
}

function normalize(src: string, s: Spec): Promise<string> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => {
      try {
        const c = document.createElement("canvas");
        const x = c.getContext("2d", { willReadFrequently: true });
        if (!x) throw Error("Canvas unavailable");
        c.width = i.naturalWidth; c.height = i.naturalHeight; x.drawImage(i, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let minX = c.width, minY = c.height, maxX = -1, maxY = -1, solid = 0, edge = 0;
        for (let y = 0; y < c.height; y++) for (let px = 0; px < c.width; px++) {
          const alpha = d[(y * c.width + px) * 4 + 3];
          if (alpha > 16) { solid++; if (px < 2 || y < 2 || px > c.width - 3 || y > c.height - 3) edge++; minX = Math.min(minX, px); minY = Math.min(minY, y); maxX = Math.max(maxX, px); maxY = Math.max(maxY, y); }
        }
        if (maxX < minX || edge / Math.max(1, solid) >= .03) throw Error("Validation failed: background must be transparent");
        const cw = maxX - minX + 1, ch = maxY - minY + 1;
        const t = document.createElement("canvas"); const z = t.getContext("2d");
        if (!z) throw Error("Canvas unavailable");
        t.width = s.w; t.height = s.h; z.imageSmoothingEnabled = false;
        const scale = Math.min((s.w - 2) / cw, (s.h - 2) / ch);
        const w = Math.round(cw * scale), h = Math.round(ch * scale);
        z.drawImage(c, minX, minY, cw, ch, Math.round((s.w - w) / 2), s.h - h, w, h);
        resolve(t.toDataURL("image/png"));
      } catch (e) { reject(e); }
    };
    i.onerror = () => reject(Error("Image load failed"));
    i.src = src;
  });
}

export default function GameMaker() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const imgs = useRef<Record<string, HTMLImageElement>>({});
  const [settings, setSettings] = useState<Settings>(DEF);
  const [ready, setReady] = useState(false);
  const [objects, setObjects] = useState<Obj[]>([]);
  const [library, setLibrary] = useState<Asset[]>([]);
  const [terrain, setTerrain] = useState<Record<string, TerrainKey>>({});
  const [tool, setTool] = useState<Tool>("paint");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainKey>("grass");
  const [hover, setHover] = useState<{ gx: number; gy: number } | null>(null);
  const [status, setStatus] = useState("READY · CLEAN PROJECT · CHOOSE TERRAIN OR GENERATE AN ASSET");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [factory, setFactory] = useState(false);
  const [cat, setCat] = useState<Exclude<Cat, "terrain">>("nature");
  const [specKey, setSpecKey] = useState(FIRST.key);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState(FIRST.prompt);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [real, setReal] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const spec = S.find(x => x.key === specKey) || FIRST;
  const visible = useMemo(() => S.filter(x => x.cat === cat && x.label.toLowerCase().includes(search.toLowerCase())), [cat, search]);
  const draft = drafts.find(x => x.id === pick) || null;
  const activeTerrain = TERRAIN.find(x => x.key === selectedTerrain)!;

  const cacheImage = (id: string, src: string) => {
    const i = new Image(); i.onload = draw; i.src = src; imgs.current[id] = i;
  };

  useEffect(() => {
    try {
      const savedSettings = JSON.parse(localStorage.getItem(SK) || "null");
      const savedProject = JSON.parse(localStorage.getItem(PK) || "null");
      const savedLibrary = JSON.parse(localStorage.getItem(LK) || "[]");
      if (savedSettings) setSettings({ ...DEF, ...savedSettings });
      if (savedProject?.objects) setObjects(savedProject.objects);
      if (savedProject?.terrain) setTerrain(savedProject.terrain);
      if (Array.isArray(savedLibrary)) { setLibrary(savedLibrary); savedLibrary.forEach((a: Asset) => cacheImage(a.id, a.image)); }
    } catch { /* start clean if local storage is invalid */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SK, JSON.stringify(settings));
    localStorage.setItem(PK, JSON.stringify({ objects, terrain }));
    localStorage.setItem(LK, JSON.stringify(library));
  }, [settings, objects, terrain, library, ready]);

  function drawTile(x: CanvasRenderingContext2D, gx: number, gy: number, type: TerrainKey | undefined) {
    const p = iso(gx, gy);
    const t = TERRAIN.find(q => q.key === type);
    x.beginPath();
    x.moveTo(p.x, p.y); x.lineTo(p.x + TW / 2, p.y + TH / 2); x.lineTo(p.x, p.y + TH); x.lineTo(p.x - TW / 2, p.y + TH / 2); x.closePath();
    if (t) { x.fillStyle = t.color; x.fill(); }
    x.strokeStyle = t ? t.edge : "#26354a";
    x.lineWidth = 1; x.stroke();
    if (t && (gx + gy) % 3 === 0) {
      x.fillStyle = t.edge; x.fillRect(Math.round(p.x - 2), Math.round(p.y + TH / 2), 2, 2);
    }
  }

  function draw() {
    const c = ref.current; const x = c?.getContext("2d"); if (!c || !x) return;
    x.imageSmoothingEnabled = false; x.fillStyle = "#101827"; x.fillRect(0, 0, VIEW_W, VIEW_H);
    if (settings.startMode === "test" && Object.keys(terrain).length === 0) drawTorvetGround(x);
    else for (let gx = 0; gx < settings.grid; gx++) for (let gy = 0; gy < settings.grid; gy++) drawTile(x, gx, gy, terrain[cellKey(gx, gy)]);
    [...objects].sort((a, b) => a.gx + a.gy - b.gx - b.gy).forEach(o => {
      const a = library.find(q => q.id === o.assetId); const i = imgs.current[o.assetId];
      if (a && i?.complete) { const p = iso(o.gx, o.gy); x.drawImage(i, p.x - a.spec.w / 2, p.y + TH - a.spec.h, a.spec.w, a.spec.h); }
    });
    if (hover) { const p = iso(hover.gx, hover.gy); x.strokeStyle = "#f6c431"; x.lineWidth = 2; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + TW / 2, p.y + TH / 2); x.lineTo(p.x, p.y + TH); x.lineTo(p.x - TW / 2, p.y + TH / 2); x.closePath(); x.stroke(); }
  }
  useEffect(draw, [objects, library, terrain, settings, hover]);

  function cell(ev: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current; if (!c) return null;
    const r = c.getBoundingClientRect(); const u = unIso((ev.clientX - r.left) / r.width * VIEW_W, (ev.clientY - r.top) / r.height * VIEW_H);
    const gx = Math.round(u.gx), gy = Math.round(u.gy);
    return gx < 0 || gy < 0 || gx >= settings.grid || gy >= settings.grid ? null : { gx, gy };
  }

  function onCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = cell(e); setHover(p); if (!p) return;
    const key = cellKey(p.gx, p.gy);
    if (tool === "paint") { setTerrain(v => ({ ...v, [key]: selectedTerrain })); setStatus(`PAINTED ${activeTerrain.label} · GRID ${p.gx}, ${p.gy}`); return; }
    if (tool === "fill") { setTerrain(allCells(settings.grid, selectedTerrain)); setStatus(`FILLED WORLD WITH ${activeTerrain.label}`); return; }
    if (tool === "erase") { setObjects(v => v.filter(o => o.gx !== p.gx || o.gy !== p.gy)); setTerrain(v => { const n = { ...v }; delete n[key]; return n; }); setStatus(`ERASED GRID ${p.gx}, ${p.gy}`); return; }
    if (tool === "place") { if (!selectedAsset) { setStatus("SELECT A VALIDATED OBJECT ASSET FIRST"); return; } setObjects(v => [...v, { id: `o-${Date.now()}`, assetId: selectedAsset, gx: p.gx, gy: p.gy }]); setStatus(`PLACED OBJECT · GRID ${p.gx}, ${p.gy}`); return; }
    setStatus(`SELECTED GRID ${p.gx}, ${p.gy}`);
  }

  function resetFactory() { setDrafts([]); setPick(null); setReal(null); setError(""); }
  function choose(s: Spec) { setSpecKey(s.key); setPrompt(s.prompt); resetFactory(); }
  function blueprints() {
    const notes = ["compact readable silhouette", "balanced proportions", "more organic shape", "strongest game-readable silhouette"];
    const ds = notes.map((n, v) => ({ id: `d-${Date.now()}-${v}`, v: v + 1, spec, prompt: `${prompt.trim() || spec.prompt}. ${n}.` }));
    setDrafts(ds); setPick(ds[0].id); setReal(null); setError("");
  }
  async function generate() {
    if (!draft) return; setGenerating(true); setError(""); setReal(null);
    try {
      const key = `${draft.spec.key}|${draft.prompt}`; const saved = JSON.parse(localStorage.getItem(CK) || "{}");
      if (saved[key]) { setReal(saved[key]); return; }
      const r = await fetch("/api/generate-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: draft.prompt }) });
      const j = await r.json(); if (!r.ok) throw Error(j.error || "Generation failed");
      const out = await normalize(`data:image/png;base64,${j.imageBase64}`, draft.spec); saved[key] = out; localStorage.setItem(CK, JSON.stringify(saved)); setReal(out);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setGenerating(false); }
  }
  function accept() {
    if (!draft || !real) return;
    const id = `ai-${Date.now()}`; const a: Asset = { id, title: `${draft.spec.label} VARIANT ${String(draft.v).padStart(2, "0")}`, image: real, spec: draft.spec };
    setLibrary(v => [a, ...v]); cacheImage(id, real); setSelectedAsset(id); setFactory(false); setStatus(`IMPORTED · ${a.title} · ${a.spec.w} × ${a.spec.h}`); resetFactory();
  }
  function newProject() {
    if (confirm("Start a completely clean project? This clears terrain, placed objects and AI library.")) {
      setObjects([]); setTerrain({}); setLibrary([]); imgs.current = {}; setSelectedAsset(""); setTool("paint"); setStatus("READY · NEW CLEAN PROJECT · OBJECTS 0 · TERRAIN 0 · ASSETS 0");
    }
  }
  function startMode(mode: Mode) {
    setSettings(v => ({ ...v, startMode: mode }));
    if (mode === "empty") setTerrain({});
    if (mode === "grass") setTerrain(allCells(settings.grid, "grass"));
    setStatus(mode === "grass" ? "NEW GRASS WORLD READY" : mode === "empty" ? "EMPTY WORLD READY" : "TEST WORLD MODE READY");
    setSettingsOpen(false);
  }

  return <div style={{ minHeight: "100vh", background: "#0b1320", color: "#dce7f2", fontFamily: "monospace", padding: 10 }}>
    <header style={{ ...panel, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, marginBottom: 10 }}>
      <div><div style={{ fontSize: 30, fontWeight: 900, color: "#f0c14b" }}>PIXEL<span style={{ color: "#47b9d0" }}>GAME</span> MAKER</div><div style={{ color: "#aab8c8", marginTop: 5 }}>PIXELCHAT PLATFORM V1 · PRECISION EDITOR · ASSET CONTRACT SYSTEM</div></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Button onClick={newProject}>＋ NEW</Button><Button kind="nav" onClick={() => setSettingsOpen(true)}>⚙ SETTINGS</Button><Button kind="nav" onClick={() => setFactory(true)}>✦ AI FACTORY</Button><Button kind="success" onClick={() => { localStorage.setItem(PK, JSON.stringify({ objects, terrain })); setStatus("PROJECT SAVED"); }}>SAVE</Button><Button kind="danger" onClick={() => { if (confirm("Clear the current world?")) { setObjects([]); setTerrain({}); setStatus("WORLD CLEARED"); } }}>CLEAR</Button><Button kind="nav">▶ PLAY</Button>
      </div>
    </header>

    <main style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 290px", gap: 10 }}>
      <aside style={{ ...panel, padding: 10 }}>
        <h2 style={{ ...heading, fontSize: 17 }}>FOUNDATION TERRAIN</h2>
        <div style={{ color: "#8fa2b7", fontSize: 12, margin: "7px 0 10px" }}>PAINT THE WORLD BEFORE PLACING OBJECTS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {TERRAIN.map(t => <button key={t.key} onClick={() => { setSelectedTerrain(t.key); setTool("paint"); }} style={{ textAlign: "left", padding: 10, background: selectedTerrain === t.key ? "#2a3d50" : "#101827", color: "#e6edf5", border: `2px solid ${selectedTerrain === t.key ? "#f0c14b" : "#40546d"}`, fontFamily: "monospace", fontWeight: 900, cursor: "pointer" }}><span style={{ display: "inline-block", width: 12, height: 12, background: t.color, border: "1px solid #d9e5f0", marginRight: 7, verticalAlign: "middle" }} />{t.label}</button>)}
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #405067" }}>
          <h2 style={{ ...heading, fontSize: 17 }}>VALIDATED ASSETS <Button kind="nav" style={{ float: "right", minHeight: 30, padding: "4px 9px", fontSize: 12 }} onClick={() => setFactory(true)}>＋ AI</Button></h2>
          {library.length === 0 ? <div style={{ color: "#8fa2b7", padding: 14, border: "1px dashed #46566c", textAlign: "center", marginTop: 10 }}>NO OBJECT ASSETS YET<br />GENERATE ONLY WHAT YOU NEED</div> : library.map(a => <button key={a.id} onClick={() => { setSelectedAsset(a.id); setTool("place"); }} style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", padding: 7, marginTop: 8, background: "#101827", color: "#dce7f2", border: `2px solid ${selectedAsset === a.id ? "#f0c14b" : "#42536b"}`, fontFamily: "monospace", cursor: "pointer", textAlign: "left" }}><img src={a.image} style={{ width: 42, height: 42, objectFit: "contain", imageRendering: "pixelated" }} /><span>{a.title}<small style={{ display: "block", color: "#55c4d7", marginTop: 4 }}>✓ {a.spec.w} × {a.spec.h} VALIDATED</small></span></button>)}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #405067" }}><h2 style={{ ...heading, fontSize: 17, marginBottom: 9 }}>TOOLS</h2>
          <div style={{ display: "grid", gap: 7 }}>
            <Button kind="nav" active={tool === "paint"} onClick={() => setTool("paint")}>🖌 PAINT TILE</Button>
            <Button kind="nav" active={tool === "fill"} onClick={() => setTool("fill")}>🪣 FILL WORLD</Button>
            <Button kind="nav" active={tool === "place"} onClick={() => setTool("place")}>＋ PLACE OBJECT</Button>
            <Button kind="nav" active={tool === "select"} onClick={() => setTool("select")}>↖ SELECT</Button>
            <Button kind="danger" active={tool === "erase"} onClick={() => setTool("erase")}>ERASE</Button>
          </div>
        </div>
      </aside>

      <section style={{ ...panel, padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#aab8c8", padding: "3px 0 9px", gap: 12 }}><b>LIVE ISO WORLD · {Object.keys(terrain).length === 0 ? "EMPTY" : "TERRAIN ACTIVE"}</b><b>{tool.toUpperCase()} · {tool === "paint" || tool === "fill" ? activeTerrain.label : "OBJECT MODE"}</b></div>
        <canvas ref={ref} width={VIEW_W} height={VIEW_H} onPointerMove={e => setHover(cell(e))} onPointerLeave={() => setHover(null)} onPointerDown={onCanvas} style={{ width: "100%", height: "auto", border: "2px solid #3b4c63", display: "block", cursor: tool === "paint" || tool === "fill" ? "crosshair" : "pointer", imageRendering: "pixelated" }} />
        <div style={{ color: "#aab8c8", paddingTop: 10 }}>{status}</div>
      </section>

      <aside style={{ ...panel, padding: 14 }}><h2 style={{ ...heading, fontSize: 18 }}>PLATFORM INSPECTOR</h2><div style={{ display: "grid", gap: 11, marginTop: 15, color: "#aab8c8" }}>
        <div><b>TILE</b><br /><span style={{ color: "#e7eef6" }}>32 × 16 PX</span></div><div><b>GRID</b><br /><span style={{ color: "#e7eef6" }}>{settings.grid} × {settings.grid}</span></div><div><b>WORLD FOUNDATION</b><br /><span style={{ color: Object.keys(terrain).length ? "#56c7b7" : "#aab8c8" }}>{Object.keys(terrain).length ? "ACTIVE" : "EMPTY"}</span></div><div><b>RENDERING</b><br /><span style={{ color: "#e7eef6" }}>PIXEL PERFECT</span></div><div><b>SMOOTHING</b><br /><span style={{ color: "#e7eef6" }}>{settings.smoothing ? "ON" : "OFF"}</span></div><hr style={{ width: "100%", borderColor: "#405067" }} /><div><b>OBJECTS</b><br /><span style={{ color: "#e7eef6" }}>{objects.length}</span></div><div><b>AI LIBRARY</b><br /><span style={{ color: "#e7eef6" }}>{library.length}</span></div><div><b>TERRAIN TILES</b><br /><span style={{ color: "#e7eef6" }}>{Object.keys(terrain).length}</span></div>
      </div></aside>
    </main>

    {settingsOpen && <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(4,8,14,.82)", display: "grid", placeItems: "center", padding: 16 }}><div style={{ ...panel, width: "min(760px,100%)", padding: 22 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h2 style={heading}>PLATFORM SETTINGS</h2><Button kind="nav" onClick={() => setSettingsOpen(false)}>CLOSE</Button></div><p style={{ color: "#aab8c8" }}>Choose how a new world should start. You can always paint terrain manually afterwards.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}><Button kind="nav" active={settings.startMode === "empty"} onClick={() => startMode("empty")}>EMPTY WORLD<br /><small>GRID ONLY</small></Button><Button kind="nav" active={settings.startMode === "grass"} onClick={() => startMode("grass")}>GRASS WORLD<br /><small>FOUNDATION READY</small></Button><Button kind="nav" active={settings.startMode === "test"} onClick={() => startMode("test")}>TEST MAP<br /><small>DEV ONLY</small></Button></div><div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><label>GRID SIZE <input type="number" min={8} max={30} value={settings.grid} onChange={e => setSettings(v => ({ ...v, grid: Math.max(8, Math.min(30, Number(e.target.value) || 14)) }))} style={{ marginLeft: 8, width: 70, padding: 9, background: "#101827", color: "white", border: "1px solid #40546d", fontFamily: "monospace" }} /></label><label><input type="checkbox" checked={settings.snap} onChange={e => setSettings(v => ({ ...v, snap: e.target.checked }))} /> GRID SNAP</label><label><input type="checkbox" checked={settings.smoothing} onChange={e => setSettings(v => ({ ...v, smoothing: e.target.checked }))} /> IMAGE SMOOTHING</label></div></div></div>}

    {factory && <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(4,8,14,.92)", overflow: "auto", padding: 18 }}><div style={{ ...panel, maxWidth: 1320, margin: "0 auto", padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><h1 style={{ ...heading, fontSize: 27 }}>AI ASSET FACTORY</h1><div style={{ color: "#aab8c8" }}>GENERATE ONLY THE OBJECT YOU NEED · PLATFORM SIZE IS LOCKED AUTOMATICALLY</div></div><Button kind="nav" onClick={() => { setFactory(false); resetFactory(); }}>CLOSE</Button></div><div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, marginTop: 18 }}><aside style={{ ...panel, padding: 12 }}><h3 style={heading}>1. PICK ASSET TYPE</h3>{(["nature", "building", "furniture", "character", "effect"] as const).map(c => <Button key={c} kind="nav" active={cat === c} onClick={() => { setCat(c); setSearch(""); const first = S.find(x => x.cat === c) || FIRST; choose(first); }} style={{ width: "100%", marginTop: 7 }}>{c.toUpperCase()}</Button>)}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH..." style={{ width: "100%", boxSizing: "border-box", marginTop: 14, padding: 11, background: "#101827", color: "white", border: "1px solid #40546d", fontFamily: "monospace" }} />{visible.map(s => <button key={s.key} onClick={() => choose(s)} style={{ width: "100%", textAlign: "left", padding: 10, marginTop: 7, background: specKey === s.key ? "#2a3d50" : "#101827", color: "#e6edf5", border: `2px solid ${specKey === s.key ? "#f0c14b" : "#40546d"}`, fontFamily: "monospace", fontWeight: 900, cursor: "pointer" }}>{s.label}</button>)}</aside><section><h3 style={heading}>2. DESCRIBE THE ASSET</h3><textarea value={prompt} onChange={e => { setPrompt(e.target.value); resetFactory(); }} rows={6} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 13, background: "#101827", color: "#eef5fb", border: "2px solid #40546d", fontFamily: "monospace", fontSize: 14 }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}><div style={{ ...panel, padding: 12 }}><b style={heading}>AUTOMATIC CONTRACT</b><br /><span style={{ color: "#aab8c8" }}>{spec.label} · {spec.w} × {spec.h} PX<br />CRISP PIXELS · NO ANTI-ALIASING<br />TRANSPARENT RGBA · AUTO ANCHOR</span></div><div style={{ ...panel, padding: 12 }}><b style={heading}>CREDIT PROTECTION</b><br /><span style={{ color: "#aab8c8" }}>BLUEPRINTS ARE FREE<br />ONLY ONE APPROVED VARIANT USES IMAGE GENERATION<br />SAME PROMPT USES LOCAL CACHE</span></div></div><Button onClick={blueprints} style={{ width: "100%", marginTop: 10 }}>GENERATE 4 BLUEPRINTS</Button></section></div>{drafts.length > 0 && <section style={{ marginTop: 18, borderTop: "2px solid #405067", paddingTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><div><h2 style={heading}>GENERATED BLUEPRINTS</h2><div style={{ color: "#aab8c8" }}>FREE TEXT BLUEPRINTS · CHOOSE ONE BEFORE A REAL IMAGE IS GENERATED</div></div><Button kind="success" disabled={!draft} onClick={generate}>{generating ? "GENERATING..." : "GENERATE SELECTED IMAGE"}</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}>{drafts.map(d => <button key={d.id} onClick={() => { setPick(d.id); setReal(null); setError(""); }} style={{ minHeight: 170, padding: 14, background: pick === d.id ? "#22384b" : "#101827", color: "#dce7f2", border: `2px solid ${pick === d.id ? "#f0c14b" : "#40546d"}`, fontFamily: "monospace", cursor: "pointer", textAlign: "left" }}><b style={{ color: "#f0c14b" }}>{spec.label} VARIANT {String(d.v).padStart(2, "0")}</b><div style={{ marginTop: 14, color: "#aab8c8" }}>{["COMPACT SILHOUETTE", "BALANCED PROPORTIONS", "MORE ORGANIC SHAPE", "STRONGEST READABILITY"][d.v - 1]}</div><div style={{ marginTop: 22, color: "#56c7b7" }}>✓ PLATFORM COMPATIBLE</div></button>)}</div>{error && <div style={{ color: "#ff9a8e", marginTop: 12 }}>{error}</div>}{real && <div style={{ ...panel, marginTop: 16, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div><h2 style={heading}>REAL GENERATED ASSET</h2><div style={{ color: "#aab8c8" }}>VALIDATED TO {draft?.spec.w} × {draft?.spec.h} PX BEFORE IMPORT</div></div><Button kind="success" onClick={accept}>ACCEPT TO LIBRARY</Button></div><div style={{ minHeight: 300, display: "grid", placeItems: "center", border: "1px solid #40546d", marginTop: 12 }}><img src={real} style={{ maxWidth: "70%", maxHeight: 380, imageRendering: "pixelated" }} /></div></div>}</section>}</div></div>}
  </div>;
}
