import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { TH, TW, VIEW_H, VIEW_W, drawTorvetGround, iso, unIso } from "@/components/pixel/world";

type Mode = "empty" | "grass" | "test";
type Tool = "paint" | "fill" | "place" | "select" | "erase";
type Cat = "nature" | "building" | "furniture" | "character" | "effect";
type TerrainKey = string;
type Settings = { grid: number; startMode: Mode; smoothing: boolean; snap: boolean };
type Obj = { id: string; assetId: string; gx: number; gy: number };
type Spec = { key: string; label: string; cat: Cat; prompt: string; w: number; h: number };
type Asset = { id: string; title: string; image: string; spec: Spec };
type Draft = { id: string; v: number; label: string; prompt: string };
type TerrainDef = { key: string; label: string; color: string; edge: string; hint: string; image?: string; ai?: boolean };

const SK = "pixelchat-platform-settings-v5";
const PK = "pixelchat-project-v6";
const LK = "pixelchat-library-v7";
const TK = "pixelchat-foundation-library-v2";
const CK = "pixelchat-ai-cache-v7";
const DEF: Settings = { grid: 14, startMode: "empty", smoothing: false, snap: true };

const BUILTIN_TERRAIN: TerrainDef[] = [
  { key: "grass", label: "GRASS", color: "#4b922d", edge: "#6aaa3d", hint: "Default natural ground" },
  { key: "dirt", label: "DIRT", color: "#a96a2b", edge: "#c17d36", hint: "Paths and bare earth" },
  { key: "stone", label: "STONE GROUND", color: "#59606b", edge: "#737c88", hint: "Rocky floor" },
  { key: "water", label: "WATER", color: "#287fa3", edge: "#43a5c4", hint: "Water surface" },
  { key: "sand", label: "SAND", color: "#c9ad63", edge: "#e2c878", hint: "Beach and desert" },
  { key: "moss", label: "MOSS", color: "#356f3b", edge: "#4b944e", hint: "Dark natural ground" },
  { key: "snow", label: "SNOW", color: "#d7e4ee", edge: "#ffffff", hint: "Winter ground" },
  { key: "forest", label: "FOREST FLOOR", color: "#56452f", edge: "#745f42", hint: "Forest soil and leaves" },
];

const FOUNDATION_PRESETS = [
  ["grass", "GRASS", "Fresh green fantasy grass with subtle natural pixel variation"],
  ["dirt", "DIRT", "Warm brown packed earth with subtle natural pixel texture"],
  ["water", "WATER", "Clear blue water with small readable pixel ripples"],
  ["stone", "STONE", "Grey stone ground with readable pixel rock variation"],
  ["sand", "SAND", "Warm sand with subtle pixel grain variation"],
  ["snow", "SNOW", "Clean snow with gentle blue pixel shading"],
  ["moss", "MOSS", "Dark green moss with organic pixel texture"],
  ["custom", "CUSTOM FOUNDATION", "Custom PixelChat terrain texture"],
] as const;

const SPECS: Spec[] = [
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
  { cat: "building", key: "house", label: "HOUSE", prompt: "A small cozy game house", w: 96, h: 96 },
  { cat: "building", key: "cabin", label: "CABIN", prompt: "A rustic wooden cabin", w: 96, h: 96 },
  { cat: "furniture", key: "table", label: "TABLE", prompt: "A simple wooden table", w: 44, h: 40 },
  { cat: "furniture", key: "chair", label: "CHAIR", prompt: "A simple wooden chair", w: 32, h: 46 },
  { cat: "character", key: "player", label: "PLAYER", prompt: "A friendly game player", w: 32, h: 48 },
  { cat: "character", key: "npc", label: "NPC", prompt: "A friendly town NPC", w: 32, h: 48 },
  { cat: "effect", key: "fire", label: "FIRE", prompt: "A small magical fire effect", w: 32, h: 44 },
];

const FIRST = SPECS[0];
const panel: CSSProperties = { background: "#151f2e", border: "2px solid #3b4c63" };
const heading: CSSProperties = { color: "#f2c34d", fontWeight: 900, letterSpacing: 1.2, margin: 0 };
const FOUNDATION_TEXTURE_SIZE = 128;

