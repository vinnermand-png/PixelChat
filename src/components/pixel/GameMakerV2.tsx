import { useEffect, useRef, useState } from "react";
import { TH, TW, VIEW_H, VIEW_W, iso, unIso } from "@/components/pixel/world";

type TerrainKey = "grass";
type Tool = "paint" | "erase" | "erasePlatform" | "place" | "eraseObject" | "select" | "move";
type BuildCategory = "terrain" | "objects" | "decorations" | "foundation";
type Cell = { gx: number; gy: number };
type EdgeMaterial = "soil" | "rock" | "cliff";
type AssetCategory = "nature" | "decoration";
type AssetId = "testTree";
type AssetRenderOptions = { anchor: "cell-center" };
type AssetDefinition = { id: AssetId; name: string; category: AssetCategory; image?: string; render: AssetRenderOptions };
type PlacedObject = { id: string; assetId: AssetId; gx: number; gy: number };
type WorldData = { gridSize: number; terrain: Record<string, TerrainKey> };
type FoundationSettings = { edgeMaterial: EdgeMaterial; edgeDepth: number };
type PixelChatMapV1 = { version: 1; id: string; name: string; world: WorldData; foundation: FoundationSettings; objects: PlacedObject[] };
type EditorSnapshot = { world: WorldData; objects: PlacedObject[] };
type HistoryState = { past: EditorSnapshot[]; future: EditorSnapshot[] };

const DEFAULT_GRID_SIZE = 14;
const DEFAULT_WORLD: WorldData = { gridSize: DEFAULT_GRID_SIZE, terrain: {} };
const GRASS_COLOR = "#4f9d2d";
const DEFAULT_EDGE_DEPTH = 12;
const MIN_EDGE_DEPTH = 4;
const MAX_EDGE_DEPTH = 32;
const EMPTY_HISTORY: HistoryState = { past: [], future: [] };
const MAP_STORAGE_KEY = "pixelchat-game-maker-v2-map-v1";
const DEFAULT_MAP_NAME = "Untitled Map";
const ASSET_LIBRARY: readonly AssetDefinition[] = [
  { id: "testTree", name: "Test Tree", category: "nature", render: { anchor: "cell-center" } },
];

