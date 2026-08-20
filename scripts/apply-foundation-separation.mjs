import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/components/pixel/GameMaker.tsx");
let source = fs.readFileSync(file, "utf8");

const replace = (pattern, replacement, label) => {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Could not find ${label}`);
  source = next;
};

// 1. Settings: keep showGrid, add separate foundation material.
if (!/type EdgeMaterial =/.test(source)) {
  replace(
    /type EdgeStyle = "none" \| "auto" \| "natural" \| "deep";\r?\n/,
    'type EdgeStyle = "none" | "auto" | "natural" | "deep";\n' +
      'type EdgeMaterial = "soil" | "rock" | "cliff";\n',
    "EdgeStyle type"
  );
}

if (!/edgeMaterial:\s*EdgeMaterial/.test(source)) {
  replace(
    /type Settings = \{([^}]*)edge:\s*EdgeStyle;\s*edgeDepth:/,
    (_m, prefix) => `type Settings = {${prefix}edge: EdgeStyle; edgeMaterial: EdgeMaterial; edgeDepth:`,
    "Settings type"
  );
}

if (!/edgeMaterial:\s*"soil"/.test(source)) {
  replace(
    /(const DEF:\s*Settings\s*=\s*\{[^}]*edge:\s*"[^"]+",\s*)(edgeDepth:)/,
    "$1edgeMaterial: \"soil\", $2",
    "default settings"
  );
}

// 2. Terrain definition may use an optional edge, but terrain must no longer drive foundation.
source = source.replace(
  /type TerrainDef = \{ key: string; label: string; color: string; edge: string;/,
  "type TerrainDef = { key: string; label: string; color: string; edge?: string;"
);

// 3. Replace terrain-coupled foundation renderer as one complete block.
const edgeStart = source.indexOf("  function edgeColor(");
const terrainStart = source.indexOf("  function drawTerrainSurface(");
if (edgeStart < 0 || terrainStart < 0 || terrainStart <= edgeStart) {
  throw new Error("Could not locate current foundation renderer");
}

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

    x.fillStyle = palette.shadow;
    x.fillRect(
      Math.round(Math.min(a.x, b.x)),
      Math.round(Math.max(a.y, b.y) + d - 1),
      Math.max(1, Math.round(Math.abs(a.x - b.x))),
      1
    );

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
        const l = { x: p.x - TW /2, y: p.y + TH / 2 };

        // Foundation only on the outer platform perimeter.
        if (!has(gx + 1, gy)) drawEdgeFace(x, r, b, palette);
        if (!has(gx, gy + 1)) drawEdgeFace(x, l, b, palette);
      }
    }
  }

`;
source = source.slice(0, edgeStart) + newEdgeBlock + source.slice(terrainStart);

// 4. Render order: foundation, seam-free terrain, optional grid.
source = source.replace(
  /\s*if \(settings\.startMode === "test" && Object\.keys\(terrain\)\.length === 0\) drawTorvetGround\(x\); else drawTerrainSurface\(x\);\s*drawPlatformEdges\(x\);\s*drawGridOverlay\(x\);/,
  `\n    drawPlatformEdges(x);\n    if (settings.startMode === "test" && Object.keys(terrain).length === 0) drawTorvetGround(x); else drawTerrainSurface(x);\n    drawGridOverlay(x);`
);

// 5. Add separate material controls before depth control if not already present.
if (!/FOUNDATION EDGE MATERIAL/.test(source)) {
  const marker = '<div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><label>EDGE DEPTH';
  const ui = '<h3 style={{ ...heading, marginTop: 18 }}>FOUNDATION EDGE MATERIAL</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>{(["soil", "rock", "cliff"] as EdgeMaterial[]).map(v => <Button key={v} kind="nav" active={settings.edgeMaterial === v} onClick={() => setSettings(s => ({ ...s, edgeMaterial: v }))}>{v.toUpperCase()}</Button>)}</div><div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><label>FOUNDATION DEPTH';
  if (!source.includes(marker)) throw new Error("Could not find foundation settings UI");
  source = source.replace(marker, ui);
  source = source.replace('min={4} max={24} value={settings.edgeDepth}', 'min={4} max={32} value={settings.edgeDepth}');
}

// 6. Show material in inspector summary when the exact summary exists.
source = source.replace(
  /\$\{settings\.edge\.toUpperCase\(\)\} · \$\{settings\.edgeDepth\}px/g,
  '${settings.edgeMaterial.toUpperCase()} · ${settings.edge.toUpperCase()} · ${settings.edgeDepth}px'
);

fs.writeFileSync(file, source, "utf8");
console.log("Foundation separation applied successfully to src/components/pixel/GameMaker.tsx");