function Button({ kind = "primary", active = false, children, style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "nav" | "danger" | "success"; active?: boolean }) {
  const p = {
    primary: ["#f6c431", "#111827", "#8f6c16"],
    nav: [active ? "#24384d" : "#172435", active ? "#ffffff" : "#d9e5f0", active ? "#47b9d0" : "#40546d"],
    danger: ["#8d3d35", "#fff3ef", "#d26b5f"],
    success: ["#176b61", "#e9fffb", "#45c7b5"],
  }[kind];
  return <button {...props} style={{ background: p[0], color: p[1], border: `2px solid ${p[2]}`, boxShadow: active ? "0 0 0 1px #f6c431" : "2px 2px #0b1320", padding: "11px 16px", minHeight: 42, fontFamily: "monospace", fontSize: 14, fontWeight: 900, letterSpacing: .4, cursor: "pointer", ...style }}>{children}</button>;
}

const cellKey = (gx: number, gy: number) => `${gx},${gy}`;
function allCells(grid: number, terrain: TerrainKey) { const out: Record<string, TerrainKey> = {}; for (let x = 0; x < grid; x++) for (let y = 0; y < grid; y++) out[cellKey(x, y)] = terrain; return out; }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(Error("Image load failed")); i.src = src; }); }

async function normalizeObject(src: string, s: Spec) {
  const i = await loadImage(src), c = document.createElement("canvas"), x = c.getContext("2d", { willReadFrequently: true });
  if (!x) throw Error("Canvas unavailable");
  c.width = i.naturalWidth; c.height = i.naturalHeight; x.drawImage(i, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) for (let px = 0; px < c.width; px++) if (d[(y * c.width + px) * 4 + 3] > 16) { minX = Math.min(minX, px); minY = Math.min(minY, y); maxX = Math.max(maxX, px); maxY = Math.max(maxY, y); }
  if (maxX < minX) throw Error("Validation failed: asset is empty");
  const cw = maxX - minX + 1, ch = maxY - minY + 1, t = document.createElement("canvas"), z = t.getContext("2d");
  if (!z) throw Error("Canvas unavailable");
  t.width = s.w; t.height = s.h; z.imageSmoothingEnabled = false;
  const scale = Math.min((s.w - 2) / cw, (s.h - 2) / ch), w = Math.round(cw * scale), h = Math.round(ch * scale);
  z.drawImage(c, minX, minY, cw, ch, Math.round((s.w - w) / 2), s.h - h, w, h);
  return t.toDataURL("image/png");
}

function validateFoundationPixels(c: HTMLCanvasElement) {
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) return { ok: false, message: "Canvas unavailable" };
  const { data, width, height } = x.getImageData(0, 0, c.width, c.height);
  let transparent = 0, borderLight = 0, borderCount = 0;
  for (let y = 0; y < height; y++) for (let px = 0; px < width; px++) {
    const n = (y * width + px) * 4, a = data[n + 3];
    if (a < 245) transparent++;
    if (px === 0 || y === 0 || px === width - 1 || y === height - 1) {
      borderCount++;
      if (data[n] > 238 && data[n + 1] > 238 && data[n + 2] > 238) borderLight++;
    }
  }
  if (transparent / (width * height) > .02) return { ok: false, message: "Rejected: foundation has transparent background. Foundations must be fully filled." };
  if (borderLight / Math.max(1, borderCount) > .35) return { ok: false, message: "Rejected: suspicious white border detected. Regenerate a full edge-to-edge terrain texture." };
  return { ok: true, message: "Foundation texture validated" };
}

async function normalizeFoundation(src: string) {
  const i = await loadImage(src), t = document.createElement("canvas"), x = t.getContext("2d");
  if (!x) throw Error("Canvas unavailable");
  t.width = FOUNDATION_TEXTURE_SIZE; t.height = FOUNDATION_TEXTURE_SIZE; x.imageSmoothingEnabled = false;
  const side = Math.min(i.naturalWidth, i.naturalHeight);
  const sx = Math.floor((i.naturalWidth - side) / 2), sy = Math.floor((i.naturalHeight - side) / 2);
  x.drawImage(i, sx, sy, side, side, 0, 0, FOUNDATION_TEXTURE_SIZE, FOUNDATION_TEXTURE_SIZE);
  const check = validateFoundationPixels(t);
  if (!check.ok) throw Error(check.message);
  return t.toDataURL("image/png");
}

function foundationContract() {
  return `Generate ONLY a seamless repeating pixel-art terrain texture for the PixelChat game world. This is NOT an object and NOT an isometric tile. STRICT RULES: fill the entire image edge-to-edge; seamless repeating texture; no border; no outline; no frame; no white lines; no empty background; no transparent background; no diamond shape; no isometric tile shape; no visible tile boundaries; no objects; no trees; no rocks unless explicitly requested; no characters; no UI; no text. The PixelGame Maker will automatically map this texture across the complete isometric world. Create crisp game-ready pixel art with no anti-aliasing.`;
}