function cellKey(gx: number, gy: number) { return `${gx},${gy}`; }
function inBounds(gx: number, gy: number, gridSize: number) { return gx >= 0 && gy >= 0 && gx < gridSize && gy < gridSize; }
function getAsset(id: AssetId) { return ASSET_LIBRARY.find((asset) => asset.id === id); }
function getObjectDepth(object: PlacedObject) { return object.gx + object.gy; }
function compareObjectDepth(a: PlacedObject, b: PlacedObject) { return getObjectDepth(a) - getObjectDepth(b) || a.gy - b.gy || a.gx - b.gx || a.id.localeCompare(b.id); }
function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot { return { world: { ...snapshot.world, terrain: { ...snapshot.world.terrain } }, objects: snapshot.objects.map((object) => ({ ...object })) }; }
function cloneMap(map: PixelChatMapV1): PixelChatMapV1 { return { version: 1, id: map.id, name: map.name, world: { ...map.world, terrain: { ...map.world.terrain } }, foundation: { ...map.foundation }, objects: map.objects.map((object) => ({ ...object })) }; }
function createMapId() { return `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function isEdgeMaterial(value: unknown): value is EdgeMaterial { return value === "soil" || value === "rock" || value === "cliff"; }
function isValidMap(data: unknown): data is PixelChatMapV1 {
  if (!data || typeof data !== "object") return false;
  const map = data as Partial<PixelChatMapV1>;
  return map.version === 1 && typeof map.id === "string" && typeof map.name === "string" && Boolean(map.world) && typeof map.world?.gridSize === "number" && Boolean(map.world?.terrain) && typeof map.world.terrain === "object" && Boolean(map.foundation) && isEdgeMaterial(map.foundation?.edgeMaterial) && typeof map.foundation?.edgeDepth === "number" && Array.isArray(map.objects);
}
function traceDiamond(ctx: CanvasRenderingContext2D, gx: number, gy: number) { const p = iso(gx, gy); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + TW / 2, p.y + TH / 2); ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x - TW / 2, p.y + TH / 2); ctx.closePath(); }
function edgePalette(material: EdgeMaterial) { switch (material) { case "rock": return { right: "#5d6670", left: "#77818b" }; case "cliff": return { right: "#55443a", left: "#6d594d" }; default: return { right: "#74461f", left: "#9a6430" }; } }
function drawFoundationFace(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, depth: number) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + depth); ctx.lineTo(a.x, a.y + depth); ctx.closePath(); ctx.fill(); }
function drawFoundation(ctx: CanvasRenderingContext2D, terrain: Record<string, TerrainKey>, gridSize: number, material: EdgeMaterial, depth: number) { const has = (gx: number, gy: number) => inBounds(gx, gy, gridSize) && Boolean(terrain[cellKey(gx, gy)]); const palette = edgePalette(material); for (let s = 0; s <= (gridSize - 1) * 2; s++) for (let gx = 0; gx < gridSize; gx++) { const gy = s - gx; if (!has(gx, gy)) continue; const p = iso(gx, gy); const right = { x: p.x + TW / 2, y: p.y + TH / 2 }, bottom = { x: p.x, y: p.y + TH }, left = { x: p.x - TW / 2, y: p.y + TH / 2 }; if (!has(gx + 1, gy)) drawFoundationFace(ctx, right, bottom, palette.right, depth); if (!has(gx, gy + 1)) drawFoundationFace(ctx, left, bottom, palette.left, depth); } }
function drawTerrainSurface(ctx: CanvasRenderingContext2D, terrain: Record<string, TerrainKey>, gridSize: number) { ctx.fillStyle = GRASS_COLOR; ctx.beginPath(); let any = false; for (let s = 0; s <= (gridSize - 1) * 2; s++) for (let gx = 0; gx < gridSize; gx++) { const gy = s - gx; if (!inBounds(gx, gy, gridSize) || !terrain[cellKey(gx, gy)]) continue; const p = iso(gx, gy); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + TW / 2, p.y + TH / 2); ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x - TW / 2, p.y + TH / 2); ctx.closePath(); any = true; } if (any) ctx.fill(); }
function drawTestTree(ctx: CanvasRenderingContext2D, gx: number, gy: number) { const p = iso(gx, gy), cx = p.x, groundY = p.y + TH / 2; ctx.save(); ctx.fillStyle = "#6b3f20"; ctx.fillRect(Math.round(cx - 3), Math.round(groundY - 20), 6, 20); ctx.fillStyle = "#2f7d32"; ctx.beginPath(); ctx.moveTo(cx, groundY - 48); ctx.lineTo(cx + 17, groundY - 20); ctx.lineTo(cx - 17, groundY - 20); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#4f9d2d"; ctx.beginPath(); ctx.moveTo(cx, groundY - 43); ctx.lineTo(cx + 12, groundY - 24); ctx.lineTo(cx - 12, groundY - 24); ctx.closePath(); ctx.fill(); ctx.restore(); }
function drawAsset(ctx: CanvasRenderingContext2D, object: PlacedObject) { const asset = getAsset(object.assetId); if (!asset) return; if (asset.id === "testTree") drawTestTree(ctx, object.gx, object.gy); }
function drawObjects(ctx: CanvasRenderingContext2D, objects: PlacedObject[]) { for (const object of [...objects].sort(compareObjectDepth)) drawAsset(ctx, object); }
function drawGridOverlay(ctx: CanvasRenderingContext2D, gridSize: number) { ctx.save(); ctx.strokeStyle = "rgba(185,205,225,.55)"; for (let s = 0; s <= (gridSize - 1) * 2; s++) for (let gx = 0; gx < gridSize; gx++) { const gy = s - gx; if (!inBounds(gx, gy, gridSize)) continue; traceDiamond(ctx, gx, gy); ctx.stroke(); } ctx.restore(); }
function drawSelection(ctx: CanvasRenderingContext2D, object: PlacedObject | null) { if (!object) return; ctx.save(); ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 2; traceDiamond(ctx, object.gx, object.gy); ctx.stroke(); ctx.restore(); }
function drawHover(ctx: CanvasRenderingContext2D, hover: Cell | null) { if (!hover) return; ctx.save(); ctx.strokeStyle = "#f7d44a"; traceDiamond(ctx, hover.gx, hover.gy); ctx.stroke(); ctx.restore(); }
function screenToCell(x: number, y: number, gridSize: number): Cell | null { const raw = unIso(x, y); const baseGx = Math.floor(raw.gx), baseGy = Math.floor(raw.gy); for (let gy = baseGy - 1; gy <= baseGy + 1; gy++) for (let gx = baseGx - 1; gx <= baseGx + 1; gx++) { if (!inBounds(gx, gy, gridSize)) continue; const p = iso(gx, gy); const distance = Math.abs(x - p.x) / (TW / 2) + Math.abs(y - (p.y + TH / 2)) / (TH / 2); if (distance <= 1) return { gx, gy }; } return null; }

export default function GameMakerV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<WorldData>(DEFAULT_WORLD);
  const [objects, setObjects] = useState<PlacedObject[]>([]);
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [mapId, setMapId] = useState(createMapId);
  const [mapName, setMapName] = useState(DEFAULT_MAP_NAME);
  const [mapStatus, setMapStatus] = useState("Not saved");
  const [tool, setTool] = useState<Tool>("paint");
  const [activeCategory, setActiveCategory] = useState<BuildCategory>("terrain");
  const [hover, setHover] = useState<Cell | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [edgeMaterial, setEdgeMaterial] = useState<EdgeMaterial>("soil");
  const [edgeDepth, setEdgeDepth] = useState(DEFAULT_EDGE_DEPTH);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<AssetId>(ASSET_LIBRARY[0].id);
  const selectedObject = selectedObjectId ? objects.find((object) => object.id === selectedObjectId) || null : null;

  function currentSnapshot(): EditorSnapshot { return cloneSnapshot({ world, objects }); }
  function applySnapshot(snapshot: EditorSnapshot) { const next = cloneSnapshot(snapshot); setWorld(next.world); setObjects(next.objects); setSelectedObjectId(null); }
  function commitChange(nextWorld: WorldData, nextObjects: PlacedObject[]) {
    const previous = currentSnapshot();
    const next = cloneSnapshot({ world: nextWorld, objects: nextObjects });
    setHistory((current) => ({ past: [...current.past, previous], future: [] }));
    applySnapshot(next);
    setMapStatus("Not saved");
  }
  function undo() { if (!history.past.length) return; const previous = history.past[history.past.length - 1]; const current = currentSnapshot(); setHistory({ past: history.past.slice(0, -1), future: [current, ...history.future] }); applySnapshot(previous); setMapStatus("Not saved"); }
  function redo() { if (!history.future.length) return; const next = history.future[0]; const current = currentSnapshot(); setHistory({ past: [...history.past, current], future: history.future.slice(1) }); applySnapshot(next); setMapStatus("Not saved"); }
  function currentMap(): PixelChatMapV1 { return cloneMap({ version: 1, id: mapId, name: mapName.trim() || DEFAULT_MAP_NAME, world, foundation: { edgeMaterial, edgeDepth }, objects }); }
  function saveMap() { const map = currentMap(); localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map)); setMapId(map.id); setMapName(map.name); setMapStatus("Saved locally"); }
  function loadMapData(map: PixelChatMapV1) { const next = cloneMap(map); setMapId(next.id); setMapName(next.name); setWorld(next.world); setObjects(next.objects); setEdgeMaterial(next.foundation.edgeMaterial); setEdgeDepth(Math.max(MIN_EDGE_DEPTH, Math.min(MAX_EDGE_DEPTH, next.foundation.edgeDepth))); setHistory(EMPTY_HISTORY); setSelectedObjectId(null); setHover(null); setTool("paint"); setMapStatus("Loaded"); }
  function loadSavedMap() { const raw = localStorage.getItem(MAP_STORAGE_KEY); if (!raw) { setMapStatus("No saved map found"); return; } try { const parsed: unknown = JSON.parse(raw); if (!isValidMap(parsed)) throw new Error("Invalid map"); loadMapData(parsed); } catch { setMapStatus("Saved map is invalid"); } }

  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (!(event.ctrlKey || event.metaKey)) return; if (event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); } else if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [history, world, objects]);
  function renderWorld(ctx: CanvasRenderingContext2D) { drawFoundation(ctx, world.terrain, world.gridSize, edgeMaterial, edgeDepth); drawTerrainSurface(ctx, world.terrain, world.gridSize); drawObjects(ctx, objects); if (showGrid) drawGridOverlay(ctx, world.gridSize); drawSelection(ctx, selectedObject); drawHover(ctx, hover); }
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, VIEW_W, VIEW_H); ctx.fillStyle = "#15202b"; ctx.fillRect(0, 0, VIEW_W, VIEW_H); renderWorld(ctx); }, [world, objects, hover, showGrid, edgeMaterial, edgeDepth, selectedObject]);

  function getCell(event: React.PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return screenToCell(((event.clientX - rect.left) / rect.width) * VIEW_W, ((event.clientY - rect.top) / rect.height) * VIEW_H, world.gridSize); }
  function erasePlatform(start: Cell) { const startKey = cellKey(start.gx, start.gy); if (!world.terrain[startKey]) return; const terrain = { ...world.terrain }, visited = new Set<string>(), queue: Cell[] = [start]; while (queue.length) { const cell = queue.pop()!, key = cellKey(cell.gx, cell.gy); if (visited.has(key) || !terrain[key]) continue; visited.add(key); delete terrain[key]; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) queue.push({ gx: cell.gx + dx, gy: cell.gy + dy }); } commitChange({ ...world, terrain }, objects.filter((object) => !visited.has(cellKey(object.gx, object.gy)))); }
  function deleteSelectedObject() { if (!selectedObjectId) return; commitChange(world, objects.filter((object) => object.id !== selectedObjectId)); setTool("select"); }
  function handleCell(cell: Cell) {
    const key = cellKey(cell.gx, cell.gy);
    if (tool === "paint") { if (world.terrain[key]) return; commitChange({ ...world, terrain: { ...world.terrain, [key]: "grass" } }, objects); return; }
    if (tool === "erase") { if (!world.terrain[key]) return; const terrain = { ...world.terrain }; delete terrain[key]; commitChange({ ...world, terrain }, objects.filter((object) => object.gx !== cell.gx || object.gy !== cell.gy)); return; }
    if (tool === "erasePlatform") { erasePlatform(cell); return; }
    if (tool === "select") { const object = objects.find((current) => current.gx === cell.gx && current.gy === cell.gy); setSelectedObjectId(object?.id || null); return; }
    if (tool === "move") { if (!selectedObjectId || !world.terrain[key]) return; if (objects.some((object) => object.id !== selectedObjectId && object.gx === cell.gx && object.gy === cell.gy)) return; commitChange(world, objects.map((object) => object.id === selectedObjectId ? { ...object, gx: cell.gx, gy: cell.gy } : object)); setTool("select"); return; }
    if (!world.terrain[key]) return;
    if (tool === "place") { if (objects.some((object) => object.gx === cell.gx && object.gy === cell.gy)) return; commitChange(world, [...objects, { id: `${Date.now()}-${cell.gx}-${cell.gy}`, assetId: selectedAssetId, gx: cell.gx, gy: cell.gy }]); return; }
    if (tool === "eraseObject") { const nextObjects = objects.filter((object) => object.gx !== cell.gx || object.gy !== cell.gy); if (nextObjects.length !== objects.length) commitChange(world, nextObjects); }
  }
  function clearWorld() { if (!Object.keys(world.terrain).length && !objects.length) return; if (!window.confirm("Clear the entire world? This can be undone with Undo.")) return; commitChange({ ...world, terrain: {} }, []); setTool("paint"); setActiveCategory("terrain"); }

  const panel = { border: "1px solid #2a3b4d", background: "#0d141c", borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,.16)" } as const;
  const actionButton = (active = false) => ({ width: "100%", padding: "10px 12px", borderRadius: 9, border: active ? "1px solid #6ea8ff" : "1px solid #2a3b4d", background: active ? "#183150" : "#131e29", color: "#e8eef7", textAlign: "left" as const, cursor: "pointer", fontWeight: active ? 800 : 600 });
  const iconButton = (active = false) => ({ padding: "9px 11px", borderRadius: 9, border: active ? "1px solid #6ea8ff" : "1px solid #2a3b4d", background: active ? "#183150" : "#131e29", color: "#e8eef7", cursor: "pointer", fontWeight: 700 });
  const sectionTitle = { color: "#8fa4b9", fontSize: 11, letterSpacing: 1.4, fontWeight: 800, margin: "0 0 9px" } as const;
  const terrainCount = Object.keys(world.terrain).length;

  function selectTool(next: Tool, category: BuildCategory) { setTool(next); setActiveCategory(category); }
  function renderBuildTools() {
    if (activeCategory === "terrain") return <div style={{ display: "grid", gap: 8 }}><p style={sectionTitle}>TERRAIN TOOLS</p><button onClick={() => selectTool("paint", "terrain")} style={actionButton(tool === "paint")}>✏️ Paint Grass</button><button onClick={() => selectTool("erase", "terrain")} style={actionButton(tool === "erase")}>⌫ Erase Cell</button><button onClick={() => selectTool("erasePlatform", "terrain")} style={actionButton(tool === "erasePlatform")}>◩ Erase Platform</button></div>;
    if (activeCategory === "foundation") return <div><p style={sectionTitle}>FOUNDATION</p><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}><button onClick={() => { setEdgeMaterial("soil"); setMapStatus("Not saved"); }} style={actionButton(edgeMaterial === "soil")}>Soil</button><button onClick={() => { setEdgeMaterial("rock"); setMapStatus("Not saved"); }} style={actionButton(edgeMaterial === "rock")}>Rock</button><button onClick={() => { setEdgeMaterial("cliff"); setMapStatus("Not saved"); }} style={actionButton(edgeMaterial === "cliff")}>Cliff</button></div><label style={{ display: "block", marginTop: 16, color: "#c6d3df", fontSize: 13 }}>Depth <b style={{ float: "right" }}>{edgeDepth}px</b><input type="range" min={MIN_EDGE_DEPTH} max={MAX_EDGE_DEPTH} value={edgeDepth} onChange={(event) => { setEdgeDepth(Number(event.target.value)); setMapStatus("Not saved"); }} style={{ width: "100%", marginTop: 9 }} /></label></div>;
    const assets = activeCategory === "decorations" ? ASSET_LIBRARY.filter((asset) => asset.category === "decoration") : ASSET_LIBRARY.filter((asset) => asset.category === "nature");
    return <div style={{ display: "grid", gap: 14 }}><div><p style={sectionTitle}>ASSET LIBRARY</p>{assets.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>{assets.map((asset) => <button key={asset.id} onClick={() => { setSelectedAssetId(asset.id); setTool("place"); }} style={{ ...actionButton(selectedAssetId === asset.id && tool === "place"), minHeight: 92, textAlign: "center" }}><span style={{ display: "block", fontSize: 28, marginBottom: 8 }}>🌳</span>{asset.name}</button>)}</div> : <div style={{ color: "#8fa4b9", fontSize: 13 }}>No decoration assets yet.</div>}</div><div><p style={sectionTitle}>OBJECT TOOLS</p><div style={{ display: "grid", gap: 8 }}><button onClick={() => selectTool("select", activeCategory)} style={actionButton(tool === "select")}>◉ Select</button><button disabled={!selectedObject} onClick={() => selectTool("move", activeCategory)} style={{ ...actionButton(tool === "move"), opacity: selectedObject ? 1 : .45 }}>↔ Move Selected</button><button onClick={() => selectTool("eraseObject", activeCategory)} style={actionButton(tool === "eraseObject")}>⌫ Delete Object</button></div></div></div>;
  }

  return <main style={{ maxWidth: 1440, margin: "0 auto", padding: 18, color: "#e8eef7", fontFamily: "Inter, system-ui, sans-serif" }}>
    <header style={{ ...panel, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 220, padding: "0 8px" }}><div style={{ fontWeight: 900, letterSpacing: .4 }}>PIXELCHAT GAME MAKER</div><div style={{ color: "#7f95aa", fontSize: 11 }}>Map editor V2</div></div>
      <input aria-label="Map name" value={mapName} onChange={(event) => { setMapName(event.target.value); setMapStatus("Not saved"); }} style={{ flex: "1 1 220px", minWidth: 180, padding: "10px 12px", borderRadius: 9, border: "1px solid #2a3b4d", background: "#111b25", color: "#e8eef7" }} />
      <div style={{ color: mapStatus === "Saved locally" ? "#73d28d" : "#9fb0c2", fontSize: 12, whiteSpace: "nowrap" }}>● {mapStatus}</div>
      <button disabled={!history.past.length} onClick={undo} style={{ ...iconButton(), opacity: history.past.length ? 1 : .45 }}>↶ Undo</button>
      <button disabled={!history.future.length} onClick={redo} style={{ ...iconButton(), opacity: history.future.length ? 1 : .45 }}>↷ Redo</button>
      <button onClick={saveMap} style={iconButton(true)}>💾 Save</button>
      <button onClick={loadSavedMap} style={iconButton()}>📂 Load</button>
    </header>

    <section style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr) 250px", gap: 16, alignItems: "start" }}>
      <aside style={{ ...panel, padding: 12, position: "sticky", top: 12 }}>
        <p style={sectionTitle}>BUILD TOOLS</p>
        <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          <button onClick={() => setActiveCategory("terrain")} style={actionButton(activeCategory === "terrain")}>🌱 Terrain</button>
          <button onClick={() => setActiveCategory("objects")} style={actionButton(activeCategory === "objects")}>🌳 Objects</button>
          <button onClick={() => setActiveCategory("decorations")} style={actionButton(activeCategory === "decorations")}>✨ Decorations</button>
          <button onClick={() => setActiveCategory("foundation")} style={actionButton(activeCategory === "foundation")}>🪨 Foundation</button>
        </div>
        <div style={{ borderTop: "1px solid #233242", paddingTop: 14 }}>{renderBuildTools()}</div>
      </aside>

      <section style={{ ...panel, padding: 12, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}><div><div style={{ fontWeight: 800 }}>WORLD CANVAS</div><div style={{ color: "#7f95aa", fontSize: 12 }}>Build your map directly on the terrain.</div></div><button onClick={() => setShowGrid((current) => !current)} style={iconButton(showGrid)}>▦ Grid {showGrid ? "On" : "Off"}</button></div>
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} onPointerMove={(event) => setHover(getCell(event))} onPointerLeave={() => setHover(null)} onPointerDown={(event) => { const cell = getCell(event); if (cell) handleCell(cell); }} style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated", cursor: "crosshair", borderRadius: 10, background: "#15202b" }} />
        <div style={{ marginTop: 10, color: "#8fa4b9", fontSize: 12 }}>{terrainCount} terrain cells · {objects.length} objects · {showGrid ? "Grid visible" : "Clean canvas"}</div>
      </section>

      <aside style={{ ...panel, padding: 14, position: "sticky", top: 12 }}>
        {selectedObject ? <><p style={sectionTitle}>OBJECT INSPECTOR</p><div style={{ fontWeight: 800, fontSize: 17 }}>{getAsset(selectedObject.assetId)?.name}</div><div style={{ color: "#8fa4b9", fontSize: 13, margin: "6px 0 14px" }}>Position: {selectedObject.gx}, {selectedObject.gy} · Depth: {getObjectDepth(selectedObject)}</div><div style={{ display: "grid", gap: 8 }}><button onClick={() => setTool("move")} style={actionButton(tool === "move")}>↔ Move Object</button><button onClick={deleteSelectedObject} style={actionButton(false)}>⌫ Delete Object</button></div></> : activeCategory === "foundation" ? <><p style={sectionTitle}>FOUNDATION SETTINGS</p><div style={{ color: "#c6d3df", fontSize: 14, marginBottom: 10 }}>Material: <b>{edgeMaterial}</b></div><div style={{ color: "#c6d3df", fontSize: 14 }}>Depth: <b>{edgeDepth}px</b></div></> : <><p style={sectionTitle}>MAP INSPECTOR</p><div style={{ display: "grid", gap: 10, color: "#c6d3df", fontSize: 13 }}><div><span style={{ color: "#7f95aa" }}>Map</span><br /><b>{mapName || DEFAULT_MAP_NAME}</b></div><div><span style={{ color: "#7f95aa" }}>Terrain</span><br /><b>{terrainCount} cells</b></div><div><span style={{ color: "#7f95aa" }}>Objects</span><br /><b>{objects.length}</b></div><div><span style={{ color: "#7f95aa" }}>Foundation</span><br /><b>{edgeMaterial} · {edgeDepth}px</b></div></div></>}
        <div style={{ borderTop: "1px solid #233242", marginTop: 20, paddingTop: 16 }}><p style={sectionTitle}>WORLD ACTIONS</p><button onClick={clearWorld} style={{ ...actionButton(false), color: "#ffb4b4" }}>Clear World…</button><div style={{ color: "#71869a", fontSize: 11, marginTop: 7 }}>Requires confirmation. Undo remains available.</div></div>
      </aside>
    </section>
  </main>;
}
