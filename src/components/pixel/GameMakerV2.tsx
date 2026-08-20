import { useEffect, useRef, useState } from "react";
import { TH, TW, VIEW_H, VIEW_W, iso, unIso } from "@/components/pixel/world";

type TerrainKey = "grass";
type Tool = "paint" | "erase" | "erasePlatform" | "place" | "eraseObject" | "select" | "move";
type Cell = { gx: number; gy: number };
type EdgeMaterial = "soil" | "rock" | "cliff";
type ObjectKey = "testTree";
type PlacedObject = { id: string; asset: ObjectKey; gx: number; gy: number };
type WorldData = { gridSize: number; terrain: Record<string, TerrainKey> };

const DEFAULT_GRID_SIZE = 14;
const DEFAULT_WORLD: WorldData = { gridSize: DEFAULT_GRID_SIZE, terrain: {} };
const GRASS_COLOR = "#4f9d2d";
const DEFAULT_EDGE_MATERIAL: EdgeMaterial = "soil";
const DEFAULT_EDGE_DEPTH = 12;
const MIN_EDGE_DEPTH = 4;
const MAX_EDGE_DEPTH = 32;

function cellKey(gx: number, gy: number) { return `${gx},${gy}`; }
function inBounds(gx: number, gy: number, gridSize: number) { return gx >= 0 && gy >= 0 && gx < gridSize && gy < gridSize; }
function traceDiamond(ctx: CanvasRenderingContext2D, gx: number, gy: number) { const p = iso(gx, gy); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + TW / 2, p.y + TH / 2); ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x - TW / 2, p.y + TH / 2); ctx.closePath(); }
function edgePalette(material: EdgeMaterial) { switch (material) { case "rock": return { right: "#5d6670", left: "#77818b" }; case "cliff": return { right: "#55443a", left: "#6d594d" }; default: return { right: "#74461f", left: "#9a6430" }; } }
function drawFoundationFace(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, edgeDepth: number) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y + edgeDepth); ctx.lineTo(a.x, a.y + edgeDepth); ctx.closePath(); ctx.fill(); }
function drawFoundation(ctx: CanvasRenderingContext2D, terrain: Record<string, TerrainKey>, gridSize: number, edgeMaterial: EdgeMaterial, edgeDepth: number) { const has = (gx: number, gy: number) => inBounds(gx, gy, gridSize) && Boolean(terrain[cellKey(gx, gy)]); const palette = edgePalette(edgeMaterial); for (let s = 0; s <= (gridSize - 1) * 2; s++) for (let gx = 0; gx < gridSize; gx++) { const gy = s - gx; if (!inBounds(gx, gy, gridSize) || !has(gx, gy)) continue; const p = iso(gx, gy), right = { x: p.x + TW / 2, y: p.y + TH / 2 }, bottom = { x: p.x, y: p.y + TH }, left = { x: p.x - TW / 2, y: p.y + TH / 2 }; if (!has(gx + 1, gy)) drawFoundationFace(ctx, right, bottom, palette.right, edgeDepth); if (!has(gx, gy + 1)) drawFoundationFace(ctx, left, bottom, palette.left, edgeDepth); } }
function drawTerrainSurface(ctx: CanvasRenderingContext2D, terrain: Record<string, TerrainKey>, gridSize: number) { ctx.fillStyle = GRASS_COLOR; ctx.beginPath(); let any = false; for (let s = 0; s <= (gridSize - 1) * 2; s++) for (let gx = 0; gx < gridSize; gx++) { const gy = s - gx; if (!inBounds(gx, gy, gridSize) || !terrain[cellKey(gx, gy)]) continue; const p = iso(gx, gy); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + TW / 2, p.y + TH / 2); ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x - TW / 2, p.y + TH / 2); ctx.closePath(); any = true; } if (any) ctx.fill(); }
function drawTestTree(ctx: CanvasRenderingContext2D, gx: number, gy: number) { const p = iso(gx, gy), cx = p.x, groundY = p.y + TH / 2; ctx.save(); ctx.fillStyle = "#6b3f20"; ctx.fillRect(Math.round(cx - 3), Math.round(groundY - 20), 6, 20); ctx.fillStyle = "#2f7d32"; ctx.beginPath(); ctx.moveTo(cx, groundY - 48); ctx.lineTo(cx + 17, groundY - 20); ctx.lineTo(cx - 17, groundY - 20); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#4f9d2d"; ctx.beginPath(); ctx.moveTo(cx, groundY - 43); ctx.lineTo(cx + 12, groundY - 24); ctx.lineTo(cx - 12, groundY - 24); ctx.closePath(); ctx.fill(); ctx.restore(); }
function drawObjects(ctx: CanvasRenderingContext2D, objects: PlacedObject[]) { for (const object of [...objects].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))) if (object.asset === "testTree") drawTestTree(ctx, object.gx, object.gy); }
function drawGridOverlay(ctx: CanvasRenderingContext2D, gridSize: number) { ctx.save(); ctx.strokeStyle = "rgba(185, 205, 225, 0.55)"; ctx.lineWidth = 1; for (let s = 0; s <= (gridSize - 1) * 2; s++) for (let gx = 0; gx < gridSize; gx++) { const gy = s - gx; if (!inBounds(gx, gy, gridSize)) continue; traceDiamond(ctx, gx, gy); ctx.stroke(); } ctx.restore(); }
function drawSelection(ctx: CanvasRenderingContext2D, selected: PlacedObject | null) { if (!selected) return; ctx.save(); ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 2; traceDiamond(ctx, selected.gx, selected.gy); ctx.stroke(); const p = iso(selected.gx, selected.gy); ctx.fillStyle = "#ffd84a"; ctx.fillRect(Math.round(p.x - 2), Math.round(p.y + TH / 2 - 2), 4, 4); ctx.restore(); }
function drawHover(ctx: CanvasRenderingContext2D, hover: Cell | null) { if (!hover) return; ctx.save(); ctx.strokeStyle = "#f7d44a"; ctx.lineWidth = 1; traceDiamond(ctx, hover.gx, hover.gy); ctx.stroke(); ctx.restore(); }
function screenToCell(x: number, y: number, gridSize: number): Cell | null { const raw = unIso(x, y), baseGx = Math.floor(raw.gx), baseGy = Math.floor(raw.gy); for (let gy = baseGy - 1; gy <= baseGy + 1; gy++) for (let gx = baseGx - 1; gx <= baseGx + 1; gx++) { if (!inBounds(gx, gy, gridSize)) continue; const p = iso(gx, gy), distance = Math.abs(x - p.x) / (TW / 2) + Math.abs(y - (p.y + TH / 2)) / (TH / 2); if (distance <= 1) return { gx, gy }; } return null; }

