import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/components/pixel/GameMaker.tsx");
let source = fs.readFileSync(file, "utf8");

const fail = (message) => { throw new Error(message); };

function replaceOnce(from, to, label) {
  const next = source.replace(from, to);
  if (next === source) fail(`Could not find ${label}`);
  source = next;
}

function replaceFunction(name, replacement) {
  const start = source.indexOf(`  function ${name}(`);
  if (start < 0) fail(`Could not locate function ${name}`);
  const brace = source.indexOf("{", start);
  if (brace < 0) fail(`Could not locate function body ${name}`);
  let depth = 0;
  let end = -1;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) fail(`Could not parse function ${name}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

// Separate top terrain from foundation settings.
if (!source.includes('type EdgeMaterial = "soil" | "rock" | "cliff";')) {
  replaceOnce(
    'type EdgeStyle = "none" | "auto" | "natural" | "deep";',
    'type EdgeStyle = "none" | "auto" | "natural" | "deep";\ntype EdgeMaterial = "soil" | "rock" | "cliff";',
    "EdgeMaterial type"
  );
}

if (!source.includes('edgeMaterial: EdgeMaterial')) {
  replaceOnce(
    'edge: EdgeStyle; edgeDepth: number;',
    'edge: EdgeStyle; edgeMaterial: EdgeMaterial; edgeDepth: number;',
    "Settings foundation material"
  );
}

if (!source.includes('edgeMaterial: "soil"')) {
  replaceOnce(
    'edge: "none", edgeDepth:',
    'edge: "none", edgeMaterial: "soil", edgeDepth:',
    "default foundation material"
  );
}

// Foundation palette is completely independent of the painted terrain.
replaceFunction("edgeColor", `  function edgePalette() {
    const palette = {
      soil: { main: "#6d4528", shadow: "#4a2d1b", light: "#8a5b35" },
      rock: { main: "#59606b", shadow: "#343a44", light: "#78818c" },
      cliff: { main: "#4a3b32", shadow: "#2c231e", light: "#665247" }
    }[settings.edgeMaterial];
    if (settings.edge === "deep") return { ...palette, main: "#172316", shadow: "#0b120b", light: "#2b3a2a" };
    return palette;
  }`);

replaceFunction("drawEdgeFace", `  function drawEdgeFace(
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
    x.fillStyle = palette.shadow;
    x.fillRect(Math.round(Math.min(a.x, b.x)), Math.round(Math.max(a.y, b.y) + d - 1), Math.max(1, Math.round(Math.abs(a.x - b.x))), 1);
    if (settings.edge === "natural") {
      x.fillStyle = palette.light;
      const steps = Math.max(1, Math.floor(Math.abs(a.x - b.x) / 6));
      for (let i = 1; i < steps; i += 2) {
        const t = i / steps;
        x.fillRect(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t + Math.min(d - 2, 2 + (i % 3))), 2, 1);
      }
    }
  }`);

replaceFunction("drawPlatformEdges", `  function drawPlatformEdges(x: CanvasRenderingContext2D) {
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
  }`);

// Ensure foundation is rendered before the top surface. Keep seam-free terrain and grid overlay untouched.
source = source.replace(
  /drawTerrainSurface\(x\);\s*drawPlatformEdges\(x\);\s*drawGridOverlay\(x\);/,
  'drawPlatformEdges(x); drawTerrainSurface(x); drawGridOverlay(x);'
);

// Add separate foundation material controls if they are not already present.
if (!source.includes('FOUNDATION EDGE MATERIAL')) {
  const marker = 'FOUNDATION DEPTH <input type="range"';
  if (!source.includes(marker)) fail("Could not locate foundation settings controls");
  source = source.replace(
    marker,
    'FOUNDATION EDGE MATERIAL</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>{(["soil", "rock", "cliff"] as EdgeMaterial[]).map(v => <Button key={v} kind="nav" active={settings.edgeMaterial === v} onClick={() => setSettings(s => ({ ...s, edgeMaterial: v }))}>{v.toUpperCase()}</Button>)}</div><h3 style={{ ...heading, marginTop: 18 }}>FOUNDATION DEPTH</h3><div style={{ marginTop: 10 }}><input type="range"'
  );
  source = source.replace('disabled={settings.edge === "none"} onChange={e => setSettings(s => ({ ...s, edgeDepth: Number(e.target.value) }))} /></label>', 'disabled={settings.edge === "none"} onChange={e => setSettings(s => ({ ...s, edgeDepth: Number(e.target.value) }))} /></div>');
}

fs.writeFileSync(file, source, "utf8");
console.log("Foundation separation applied successfully to src/components/pixel/GameMaker.tsx");
