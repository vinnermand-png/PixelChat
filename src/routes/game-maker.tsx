import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  GRID,
  TH,
  TW,
  VIEW_H,
  VIEW_W,
  drawRock,
  drawTorvetGround,
  drawTree,
  iso,
  unIso,
} from "@/components/pixel/world";

type AssetType = "tree" | "rock";
type Tool = "place" | "select" | "erase";
type WorldObject = {
  id: string;
  type: AssetType;
  gx: number;
  gy: number;
  source?: "library" | "ai";
  label?: string;
};

type AiCategory = "nature" | "building" | "furniture" | "character" | "effect";
type AiAssetKind = "tree" | "rock" | "house" | "shop" | "table" | "chair" | "npc" | "fire";
type AiDraft = {
  id: string;
  kind: AiAssetKind;
  prompt: string;
  title: string;
  description: string;
  compatible: boolean;
};

const STORAGE_KEY = "pixelchat-game-maker-v1";

const AI_KINDS: Record<AiCategory, AiAssetKind[]> = {
  nature: ["tree", "rock"],
  building: ["house", "shop"],
  furniture: ["table", "chair"],
  character: ["npc"],
  effect: ["fire"],
};

export const Route = createFileRoute("/game-maker")({
  component: GameMaker,
});

function GameMaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("place");
  const [asset, setAsset] = useState<AssetType>("tree");
  const [objects, setObjects] = useState<WorldObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ gx: number; gy: number } | null>(null);
  const [status, setStatus] = useState("READY · 14 × 14 ISO GRID · 32 × 16 TILES");

  const [factoryOpen, setFactoryOpen] = useState(false);
  const [aiCategory, setAiCategory] = useState<AiCategory>("nature");
  const [aiKind, setAiKind] = useState<AiAssetKind>("tree");
  const [aiPrompt, setAiPrompt] = useState("Ancient oak tree with a thick brown trunk and a dense green crown");
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as WorldObject[];
      if (Array.isArray(saved)) setObjects(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawTorvetGround(ctx);

    const ordered = [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    for (const object of ordered) {
      if (object.type === "tree") drawTree(ctx, object.gx, object.gy);
      if (object.type === "rock") drawRock(ctx, object.gx, object.gy);
    }

    if (hover) {
      const p = iso(hover.gx, hover.gy);
      ctx.save();
      ctx.strokeStyle = "#f0c14b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(p.x), Math.round(p.y));
      ctx.lineTo(Math.round(p.x + TW / 2), Math.round(p.y + TH / 2));
      ctx.lineTo(Math.round(p.x), Math.round(p.y + TH));
      ctx.lineTo(Math.round(p.x - TW / 2), Math.round(p.y + TH / 2));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }, [objects, hover]);

  const getCell = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_H;
    const raw = unIso(x, y);
    const gx = Math.round(raw.gx);
    const gy = Math.round(raw.gy);
    if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return null;
    return { gx, gy };
  };

  const saveWorld = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(objects));
    setStatus(`SAVED · ${objects.length} OBJECT${objects.length === 1 ? "" : "S"} · PIXELCHAT WORLD V1`);
  };

  const loadWorld = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("NO SAVED WORLD FOUND");
      return;
    }
    try {
      const saved = JSON.parse(raw) as WorldObject[];
      setObjects(Array.isArray(saved) ? saved : []);
      setStatus(`LOADED · ${Array.isArray(saved) ? saved.length : 0} OBJECTS`);
    } catch {
      setStatus("SAVE DATA IS INVALID");
    }
  };

  const clearWorld = () => {
    setObjects([]);
    setSelectedId(null);
    setStatus("WORLD CLEARED · NOT SAVED YET");
  };

  const changeAiCategory = (category: AiCategory) => {
    const first = AI_KINDS[category][0];
    setAiCategory(category);
    setAiKind(first);
  };

  const generateDrafts = () => {
    const base = aiPrompt.trim() || `${aiKind} for PixelChat`;
    const created: AiDraft[] = Array.from({ length: 4 }, (_, index) => ({
      id: `draft-${Date.now()}-${index}`,
      kind: aiKind,
      prompt: base,
      title: `${aiKind.toUpperCase()} VARIANT 0${index + 1}`,
      description: `${base} · composition variant ${index + 1}`,
      compatible: true,
    }));
    setDrafts(created);
    setSelectedDraft(created[0].id);
    setStatus(`AI FACTORY BLUEPRINTED 4 ${aiKind.toUpperCase()} VARIANTS · READY FOR IMAGE ENGINE`);
  };

  const approveDraft = () => {
    const draft = drafts.find((item) => item.id === selectedDraft);
    if (!draft) return;
    if (draft.kind !== "tree" && draft.kind !== "rock") {
      setStatus(`${draft.kind.toUpperCase()} APPROVED AS AI BLUEPRINT · RENDERER SUPPORT COMING NEXT`);
      return;
    }
    setAsset(draft.kind);
    setTool("place");
    setFactoryOpen(false);
    setStatus(`AI BLUEPRINT APPROVED · ${draft.kind.toUpperCase()} IS READY FOR PRECISION PLACEMENT`);
  };

  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;

  return (
    <main className="min-h-screen bg-background px-3 py-5 text-foreground">
      <section className="mx-auto max-w-[1240px]">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-2 border-border bg-card px-4 py-3 shadow-[4px_4px_0_hsl(var(--border))]">
          <div>
            <h1 className="text-[18px] text-primary">PIXEL<span className="text-accent">GAME MAKER</span></h1>
            <p className="mt-1 text-[8px] text-muted-foreground">PIXELCHAT PLATFORM V1 · PRECISION EDITOR · AI ASSET FACTORY</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="pixel-btn" onClick={() => setFactoryOpen(true)}>AI FACTORY</button>
            <button className="pixel-btn" onClick={saveWorld}>SAVE</button>
            <button className="pixel-btn" onClick={loadWorld}>LOAD</button>
            <button className="pixel-btn" onClick={clearWorld}>CLEAR</button>
            <a className="pixel-btn" href="/">PLAY CHAT</a>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_230px]">
          <aside className="border-2 border-border bg-card p-3">
            <div className="mb-5 flex items-center justify-between gap-2">
              <h2 className="text-[11px] text-primary">ASSET LIBRARY</h2>
              <button className="pixel-btn px-2 py-1 text-[7px]" onClick={() => setFactoryOpen(true)}>+ AI</button>
            </div>
            <p className="mb-2 text-[8px] text-muted-foreground">PLATFORM-LOCKED ASSETS</p>
            <div className="space-y-2">
              <button className={`pixel-btn w-full text-left ${asset === "tree" ? "ring-2 ring-primary" : ""}`} onClick={() => { setAsset("tree"); setTool("place"); }}>
                🌲 TREE
              </button>
              <button className={`pixel-btn w-full text-left ${asset === "rock" ? "ring-2 ring-primary" : ""}`} onClick={() => { setAsset("rock"); setTool("place"); }}>
                🪨 ROCK
              </button>
            </div>

            <div className="mt-5 border-t-2 border-border pt-4">
              <h3 className="mb-2 text-[10px] text-primary">TOOLS</h3>
              <div className="space-y-2">
                <button className={`pixel-btn w-full ${tool === "place" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("place")}>PLACE</button>
                <button className={`pixel-btn w-full ${tool === "select" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("select")}>SELECT</button>
                <button className={`pixel-btn w-full ${tool === "erase" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("erase")}>ERASE</button>
              </div>
            </div>

            <div className="mt-5 border-t-2 border-border pt-4 text-[8px] leading-[1.7] text-muted-foreground">
              <p className="text-primary">AI FACTORY</p>
              <p>STYLE PROFILE: PIXELCHAT V1 🔒</p>
              <p>BACKGROUND: TRANSPARENT RGBA</p>
              <p>PIXEL SCALE: PLATFORM LOCKED</p>
              <p>ANCHOR: AUTO</p>
            </div>
          </aside>

          <section className="border-2 border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[8px] text-muted-foreground">
              <span>LIVE ISO WORLD</span>
              <span>{hover ? `GRID ${hover.gx}, ${hover.gy}` : "MOVE OVER MAP"}</span>
            </div>
            <div className="overflow-hidden border-2 border-border bg-[#0d1423]">
              <canvas
                ref={canvasRef}
                width={VIEW_W}
                height={VIEW_H}
                className="block h-auto w-full cursor-crosshair [image-rendering:pixelated]"
                onPointerMove={(event) => setHover(getCell(event))}
                onPointerLeave={() => setHover(null)}
                onPointerDown={(event) => {
                  const cell = getCell(event);
                  if (!cell) return;
                  const matches = objects.filter((object) => object.gx === cell.gx && object.gy === cell.gy);

                  if (tool === "erase") {
                    setObjects((current) => current.filter((object) => !(object.gx === cell.gx && object.gy === cell.gy)));
                    setStatus(`ERASED GRID ${cell.gx}, ${cell.gy}`);
                    return;
                  }

                  if (tool === "select") {
                    const hit = matches[matches.length - 1];
                    setSelectedId(hit?.id ?? null);
                    setStatus(hit ? `SELECTED ${hit.type.toUpperCase()} · GRID ${cell.gx}, ${cell.gy}` : `EMPTY GRID ${cell.gx}, ${cell.gy}`);
                    return;
                  }

                  if (matches.some((object) => object.type === asset)) {
                    setStatus(`GRID ${cell.gx}, ${cell.gy} ALREADY HAS ${asset.toUpperCase()}`);
                    return;
                  }

                  const object: WorldObject = {
                    id: `${asset}-${cell.gx}-${cell.gy}-${Date.now()}`,
                    type: asset,
                    gx: cell.gx,
                    gy: cell.gy,
                    source: "library",
                  };
                  setObjects((current) => [...current, object]);
                  setSelectedId(object.id);
                  setStatus(`PLACED ${asset.toUpperCase()} · GRID ${cell.gx}, ${cell.gy} · AUTO-ANCHORED`);
                }}
              />
            </div>
            <p className="mt-3 text-[8px] leading-[1.7] text-muted-foreground">{status}</p>
          </section>

          <aside className="border-2 border-border bg-card p-3">
            <h2 className="mb-3 text-[11px] text-primary">PLATFORM INSPECTOR</h2>
            <dl className="space-y-3 text-[9px]">
              <div><dt className="text-muted-foreground">TILE</dt><dd>32 × 16 PX</dd></div>
              <div><dt className="text-muted-foreground">GRID</dt><dd>14 × 14</dd></div>
              <div><dt className="text-muted-foreground">VIEWPORT</dt><dd>480 × 300 PX</dd></div>
              <div><dt className="text-muted-foreground">RENDERING</dt><dd>PIXEL PERFECT</dd></div>
              <div><dt className="text-muted-foreground">SNAP</dt><dd>AUTOMATIC</dd></div>
              <div><dt className="text-muted-foreground">DEPTH</dt><dd>AUTO SORT</dd></div>
            </dl>
            <div className="mt-5 border-t-2 border-border pt-4 text-[8px] text-muted-foreground">
              <p className="mb-1 text-primary">SELECTED</p>
              <p>{selectedObject?.type.toUpperCase() ?? "NONE"}</p>
              {selectedObject && <>
                <p className="mt-2">GRID: {selectedObject.gx}, {selectedObject.gy}</p>
                <p>ANCHOR: BOTTOM CENTER</p>
                <p>DEPTH: AUTO</p>
              </>}
              <p className="mt-3">OBJECTS: {objects.length}</p>
            </div>
          </aside>
        </div>

        {factoryOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050914]/90 p-4">
            <section className="mx-auto my-6 max-w-[1080px] border-2 border-border bg-card p-4 shadow-[6px_6px_0_hsl(var(--border))]">
              <div className="mb-4 flex items-start justify-between gap-4 border-b-2 border-border pb-3">
                <div>
                  <h2 className="text-[16px] text-primary">AI ASSET FACTORY</h2>
                  <p className="mt-1 text-[8px] text-muted-foreground">GENERATE ASSET BLUEPRINTS FROM A LOCKED PIXELCHAT PLATFORM PROFILE</p>
                </div>
                <button className="pixel-btn" onClick={() => setFactoryOpen(false)}>CLOSE</button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
                <div className="border-2 border-border p-3">
                  <h3 className="mb-3 text-[10px] text-primary">1. ASSET TYPE</h3>
                  <div className="space-y-2">
                    {(["nature", "building", "furniture", "character", "effect"] as AiCategory[]).map((category) => (
                      <button key={category} className={`pixel-btn w-full text-left ${aiCategory === category ? "ring-2 ring-primary" : ""}`} onClick={() => changeAiCategory(category)}>
                        {category.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <h3 className="mb-2 mt-5 text-[10px] text-primary">SUBTYPE</h3>
                  <div className="space-y-2">
                    {AI_KINDS[aiCategory].map((kind) => (
                      <button key={kind} className={`pixel-btn w-full text-left ${aiKind === kind ? "ring-2 ring-primary" : ""}`} onClick={() => setAiKind(kind)}>
                        {kind.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-2 border-border p-3">
                  <h3 className="mb-3 text-[10px] text-primary">2. DESCRIBE THE ASSET</h3>
                  <textarea
                    className="min-h-[130px] w-full resize-y border-2 border-border bg-background p-3 text-[10px] leading-[1.6] outline-none focus:border-primary"
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Describe the exact asset you want..."
                  />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="border border-border bg-background p-3 text-[8px] text-muted-foreground">
                      <p className="mb-1 text-primary">STYLE LOCK 🔒</p>
                      <p>PIXELCHAT V1</p>
                      <p>CRISP PIXELS</p>
                      <p>NO ANTI-ALIASING</p>
                      <p>TRANSPARENT RGBA</p>
                    </div>
                    <div className="border border-border bg-background p-3 text-[8px] text-muted-foreground">
                      <p className="mb-1 text-primary">AUTO PRECISION</p>
                      <p>PLATFORM SCALE</p>
                      <p>AUTO ANCHOR</p>
                      <p>DEPTH COMPATIBLE</p>
                      <p>ASSET VALIDATION</p>
                    </div>
                  </div>
                  <button className="pixel-btn mt-4 w-full" onClick={generateDrafts}>GENERATE 4 VARIANTS</button>
                  <p className="mt-2 text-[7px] leading-[1.6] text-muted-foreground">CURRENT STEP: BLUEPRINT GENERATION. THE IMAGE-ENGINE CONNECTOR WILL RENDER THE SELECTED BLUEPRINT INTO A REAL PNG ASSET IN THE NEXT ENGINE PASS.</p>
                </div>

                <div className="border-2 border-border p-3">
                  <h3 className="mb-3 text-[10px] text-primary">3. FACTORY STATUS</h3>
                  <div className="space-y-2 text-[8px] text-muted-foreground">
                    <p>PROFILE: PIXELCHAT V1 ✓</p>
                    <p>CATEGORY: {aiCategory.toUpperCase()}</p>
                    <p>ASSET: {aiKind.toUpperCase()}</p>
                    <p>OUTPUT: TRANSPARENT PNG</p>
                    <p>ANCHOR: AUTO</p>
                    <p>COLLISION: AUTO PROFILE</p>
                  </div>
                  <div className="mt-5 border-t-2 border-border pt-4">
                    <p className="text-[8px] text-primary">VALIDATION PIPELINE</p>
                    <p className="mt-2 text-[8px] leading-[1.8] text-muted-foreground">PROMPT → STYLE LOCK → GENERATE → CROP → SCALE CHECK → ANCHOR → VALIDATE → LIBRARY</p>
                  </div>
                </div>
              </div>

              {drafts.length > 0 && (
                <div className="mt-4 border-t-2 border-border pt-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[11px] text-primary">GENERATED BLUEPRINTS</h3>
                      <p className="mt-1 text-[8px] text-muted-foreground">CHOOSE THE BEST VARIANT BEFORE IT ENTERS THE PLATFORM PIPELINE</p>
                    </div>
                    <button className="pixel-btn" onClick={approveDraft}>APPROVE SELECTED</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {drafts.map((draft, index) => (
                      <button
                        key={draft.id}
                        className={`min-h-[170px] border-2 border-border bg-background p-3 text-left ${selectedDraft === draft.id ? "ring-2 ring-primary" : ""}`}
                        onClick={() => setSelectedDraft(draft.id)}
                      >
                        <div className="mb-3 flex h-16 items-center justify-center border border-border bg-card text-[20px]">
                          {draft.kind === "tree" ? "🌲" : draft.kind === "rock" ? "🪨" : "✦"}
                        </div>
                        <p className="text-[9px] text-primary">{draft.title}</p>
                        <p className="mt-2 text-[7px] leading-[1.6] text-muted-foreground">{draft.description}</p>
                        <p className="mt-3 text-[7px] text-accent">✓ PLATFORM COMPATIBLE</p>
                        <p className="text-[7px] text-muted-foreground">VARIANT {index + 1} / 4</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