export default function GameMakerV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<WorldData>(DEFAULT_WORLD);
  const [objects, setObjects] = useState<PlacedObject[]>([]);
  const [tool, setTool] = useState<Tool>("paint");
  const [hover, setHover] = useState<Cell | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [edgeMaterial, setEdgeMaterial] = useState<EdgeMaterial>(DEFAULT_EDGE_MATERIAL);
  const [edgeDepth, setEdgeDepth] = useState(DEFAULT_EDGE_DEPTH);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const selectedObject = selectedObjectId ? objects.find((object) => object.id === selectedObjectId) || null : null;

  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, VIEW_W, VIEW_H); ctx.fillStyle = "#15202b"; ctx.fillRect(0, 0, VIEW_W, VIEW_H); drawFoundation(ctx, world.terrain, world.gridSize, edgeMaterial, edgeDepth); drawTerrainSurface(ctx, world.terrain, world.gridSize); drawObjects(ctx, objects); if (showGrid) drawGridOverlay(ctx, world.gridSize); drawSelection(ctx, selectedObject); drawHover(ctx, hover); }, [world, objects, hover, showGrid, edgeMaterial, edgeDepth, selectedObject]);

  function getCell(event: React.PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return screenToCell(((event.clientX - rect.left) / rect.width) * VIEW_W, ((event.clientY - rect.top) / rect.height) * VIEW_H, world.gridSize); }
  function erasePlatform(start: Cell) {
    const startKey = cellKey(start.gx, start.gy);
    setWorld((current) => {
      if (!current.terrain[startKey]) return current;
      const terrain = { ...current.terrain };
      const visited = new Set<string>();
      const queue: Cell[] = [start];
      while (queue.length) {
        const cell = queue.pop()!;
        const key = cellKey(cell.gx, cell.gy);
        if (visited.has(key) || !terrain[key]) continue;
        visited.add(key);
        delete terrain[key];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ gx: cell.gx + dx, gy: cell.gy + dy });
      }
      return { ...current, terrain };
    });
    setObjects((current) => current.filter((object) => object.gx !== start.gx || object.gy !== start.gy));
  }
  function deleteSelectedObject() { if (!selectedObjectId) return; setObjects((current) => current.filter((object) => object.id !== selectedObjectId)); setSelectedObjectId(null); setTool("select"); }
  function handleCell(cell: Cell) {
    const key = cellKey(cell.gx, cell.gy);
    if (tool === "paint" || tool === "erase") { setWorld((current) => { const terrain = { ...current.terrain }; if (tool === "paint") terrain[key] = "grass"; else { delete terrain[key]; setObjects((objects) => objects.filter((object) => object.gx !== cell.gx || object.gy !== cell.gy)); if (selectedObject?.gx === cell.gx && selectedObject?.gy === cell.gy) setSelectedObjectId(null); } return { ...current, terrain }; }); return; }
    if (tool === "erasePlatform") { erasePlatform(cell); return; }
    if (tool === "select") { const object = objects.find((current) => current.gx === cell.gx && current.gy === cell.gy); setSelectedObjectId(object?.id || null); return; }
    if (tool === "move") {
      if (!selectedObjectId || !world.terrain[key]) return;
      const occupied = objects.some((object) => object.id !== selectedObjectId && object.gx === cell.gx && object.gy === cell.gy);
      if (occupied) return;
      setObjects((current) => current.map((object) => object.id === selectedObjectId ? { ...object, gx: cell.gx, gy: cell.gy } : object));
      setTool("select");
      return;
    }
    if (!world.terrain[key]) return;
    if (tool === "place") { setObjects((current) => current.some((object) => object.gx === cell.gx && object.gy === cell.gy) ? current : [...current, { id: `${Date.now()}-${cell.gx}-${cell.gy}`, asset: "testTree", gx: cell.gx, gy: cell.gy }]); return; }
    setObjects((current) => current.filter((object) => !(object.gx === cell.gx && object.gy === cell.gy)));
    if (selectedObject?.gx === cell.gx && selectedObject?.gy === cell.gy) setSelectedObjectId(null);
  }
  function clearWorld() { setWorld((current) => ({ ...current, terrain: {} })); setObjects([]); setSelectedObjectId(null); setTool("paint"); }

  return <main style={{ maxWidth: 1120, margin: "0 auto", padding: 24, color: "#e8eef7" }}><header style={{ marginBottom: 18 }}><div style={{ color: "#7f95aa", fontSize: 12, letterSpacing: 2 }}>PIXELCHAT · GAME MAKER V2</div><h1 style={{ margin: "6px 0 8px" }}>STEP 7 — SELECT & MOVE OBJECTS</h1><p style={{ margin: 0, color: "#9fb0c2" }}>Select an object, move it to another valid terrain cell, or delete the selected object.</p></header><section style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 18 }}><aside style={{ border: "1px solid #33475c", background: "#101820", padding: 14 }}><h2 style={{ fontSize: 14, marginTop: 0 }}>TERRAIN TOOLS</h2><button onClick={() => setTool("paint")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "paint" ? 800 : 400 }}>PAINT GRASS</button><button onClick={() => setTool("erase")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "erase" ? 800 : 400 }}>ERASE CELL</button><button onClick={() => setTool("erasePlatform")} style={{ width: "100%", marginBottom: 16, padding: 10, fontWeight: tool === "erasePlatform" ? 800 : 400 }}>ERASE PLATFORM</button><h2 style={{ fontSize: 14 }}>OBJECT TOOLS</h2><button onClick={() => setTool("place")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "place" ? 800 : 400 }}>PLACE TEST TREE</button><button onClick={() => setTool("eraseObject")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "eraseObject" ? 800 : 400 }}>ERASE OBJECT</button><button onClick={() => setTool("select")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "select" ? 800 : 400 }}>SELECT OBJECT</button><button disabled={!selectedObject} onClick={() => selectedObject && setTool("move")} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: tool === "move" ? 800 : 400 }}>MOVE SELECTED</button><button disabled={!selectedObject} onClick={deleteSelectedObject} style={{ width: "100%", marginBottom: 16, padding: 10 }}>DELETE SELECTED</button><button onClick={() => setShowGrid((current) => !current)} style={{ width: "100%", marginBottom: 16, padding: 10, fontWeight: 800 }}>GRID · {showGrid ? "ON" : "OFF"}</button><button onClick={clearWorld} style={{ width: "100%", padding: 10 }}>CLEAR WORLD</button><h2 style={{ fontSize: 14, marginTop: 24 }}>FOUNDATION</h2>{(["soil", "rock", "cliff"] as EdgeMaterial[]).map((material) => <button key={material} onClick={() => setEdgeMaterial(material)} style={{ width: "100%", marginBottom: 8, padding: 10, fontWeight: edgeMaterial === material ? 800 : 400 }}>{material.toUpperCase()}</button>)}<label style={{ display: "block", marginTop: 8, color: "#9fb0c2", fontSize: 13 }}>FOUNDATION DEPTH · {edgeDepth}px<input type="range" min={MIN_EDGE_DEPTH} max={MAX_EDGE_DEPTH} value={edgeDepth} onChange={(event) => setEdgeDepth(Number(event.target.value))} style={{ width: "100%", marginTop: 8 }} /></label><div style={{ marginTop: 22, color: "#9fb0c2", fontSize: 13, lineHeight: 1.6 }}><div><b>TERRAIN CELLS:</b> {Object.keys(world.terrain).length}</div><div><b>OBJECTS:</b> {objects.length}</div><div><b>SELECTED:</b> {selectedObject ? `${selectedObject.asset} @ ${selectedObject.gx}, ${selectedObject.gy}` : "NONE"}</div><div><b>TOOL:</b> {tool.toUpperCase()}</div><div><b>HOVER:</b> {hover ? `${hover.gx}, ${hover.gy}` : "OUTSIDE WORLD"}</div></div></aside><section style={{ border: "1px solid #33475c", background: "#0b1118", padding: 12 }}><canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} onPointerMove={(event) => setHover(getCell(event))} onPointerLeave={() => setHover(null)} onPointerDown={(event) => { const cell = getCell(event); if (cell) handleCell(cell); }} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", imageRendering: "pixelated", touchAction: "none" }} /></section></section></main>;
}