export default function GameMaker() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const imgs = useRef<Record<string, HTMLImageElement>>({});
  const terrainImgs = useRef<Record<string, HTMLImageElement>>({});
  const patterns = useRef<Record<string, CanvasPattern | null>>({});
  const [settings, setSettings] = useState<Settings>(DEF), [ready, setReady] = useState(false), [objects, setObjects] = useState<Obj[]>([]), [library, setLibrary] = useState<Asset[]>([]), [customTerrain, setCustomTerrain] = useState<TerrainDef[]>([]), [terrain, setTerrain] = useState<Record<string, TerrainKey>>({}), [tool, setTool] = useState<Tool>("paint"), [selectedAsset, setSelectedAsset] = useState(""), [selectedTerrain, setSelectedTerrain] = useState<TerrainKey>("grass"), [hover, setHover] = useState<{ gx: number; gy: number } | null>(null), [status, setStatus] = useState("READY · CLEAN PROJECT · CHOOSE TERRAIN OR GENERATE AN ASSET"), [settingsOpen, setSettingsOpen] = useState(false), [factory, setFactory] = useState(false), [factoryKind, setFactoryKind] = useState<"object" | "foundation">("object"), [cat, setCat] = useState<Cat>("nature"), [specKey, setSpecKey] = useState(FIRST.key), [foundationKey, setFoundationKey] = useState("grass"), [search, setSearch] = useState(""), [prompt, setPrompt] = useState(FIRST.prompt), [drafts, setDrafts] = useState<Draft[]>([]), [pick, setPick] = useState<string | null>(null), [real, setReal] = useState<string | null>(null), [generating, setGenerating] = useState(false), [error, setError] = useState("");
  const spec = SPECS.find(s => s.key === specKey) || FIRST;
  const allTerrain = useMemo(() => [...BUILTIN_TERRAIN, ...customTerrain], [customTerrain]);
  const activeTerrain = allTerrain.find(t => t.key === selectedTerrain) || BUILTIN_TERRAIN[0];
  const visible = useMemo(() => SPECS.filter(s => s.cat === cat && s.label.toLowerCase().includes(search.toLowerCase())), [cat, search]);
  const draft = drafts.find(d => d.id === pick) || null;

  const cacheObject = (id: string, src: string) => { const i = new Image(); i.onload = draw; i.src = src; imgs.current[id] = i; };
  const cacheTerrain = (id: string, src: string) => { const i = new Image(); i.onload = () => { delete patterns.current[id]; draw(); }; i.src = src; terrainImgs.current[id] = i; };

  useEffect(() => {
    try {
      const ss = JSON.parse(localStorage.getItem(SK) || localStorage.getItem("pixelchat-platform-settings-v4") || "null");
      const sp = JSON.parse(localStorage.getItem(PK) || localStorage.getItem("pixelchat-project-v5") || "null");
      const sl = JSON.parse(localStorage.getItem(LK) || "[]");
      const st = JSON.parse(localStorage.getItem(TK) || localStorage.getItem("pixelchat-foundation-library-v1") || "[]");
      if (ss) setSettings({ ...DEF, ...ss });
      if (sp?.objects) setObjects(sp.objects);
      if (sp?.terrain) setTerrain(sp.terrain);
      if (Array.isArray(sl)) { setLibrary(sl); sl.forEach((a: Asset) => cacheObject(a.id, a.image)); }
      if (Array.isArray(st)) { setCustomTerrain(st); st.forEach((t: TerrainDef) => t.image && cacheTerrain(t.key, t.image)); }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(SK, JSON.stringify(settings));
    localStorage.setItem(PK, JSON.stringify({ objects, terrain }));
    localStorage.setItem(LK, JSON.stringify(library));
    localStorage.setItem(TK, JSON.stringify(customTerrain));
  }, [settings, objects, terrain, library, customTerrain, ready]);

  function pathTile(x: CanvasRenderingContext2D, gx: number, gy: number) {
    const p = iso(gx, gy);
    x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + TW / 2, p.y + TH / 2); x.lineTo(p.x, p.y + TH); x.lineTo(p.x - TW / 2, p.y + TH / 2); x.closePath();
    return p;
  }

  function drawTile(x: CanvasRenderingContext2D, gx: number, gy: number, key: TerrainKey | undefined) {
    const p = pathTile(x, gx, gy), t = allTerrain.find(q => q.key === key);
    if (!t) { x.strokeStyle = "#26354a"; x.lineWidth = 1; x.stroke(); return; }
    const img = t.image ? terrainImgs.current[t.key] : null;
    if (img?.complete && img.naturalWidth) {
      let pattern = patterns.current[t.key];
      if (!pattern) { pattern = x.createPattern(img, "repeat"); patterns.current[t.key] = pattern; }
      if (pattern) {
        x.save(); x.clip(); x.fillStyle = pattern; x.fillRect(0, 0, VIEW_W, VIEW_H); x.restore();
      } else { x.fillStyle = t.color; x.fill(); }
      // AI foundations intentionally have NO per-tile stroke: this removes seams.
      return;
    }
    x.fillStyle = t.color; x.fill();
    if ((gx + gy) % 3 === 0) { x.fillStyle = t.edge; x.fillRect(Math.round(p.x - 2), Math.round(p.y + TH / 2), 2, 2); }
    x.strokeStyle = t.edge; x.lineWidth = 1; x.stroke();
  }

  function draw() {
    const c = ref.current, x = c?.getContext("2d"); if (!c || !x) return;
    x.imageSmoothingEnabled = settings.smoothing;
    x.fillStyle = "#101827"; x.fillRect(0, 0, VIEW_W, VIEW_H);
    if (settings.startMode === "test" && Object.keys(terrain).length === 0) drawTorvetGround(x);
    else for (let gx = 0; gx < settings.grid; gx++) for (let gy = 0; gy < settings.grid; gy++) drawTile(x, gx, gy, terrain[cellKey(gx, gy)]);
    [...objects].sort((a, b) => a.gx + a.gy - b.gx - b.gy).forEach(o => {
      const a = library.find(q => q.id === o.assetId), i = imgs.current[o.assetId];
      if (a && i?.complete) { const p = iso(o.gx, o.gy); x.drawImage(i, p.x - a.spec.w / 2, p.y + TH - a.spec.h, a.spec.w, a.spec.h); }
    });
    if (hover) { pathTile(x, hover.gx, hover.gy); x.strokeStyle = "#f6c431"; x.lineWidth = 2; x.stroke(); }
  }

  useEffect(draw, [objects, library, terrain, settings, hover, allTerrain]);

  function cell(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current; if (!c) return null;
    const r = c.getBoundingClientRect(), u = unIso(((e.clientX - r.left) / r.width) * VIEW_W, ((e.clientY - r.top) / r.height) * VIEW_H);
    const gx = Math.round(u.gx), gy = Math.round(u.gy);
    return gx < 0 || gy < 0 || gx >= settings.grid || gy >= settings.grid ? null : { gx, gy };
  }

  function onCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = cell(e); setHover(p); if (!p) return;
    const key = cellKey(p.gx, p.gy);
    if (tool === "paint") { setTerrain(v => ({ ...v, [key]: selectedTerrain })); setStatus(`PAINTED ${activeTerrain.label} · GRID ${p.gx}, ${p.gy}`); }
    else if (tool === "fill") { setTerrain(allCells(settings.grid, selectedTerrain)); setStatus(`FILLED WORLD WITH ${activeTerrain.label}`); }
    else if (tool === "erase") { setObjects(v => v.filter(o => o.gx !== p.gx || o.gy !== p.gy)); setTerrain(v => { const n = { ...v }; delete n[key]; return n; }); setStatus(`ERASED GRID ${p.gx}, ${p.gy}`); }
    else if (tool === "place") { if (!selectedAsset) { setStatus("SELECT A VALIDATED OBJECT ASSET FIRST"); return; } setObjects(v => [...v, { id: `o-${Date.now()}`, assetId: selectedAsset, gx: p.gx, gy: p.gy }]); setStatus(`PLACED OBJECT · GRID ${p.gx}, ${p.gy}`); }
    else setStatus(`SELECTED GRID ${p.gx}, ${p.gy}`);
  }

  function resetFactory() { setDrafts([]); setPick(null); setReal(null); setError(""); }
  function chooseObject(s: Spec) { setSpecKey(s.key); setPrompt(s.prompt); resetFactory(); }
  function chooseFoundation(key: string, _label: string, basePrompt: string) { setFoundationKey(key); setPrompt(basePrompt); resetFactory(); }
  function blueprints() {
    const notes = ["clean readable texture", "balanced natural variation", "more organic variation", "strongest game-ready version"];
    const base = prompt.trim() || (factoryKind === "foundation" ? "PixelChat terrain texture" : spec.prompt);
    const label = factoryKind === "foundation" ? (FOUNDATION_PRESETS.find(x => x[0] === foundationKey)?.[1] || "FOUNDATION") : spec.label;
    const ds = notes.map((n, v) => ({ id: `d-${Date.now()}-${v}`, v: v + 1, label, prompt: `${base}. ${n}.` }));
    setDrafts(ds); setPick(ds[0].id); setReal(null); setError("");
  }

  async function generate() {
    if (!draft) return;
    setGenerating(true); setError(""); setReal(null);
    try {
      const cacheKey = `${factoryKind}|${draft.label}|${draft.prompt}|seamless-v2`;
      const saved = JSON.parse(localStorage.getItem(CK) || "{}");
      if (saved[cacheKey]) { setReal(saved[cacheKey]); return; }
      const contract = factoryKind === "foundation"
        ? foundationContract()
        : `Generate one standalone PixelChat object asset. No floor, no scene, no UI, no text. Preserve crisp pixel art and transparent background.`;
      const r = await fetch("/api/generate-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: `${contract}\n\nRequested terrain or asset:\n${draft.prompt}` }) });
      const j = await r.json(); if (!r.ok) throw Error(j.error || "Generation failed");
      const raw = `data:image/png;base64,${j.imageBase64}`;
      const out = factoryKind === "foundation" ? await normalizeFoundation(raw) : await normalizeObject(raw, spec);
      saved[cacheKey] = out; localStorage.setItem(CK, JSON.stringify(saved)); setReal(out);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setGenerating(false); }
  }

  function accept() {
    if (!draft || !real) return;
    if (factoryKind === "foundation") {
      const key = `ai-foundation-${Date.now()}`, label = draft.label || "CUSTOM FOUNDATION";
      const terrainDef: TerrainDef = { key, label, color: "#2a4a39", edge: "#2a4a39", hint: "AI generated seamless world texture", image: real, ai: true };
      setCustomTerrain(v => [terrainDef, ...v]); cacheTerrain(key, real); setSelectedTerrain(key); setTool("paint"); setFactory(false);
      setStatus(`FOUNDATION IMPORTED · ${label} · SEAMLESS WORLD TEXTURE`);
    } else {
      const id = `ai-${Date.now()}`, a: Asset = { id, title: `${draft.label} VARIANT ${String(draft.v).padStart(2, "0")}`, image: real, spec };
      setLibrary(v => [a, ...v]); cacheObject(id, real); setSelectedAsset(id); setFactory(false); setStatus(`IMPORTED · ${a.title} · ${a.spec.w} × ${a.spec.h}`);
    }
    resetFactory();
  }

  function newProject() {
    if (confirm("Start a completely clean project? This clears terrain, placed objects and AI libraries.")) {
      setObjects([]); setTerrain({}); setLibrary([]); setCustomTerrain([]); imgs.current = {}; terrainImgs.current = {}; patterns.current = {}; setSelectedAsset(""); setTool("paint"); setStatus("READY · NEW CLEAN PROJECT · OBJECTS 0 · TERRAIN 0 · AI LIBRARIES 0");
    }
  }

  function startMode(mode: Mode) {
    setSettings(v => ({ ...v, startMode: mode }));
    if (mode === "empty") setTerrain({}); else if (mode === "grass") setTerrain(allCells(settings.grid, "grass"));
    setStatus(mode === "grass" ? "NEW GRASS WORLD READY" : mode === "empty" ? "EMPTY WORLD READY" : "TEST WORLD MODE READY"); setSettingsOpen(false);
  }

  const terrainButton = (t: TerrainDef) => <button key={t.key} onClick={() => { setSelectedTerrain(t.key); setTool("paint"); }} style={{ textAlign: "left", padding: 10, background: selectedTerrain === t.key ? "#2a3d50" : "#101827", color: "#e6edf5", border: `2px solid ${selectedTerrain === t.key ? "#f0c14b" : "#40546d"}`, fontFamily: "monospace", fontWeight: 900, cursor: "pointer" }}><span style={{ display: "inline-block", width: 12, height: 12, background: t.color, border: "1px solid #d9e5f0", marginRight: 7, verticalAlign: "middle" }} />{t.label}{t.ai ? " · AI" : ""}</button>;

  return <div style={{ minHeight: "100vh", background: "#0b1320", color: "#dce7f2", fontFamily: "monospace", padding: 10 }}>
    <header style={{ ...panel, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, marginBottom: 10 }}>
      <div><div style={{ fontSize: 30, fontWeight: 900, color: "#f0c14b" }}>PIXEL<span style={{ color: "#47b9d0" }}>GAME</span> MAKER</div><div style={{ color: "#aab8c8", marginTop: 5 }}>PIXELCHAT PLATFORM V1 · PRECISION EDITOR · ASSET CONTRACT SYSTEM</div></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}><Button onClick={newProject}>＋ NEW</Button><Button kind="nav" onClick={() => setSettingsOpen(true)}>⚙ SETTINGS</Button><Button kind="nav" onClick={() => { setFactoryKind("object"); setFactory(true); }}>✦ AI FACTORY</Button><Button kind="success" onClick={() => { localStorage.setItem(PK, JSON.stringify({ objects, terrain })); localStorage.setItem(TK, JSON.stringify(customTerrain)); setStatus("PROJECT SAVED"); }}>SAVE</Button><Button kind="danger" onClick={() => { if (confirm("Clear the current world?")) { setObjects([]); setTerrain({}); setStatus("WORLD CLEARED"); } }}>CLEAR</Button><Button kind="nav">▶ PLAY</Button></div>
    </header>
    <main style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr) 290px", gap: 10 }}>
      <aside style={{ ...panel, padding: 10 }}>
        <h2 style={{ ...heading, fontSize: 17 }}>FOUNDATION TERRAIN</h2><div style={{ color: "#8fa2b7", fontSize: 12, margin: "7px 0 10px" }}>PAINT THE WORLD BEFORE PLACING OBJECTS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{allTerrain.map(terrainButton)}</div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #405067" }}>
          <h2 style={{ ...heading, fontSize: 17 }}>VALIDATED ASSETS <Button kind="nav" style={{ float: "right", minHeight: 30, padding: "4px 9px", fontSize: 12 }} onClick={() => { setFactoryKind("object"); setFactory(true); }}>＋ AI</Button></h2>
          {library.length === 0 ? <div style={{ color: "#8fa2b7", padding: 14, border: "1px dashed #46566c", textAlign: "center", marginTop: 10 }}>NO OBJECT ASSETS YET<br />GENERATE ONLY WHAT YOU NEED</div> : library.map(a => <button key={a.id} onClick={() => { setSelectedAsset(a.id); setTool("place"); }} style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", padding: 7, marginTop: 8, background: "#101827", color: "#dce7f2", border: `2px solid ${selectedAsset === a.id ? "#f0c14b" : "#42536b"}`, fontFamily: "monospace", cursor: "pointer", textAlign: "left" }}><img src={a.image} style={{ width: 42, height: 42, objectFit: "contain", imageRendering: "pixelated" }} /><span>{a.title}<small style={{ display: "block", color: "#55c4d7", marginTop: 4 }}>✓ {a.spec.w} × {a.spec.h} VALIDATED</small></span></button>)}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #405067" }}><h2 style={{ ...heading, fontSize: 17, marginBottom: 9 }}>TOOLS</h2><div style={{ display: "grid", gap: 7 }}><Button kind="nav" active={tool === "paint"} onClick={() => setTool("paint")}>🖌 PAINT TILE</Button><Button kind="nav" active={tool === "fill"} onClick={() => setTool("fill")}>🪣 FILL WORLD</Button><Button kind="nav" active={tool === "place"} onClick={() => setTool("place")}>＋ PLACE OBJECT</Button><Button kind="nav" active={tool === "select"} onClick={() => setTool("select")}>↖ SELECT</Button><Button kind="danger" active={tool === "erase"} onClick={() => setTool("erase")}>ERASE</Button></div></div>
      </aside>
      <section style={{ ...panel, padding: 10 }}><div style={{ display: "flex", justifyContent: "space-between", color: "#aab8c8", padding: "3px 0 9px" }}><b>LIVE ISO WORLD · {Object.keys(terrain).length === 0 ? "EMPTY" : "TERRAIN ACTIVE"}</b><b>{tool.toUpperCase()} · {(tool === "paint" || tool === "fill") ? activeTerrain.label : "OBJECT MODE"}</b></div><canvas ref={ref} width={VIEW_W} height={VIEW_H} onPointerMove={e => setHover(cell(e))} onPointerLeave={() => setHover(null)} onPointerDown={onCanvas} style={{ width: "100%", height: "auto", border: "2px solid #3b4c63", display: "block", cursor: tool === "paint" || tool === "fill" ? "crosshair" : "pointer", imageRendering: "pixelated" }} /><div style={{ color: "#aab8c8", paddingTop: 10 }}>{status}</div></section>
      <aside style={{ ...panel, padding: 14 }}><h2 style={{ ...heading, fontSize: 18 }}>PLATFORM INSPECTOR</h2><div style={{ display: "grid", gap: 11, marginTop: 15, color: "#aab8c8" }}><div><b>TILE</b><br /><span style={{ color: "#e7eef6" }}>32 × 16 PX</span></div><div><b>GRID</b><br /><span style={{ color: "#e7eef6" }}>{settings.grid} × {settings.grid}</span></div><div><b>WORLD FOUNDATION</b><br /><span style={{ color: Object.keys(terrain).length ? "#56c7b7" : "#aab8c8" }}>{Object.keys(terrain).length ? "ACTIVE" : "EMPTY"}</span></div><div><b>RENDERING</b><br /><span style={{ color: "#e7eef6" }}>PIXEL PERFECT</span></div><div><b>SMOOTHING</b><br /><span style={{ color: "#e7eef6" }}>{settings.smoothing ? "ON" : "OFF"}</span></div><hr style={{ width: "100%", borderColor: "#405067" }} /><div><b>OBJECTS</b><br /><span style={{ color: "#e7eef6" }}>{objects.length}</span></div><div><b>AI LIBRARY</b><br /><span style={{ color: "#e7eef6" }}>{library.length}</span></div><div><b>FOUNDATION LIBRARY</b><br /><span style={{ color: "#e7eef6" }}>{customTerrain.length}</span></div><div><b>TERRAIN TILES</b><br /><span style={{ color: "#e7eef6" }}>{Object.keys(terrain).length}</span></div></div></aside>
    </main>
    {settingsOpen && <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(4,8,14,.82)", display: "grid", placeItems: "center", padding: 16 }}><div style={{ ...panel, width: "min(760px,100%)", padding: 22 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={heading}>PLATFORM SETTINGS</h2><Button kind="nav" onClick={() => setSettingsOpen(false)}>CLOSE</Button></div><p style={{ color: "#aab8c8" }}>Choose how a new world should start.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}><Button kind="nav" active={settings.startMode === "empty"} onClick={() => startMode("empty")}>EMPTY WORLD<br /><small>GRID ONLY</small></Button><Button kind="nav" active={settings.startMode === "grass"} onClick={() => startMode("grass")}>GRASS WORLD<br /><small>FOUNDATION READY</small></Button><Button kind="nav" active={settings.startMode === "test"} onClick={() => startMode("test")}>TEST MAP<br /><small>DEV ONLY</small></Button></div><div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><label>GRID SIZE <input type="number" min={8} max={30} value={settings.grid} onChange={e => setSettings(v => ({ ...v, grid: Math.max(8, Math.min(30, Number(e.target.value) || 14)) }))} style={{ marginLeft: 8, width: 70, padding: 9, background: "#101827", color: "white", border: "1px solid #40546d", fontFamily: "monospace" }} /></label><label><input type="checkbox" checked={settings.snap} onChange={e => setSettings(v => ({ ...v, snap: e.target.checked }))} /> GRID SNAP</label><label><input type="checkbox" checked={settings.smoothing} onChange={e => setSettings(v => ({ ...v, smoothing: e.target.checked }))} /> IMAGE SMOOTHING</label></div></div></div>}
    {factory && <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(4,8,14,.92)", overflow: "auto", padding: 18 }}><div style={{ ...panel, maxWidth: 1320, margin: "0 auto", padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><h1 style={{ ...heading, fontSize: 27 }}>AI ASSET FACTORY</h1><div style={{ color: "#aab8c8" }}>GENERATE OBJECTS OR FOUNDATION TEXTURES · 4 FREE BLUEPRINTS · 1 REAL IMAGE CALL</div></div><Button kind="nav" onClick={() => { setFactory(false); resetFactory(); }}>CLOSE</Button></div><div style={{ display: "flex", gap: 8, marginTop: 16 }}><Button kind="nav" active={factoryKind === "foundation"} onClick={() => { setFactoryKind("foundation"); setFoundationKey("grass"); setPrompt(FOUNDATION_PRESETS[0][2]); resetFactory(); }}>🧱 FOUNDATION</Button><Button kind="nav" active={factoryKind === "object"} onClick={() => { setFactoryKind("object"); setCat("nature"); chooseObject(FIRST); }}>🌳 OBJECT</Button></div>
      {factoryKind === "foundation" ? <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, marginTop: 14 }}><aside style={{ ...panel, padding: 12 }}><h3 style={heading}>1. PICK FOUNDATION</h3>{FOUNDATION_PRESETS.map(([key, label, base]) => <Button key={key} kind="nav" active={foundationKey === key} onClick={() => chooseFoundation(key, label, base)} style={{ width: "100%", marginTop: 7 }}>{label}</Button>)}<div style={{ marginTop: 12, color: "#8fa2b7", fontSize: 12 }}>SEAMLESS TEXTURE · EDGE TO EDGE · NO TRANSPARENCY · NO TILE BORDERS</div></aside><section><h3 style={heading}>2. DESCRIBE THE FOUNDATION</h3><textarea value={prompt} onChange={e => { setPrompt(e.target.value); resetFactory(); }} rows={6} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 13, background: "#101827", color: "#eef5fb", border: "2px solid #40546d", fontFamily: "monospace", fontSize: 14 }} /><div style={{ ...panel, padding: 12, marginTop: 10, color: "#aab8c8" }}>AI RULES: SEAMLESS REPEATING TERRAIN TEXTURE · FULL EDGE TO EDGE · NO DIAMOND · NO WHITE LINES · NO OUTLINE · NO OBJECTS · THE EDITOR MAPS IT OVER THE FULL WORLD</div><Button onClick={blueprints} style={{ width: "100%", marginTop: 10 }}>GENERATE 4 FOUNDATION BLUEPRINTS</Button></section></div> : <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, marginTop: 14 }}><aside style={{ ...panel, padding: 12 }}><h3 style={heading}>1. PICK OBJECT TYPE</h3>{(["nature", "building", "furniture", "character", "effect"] as const).map(c => <Button key={c} kind="nav" active={cat === c} onClick={() => { setCat(c); const first = SPECS.find(s => s.cat === c) || FIRST; chooseObject(first); }}>{c.toUpperCase()}</Button>)}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH..." style={{ width: "100%", boxSizing: "border-box", marginTop: 12, padding: 11, background: "#101827", color: "white", border: "1px solid #40546d", fontFamily: "monospace" }} />{visible.map(s => <button key={s.key} onClick={() => chooseObject(s)} style={{ width: "100%", textAlign: "left", padding: 10, marginTop: 7, background: specKey === s.key ? "#2a3d50" : "#101827", color: "#e6edf5", border: `2px solid ${specKey === s.key ? "#f0c14b" : "#40546d"}`, fontFamily: "monospace", fontWeight: 900, cursor: "pointer" }}>{s.label}</button>)}</aside><section><h3 style={heading}>2. DESCRIBE THE OBJECT</h3><textarea value={prompt} onChange={e => { setPrompt(e.target.value); resetFactory(); }} rows={6} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 13, background: "#101827", color: "#eef5fb", border: "2px solid #40546d", fontFamily: "monospace", fontSize: 14 }} /><div style={{ ...panel, padding: 12, marginTop: 10, color: "#aab8c8" }}>CONTRACT: {spec.label} · {spec.w} × {spec.h} PX · TRANSPARENT RGBA · AUTO ANCHOR · NO AA</div><Button onClick={blueprints} style={{ width: "100%", marginTop: 10 }}>GENERATE 4 OBJECT BLUEPRINTS</Button></section></div>}
      {drafts.length > 0 && <section style={{ marginTop: 18, borderTop: "2px solid #405067", paddingTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><div><h2 style={heading}>GENERATED BLUEPRINTS</h2><div style={{ color: "#aab8c8" }}>SELECT ONE BEFORE USING THE ONE REAL IMAGE CALL</div></div><Button kind="success" disabled={!draft || generating} onClick={generate}>{generating ? "GENERATING..." : "GENERATE SELECTED IMAGE"}</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}>{drafts.map(d => <button key={d.id} onClick={() => { setPick(d.id); setReal(null); setError(""); }} style={{ minHeight: 170, padding: 12, background: pick === d.id ? "#22384b" : "#101827", color: "#dce7f2", border: `2px solid ${pick === d.id ? "#f0c14b" : "#40546d"}`, fontFamily: "monospace", cursor: "pointer", textAlign: "left" }}><div style={{ height: 100, display: "grid", placeItems: "center", border: "1px solid #40546d", background: "#0b1320", fontSize: 22 }}>{factoryKind === "foundation" ? "▧" : "◆"}</div><b>{d.label} VARIANT {String(d.v).padStart(2, "0")}</b><small style={{ display: "block", color: "#9aaabd", marginTop: 5 }}>{d.prompt}</small></button>)}</div>{error && <div style={{ marginTop: 10, padding: 10, background: "#4a1c1c", color: "#ffd7d2", border: "1px solid #d26b5f" }}>{error}</div>}{real && <div style={{ marginTop: 16, padding: 14, border: "2px solid #45c7b5", background: "#0b1320" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={heading}>REAL GENERATED RESULT</b><div style={{ display: "flex", gap: 8 }}><Button kind="nav" onClick={() => { setReal(null); setError(""); }}>REGENERATE</Button><Button kind="success" onClick={accept}>ACCEPT TO LIBRARY</Button></div></div><div style={{ marginTop: 10, padding: 10, background: "#101827", display: "grid", placeItems: "center" }}><img src={real} style={{ maxWidth: "100%", imageRendering: "pixelated" }} /></div></div>}</section>}
    </div></div>}
  </div>;
}
