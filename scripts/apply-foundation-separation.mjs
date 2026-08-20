import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/components/pixel/GameMaker.tsx");
let source = fs.readFileSync(file, "utf8");

const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Could not find ${label}`);
  source = source.replace(from, to);
};

replaceOnce(
  'type EdgeStyle = "none" | "auto" | "natural" | "deep";\ntype Settings = { grid: number; startMode: Mode; smoothing: boolean; snap: boolean; edge: EdgeStyle; edgeDepth: number; showGrid: boolean };',
  'type EdgeStyle = "none" | "auto" | "natural" | "deep";\ntype EdgeMaterial = "soil" | "rock" | "cliff";\ntype Settings = { grid: number; startMode: Mode; smoothing: boolean; snap: boolean; edge: EdgeStyle; edgeMaterial: EdgeMaterial; edgeDepth: number; showGrid: boolean };',
  "Settings type"
);

replaceOnce(
  'type TerrainDef = { key: string; label: string; color: string; edge: string; hint: string; image?: string; ai?: boolean };',
  'type TerrainDef = { key: string; label: string; color: string; edge?: string; hint: string; image?: string; ai?: boolean };',
  "TerrainDef type"
);

replaceOnce(
  'const DEF: Settings = { grid: 14, startMode: "empty", smoothing: false, snap: true, edge: "none", edgeDepth: 10, showGrid: false };',
  'const DEF: Settings = { grid: 14, startMode: "empty", smoothing: false, snap: true, edge: "none", edgeMaterial: "soil", edgeDepth: 10, showGrid: false };',
  "default settings"
);

const oldEdgeBlock = `  function edgeColor(t: TerrainDef) { if (settings.edge === "deep") return "#172316"; return t.edge || "#24382a"; }
  function drawEdgeFace(x: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string) { const d = settings.edgeDepth; x.fillStyle = color; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(b.x, b.y + d); x.lineTo(a.x, a.y + d); x.closePath(); x.fill(); x.fillStyle = "rgba(0,0,0,.22)"; x.fillRect(Math.round(Math.min(a.x, b.x)), Math.round(Math.max(a.y, b.y) + d - 1), Math.max(1, Math.round(Math.abs(a.x - b.x))), 1); }
  function drawPlatformEdges(x: CanvasRenderingContext2D) {
    if (settings.edge === "none") return;
    for (let s = 0; s <= (settings.grid - 1) * 2; s++) for (let gx = 0; gx < settings.grid; gx++) { const gy = s - gx; if (gy < 0 || gy >= settings.grid) continue; const key = terrain[cellKey(gx, gy)]; if (!key) continue; const t = allTerrain.find(q => q.key === key) || BUILTIN_TERRAIN[0], p = iso(gx, gy), r = { x: p.x + TW / 2, y: p.y + TH / 2 }, b = { x: p.x, y: p.y + TH }, l = { x: p.x - TW / 2, y: p.y + TH / 2 }, c = edgeColor(t); if (!has(gx + 1, gy)) drawEdgeFace(x, r, b, c); if (!has(gx, gy + 1)) drawEdgeFace(x, l, b, c); }
  }`;

const newEdgeBlock = `  function edgePalette() {
    const base = {
      soil: { main: "#6d4528", shadow: "#4a2d1b", light: "#8a5b35" },
      rock: { main: "#56606b", shadow: "#343a44", light: "#707b86" },
      cliff: { main: "#4a3b32", shadow: "#2c231e", light: "#665247" }
    }[settings.edgeMaterial];
    if (settings.edge === "deep") return { ...base, main: "#172316", shadow: "#0b120b", light: "#2b3a2a" };
    return base;
  }

  function drawEdgeFace(
    x: CanvasRenderingContext2D,
    a: { x: number; y: number },
    b: { x: number; y: number },
    palette: { main: string; shadow: string; light: string }
  ) {
    const d = settings.edgeDepth;
    x.fillStyle = palette.main;
    x.beginPath();
    x.moveTo(a.x, a.y);
    x.lineTo(b.x, b.y);
    x.lineTo(b.x, b.y + d);
    x.lineTo(a.x, a.y + d);
    x.closePath();
    x.fill();

    x.strokeStyle = palette.shadow;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(a.x, a.y + d);
    x.lineTo(b.x, b.y + d);
    x.stroke();

    if (settings.edge === "natural") {
      const steps = Math.max(1, Math.floor(Math.abs(a.x - b.x) / 6));
      x.fillStyle = palette.light;
      for (let i = 1; i < steps; i += 2) {
        const t = i / steps;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t + Math.min(d - 2, 2 + (i % 3));
        x.fillRect(Math.round(px), Math.round(py), 2, 1);
      }
    }
  }

  function drawPlatformEdges(x: CanvasRenderingContext2D) {
    if (settings.edge === "none") return;
    const palette = edgePalette();
    for (let s = 0; s <= (settings.grid - 1) * 2; s++) {
      for (let gx = 0; gx < settings.grid; gx++) {
        const gy = s - gx;
        if (gy < 0 || gy >= settings.grid || !has(gx, gy)) continue;
        const p = iso(gx, gy);
        const r = { x: p.x + TW / 2, y: p.y + TH / 2 };
        const b = { x: p.x, y: p.y + TH };
        const l = { x: p.x - TW / 2, y: p.y + TH / 2 };
        if (!has(gx + 1, gy)) drawEdgeFace(x, r, b, palette);
        if (!has(gx, gy + 1)) drawEdgeFace(x, l, b, palette);
      }
    }
  }`;
replaceOnce(oldEdgeBlock, newEdgeBlock, "old terrain-coupled edge renderer");

replaceOnce(
  '    if (settings.startMode === "test" && Object.keys(terrain).length === 0) drawTorvetGround(x); else drawTerrainSurface(x);\n    drawPlatformEdges(x); drawGridOverlay(x);',
  '    drawPlatformEdges(x);\n    if (settings.startMode === "test" && Object.keys(terrain).length === 0) drawTorvetGround(x); else drawTerrainSurface(x);\n    drawGridOverlay(x);',
  "render order"
);

replaceOnce(
  '<h3 style={{ ...heading, marginTop: 22 }}>PLATFORM EDGE</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10 }}>{(["none", "auto", "natural", "deep"] as EdgeStyle[]).map(v => <Button key={v} kind="nav" active={settings.edge === v} onClick={() => setSettings(s => ({ ...s, edge: v }))}>{v.toUpperCase()}</Button>)}</div><div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><label>EDGE DEPTH <input type="range" min={4} max={24} value={settings.edgeDepth}',
  '<h3 style={{ ...heading, marginTop: 22 }}>PLATFORM EDGE</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10 }}>{(["none", "auto", "natural", "deep"] as EdgeStyle[]).map(v => <Button key={v} kind="nav" active={settings.edge === v} onClick={() => setSettings(s => ({ ...s, edge: v }))}>{v.toUpperCase()}</Button>)}</div><h3 style={{ ...heading, marginTop: 18 }}>FOUNDATION EDGE MATERIAL</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>{(["soil", "rock", "cliff"] as EdgeMaterial[]).map(v => <Button key={v} kind="nav" active={settings.edgeMaterial === v} onClick={() => setSettings(s => ({ ...s, edgeMaterial: v }))}>{v.toUpperCase()}</Button>)}</div><div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><label>FOUNDATION DEPTH <input type="range" min={4} max={32} value={settings.edgeDepth}',
  "foundation settings UI"
);

replaceOnce(
  '`${settings.edge.toUpperCase()} · ${settings.edgeDepth}px`',
  '`${settings.edgeMaterial.toUpperCase()} · ${settings.edge.toUpperCase()} · ${settings.edgeDepth}px`',
  "inspector edge summary"
);

fs.writeFileSync(file, source, "utf8");
console.log("Foundation separation applied successfully to src/components/pixel/GameMaker.tsx");
