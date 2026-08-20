import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GRID, TH, TW, VIEW_H, VIEW_W, drawRock, drawTorvetGround, drawTree, iso, unIso } from "@/components/pixel/world";

type Tool = "place" | "select" | "erase";
type BuiltInAsset = "tree" | "rock";
type AiCategory = "nature" | "building" | "furniture" | "character" | "effect";
type AiAssetKind = "tree" | "rock" | "house" | "shop" | "table" | "chair" | "npc" | "fire";
type WorldObject = { id: string; assetId: string; gx: number; gy: number };
type AiDraft = { id: string; kind: AiAssetKind; prompt: string; title: string };
type AiLibraryAsset = { id: string; title: string; kind: AiAssetKind; image: string };

const STORAGE_KEY = "pixelchat-game-maker-v1";
const AI_LIBRARY_KEY = "pixelchat-game-maker-ai-library-v1";
const AI_KINDS: Record<AiCategory, AiAssetKind[]> = {
  nature: ["tree", "rock"], building: ["house", "shop"], furniture: ["table", "chair"], character: ["npc"], effect: ["fire"],
};
const builtInAssets: { id: BuiltInAsset; label: string; icon: string }[] = [
  { id: "tree", label: "TREE", icon: "🌲" }, { id: "rock", label: "ROCK", icon: "🪨" },
];

export const Route = createFileRoute("/game-maker")({ component: GameMaker });

function GameMaker() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const [tool, setTool] = useState<Tool>("place");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("tree");
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
  const [generating, setGenerating] = useState(false);
  const [factoryError, setFactoryError] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState("");
  const [libraryAssets, setLibraryAssets] = useState<AiLibraryAsset[]>([]);

  const loadImage = (id: string, src: string) => {
    if (imageCache.current[id]) return;
    const image = new Image();
    image.onload = () => { imageCache.current[id] = image; };
    image.src = src;
    imageCache.current[id] = image;
  };

  useEffect(() => {
    try {
      const savedWorld = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(savedWorld)) setObjects(savedWorld);
      const savedLibrary = JSON.parse(localStorage.getItem(AI_LIBRARY_KEY) || "[]");
      if (Array.isArray(savedLibrary)) {
        setLibraryAssets(savedLibrary);
        savedLibrary.forEach((asset: AiLibraryAsset) => loadImage(asset.id, asset.image));
      }
    } catch { setStatus("LOCAL SAVE DATA COULD NOT BE READ"); }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawTorvetGround(ctx);
    [...objects].sort((a, b) => a.gx + a.gy - (b.gx + b.gy)).forEach((object) => {
      if (object.assetId === "tree") drawTree(ctx, object.gx, object.gy);
      else if (object.assetId === "rock") drawRock(ctx, object.gx, object.gy);
      else {
        const image = imageCache.current[object.assetId];
        if (image?.complete && image.naturalWidth) {
          const p = iso(object.gx, object.gy);
          const scale = Math.min(72 / image.naturalWidth, 112 / image.naturalHeight, 1);
          const width = Math.max(16, Math.round(image.naturalWidth * scale));
          const height = Math.max(16, Math.round(image.naturalHeight * scale));
          ctx.drawImage(image, Math.round(p.x - width / 2), Math.round(p.y + TH - height), width, height);
        }
      }
    });
    if (hover) {
      const p = iso(hover.gx, hover.gy);
      ctx.save(); ctx.strokeStyle = "#f0c14b"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(Math.round(p.x), Math.round(p.y)); ctx.lineTo(Math.round(p.x + TW / 2), Math.round(p.y + TH / 2));
      ctx.lineTo(Math.round(p.x), Math.round(p.y + TH)); ctx.lineTo(Math.round(p.x - TW / 2), Math.round(p.y + TH / 2)); ctx.closePath(); ctx.stroke(); ctx.restore();
    }
  }, [objects, hover, libraryAssets]);

  const getCell = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const raw = unIso(((event.clientX - rect.left) / rect.width) * VIEW_W, ((event.clientY - rect.top) / rect.height) * VIEW_H);
    const gx = Math.round(raw.gx), gy = Math.round(raw.gy);
    return gx < 0 || gy < 0 || gx >= GRID || gy >= GRID ? null : { gx, gy };
  };

  const saveWorld = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(objects)); setStatus(`SAVED · ${objects.length} OBJECTS · PIXELCHAT WORLD V1`); };
  const loadWorld = () => { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); setObjects(Array.isArray(saved) ? saved : []); setStatus(`LOADED · ${Array.isArray(saved) ? saved.length : 0} OBJECTS`); } catch { setStatus("SAVE DATA IS INVALID"); } };
  const clearWorld = () => { setObjects([]); setSelectedId(null); setStatus("WORLD CLEARED · NOT SAVED YET"); };

  const generateDrafts = () => {
    const base = aiPrompt.trim() || `${aiKind} for PixelChat`;
    const created = Array.from({ length: 4 }, (_, index): AiDraft => ({ id: `draft-${Date.now()}-${index}`, kind: aiKind, prompt: base, title: `${aiKind.toUpperCase()} VARIANT 0${index + 1}` }));
    setDrafts(created); setSelectedDraft(created[0].id); setGeneratedImage(null); setFactoryError("");
    setStatus(`AI FACTORY BLUEPRINTED 4 ${aiKind.toUpperCase()} VARIANTS · SELECT ONE AND APPROVE`);
  };

  const approveDraft = async () => {
    const draft = drafts.find((item) => item.id === selectedDraft);
    if (!draft) { setFactoryError("SELECT A BLUEPRINT FIRST."); return; }
    setGenerating(true); setFactoryError(""); setGeneratedImage(null);
    setStatus(`GENERATING REAL ${draft.kind.toUpperCase()} ASSET WITH OPENAI IMAGE ENGINE...`);
    try {
      const response = await fetch("/api/generate-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: draft.prompt }) });
      const payload = await response.json() as { imageBase64?: string; error?: string };
      if (!response.ok || !payload.imageBase64) throw new Error(payload.error || "OPENAI RETURNED NO IMAGE.");
      setGeneratedImage(`data:image/png;base64,${payload.imageBase64}`); setGeneratedLabel(draft.title);
      setStatus(`REAL PNG GENERATED · ${draft.title} · REVIEW BEFORE ADDING TO LIBRARY`);
    } catch (error) {
      setFactoryError(error instanceof Error ? error.message : "UNKNOWN GENERATION ERROR.");
      setStatus("AI IMAGE GENERATION FAILED · SEE FACTORY ERROR");
    } finally { setGenerating(false); }
  };

  const addGeneratedToLibrary = () => {
    if (!generatedImage) { setFactoryError("NO GENERATED PNG TO ACCEPT."); return; }
    const draft = drafts.find((item) => item.id === selectedDraft);
    const id = `ai-${Date.now()}`;
    const newAsset: AiLibraryAsset = { id, title: generatedLabel || "AI ASSET", kind: draft?.kind || aiKind, image: generatedImage };
    const nextLibrary = [...libraryAssets, newAsset];
    setLibraryAssets(nextLibrary);
    loadImage(id, generatedImage);
    try { localStorage.setItem(AI_LIBRARY_KEY, JSON.stringify(nextLibrary)); } catch { setFactoryError("ASSET ADDED FOR THIS SESSION, BUT LIBRARY SAVE IS FULL."); }
    setSelectedAssetId(id); setTool("place"); setFactoryOpen(false);
    setStatus(`AI ASSET ADDED TO LIBRARY · ${newAsset.title} · SELECTED AND READY TO PLACE`);
  };

  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;
  const selectedLibraryAsset = libraryAssets.find((asset) => asset.id === selectedAssetId);
  const selectedName = selectedLibraryAsset?.title || selectedAssetId.toUpperCase();
  const changeCategory = (category: AiCategory) => { setAiCategory(category); setAiKind(AI_KINDS[category][0]); };

  return <main className="min-h-screen bg-background px-3 py-5 text-foreground"><section className="mx-auto max-w-[1240px]">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-2 border-border bg-card px-4 py-3 shadow-[4px_4px_0_hsl(var(--border))]"><div><h1 className="text-[18px] text-primary">PIXEL<span className="text-accent">GAME MAKER</span></h1><p className="mt-1 text-[8px] text-muted-foreground">PIXELCHAT PLATFORM V1 · PRECISION EDITOR · AI ASSET FACTORY</p></div><div className="flex flex-wrap gap-2"><button className="pixel-btn" onClick={() => setFactoryOpen(true)}>AI FACTORY</button><button className="pixel-btn" onClick={saveWorld}>SAVE</button><button className="pixel-btn" onClick={loadWorld}>LOAD</button><button className="pixel-btn" onClick={clearWorld}>CLEAR</button><a className="pixel-btn" href="/">PLAY CHAT</a></div></header>
    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_230px]">
      <aside className="border-2 border-border bg-card p-3"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-[11px] text-primary">ASSET LIBRARY</h2><button className="pixel-btn px-2 py-1 text-[7px]" onClick={() => setFactoryOpen(true)}>+ AI</button></div><p className="mb-2 text-[8px] text-muted-foreground">PLATFORM-LOCKED ASSETS</p><div className="space-y-2">{builtInAssets.map((item) => <button key={item.id} className={`pixel-btn w-full text-left ${selectedAssetId === item.id ? "ring-2 ring-primary" : ""}`} onClick={() => { setSelectedAssetId(item.id); setTool("place"); }}>{item.icon} {item.label}</button>)}</div><div className="mt-4 border-t-2 border-border pt-3"><p className="mb-2 text-[8px] text-primary">AI GENERATED ASSETS · {libraryAssets.length}</p>{libraryAssets.length === 0 ? <p className="text-[8px] text-muted-foreground">NO AI ASSETS ACCEPTED YET</p> : <div className="space-y-2">{libraryAssets.map((item) => <button key={item.id} className={`flex w-full items-center gap-2 border-2 border-border p-2 text-left text-[7px] ${selectedAssetId === item.id ? "ring-2 ring-primary" : ""}`} onClick={() => { setSelectedAssetId(item.id); setTool("place"); }}><img src={item.image} alt="" className="h-10 w-10 object-contain [image-rendering:pixelated]" /><span>{item.title}<br/><span className="text-muted-foreground">{item.kind.toUpperCase()}</span></span></button>)}</div>}</div><div className="mt-5 border-t-2 border-border pt-4"><h3 className="mb-2 text-[10px] text-primary">TOOLS</h3><div className="space-y-2"><button className={`pixel-btn w-full ${tool === "place" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("place")}>PLACE</button><button className={`pixel-btn w-full ${tool === "select" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("select")}>SELECT</button><button className={`pixel-btn w-full ${tool === "erase" ? "ring-2 ring-primary" : ""}`} onClick={() => setTool("erase")}>ERASE</button></div></div></aside>
      <section className="border-2 border-border bg-card p-3"><div className="mb-2 flex items-center justify-between gap-2 text-[8px] text-muted-foreground"><span>LIVE ISO WORLD · {selectedName}</span><span>{hover ? `GRID ${hover.gx}, ${hover.gy}` : "MOVE OVER MAP"}</span></div><div className="overflow-hidden border-2 border-border bg-[#0d1423]"><canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="block h-auto w-full cursor-crosshair [image-rendering:pixelated]" onPointerMove={(event) => setHover(getCell(event))} onPointerLeave={() => setHover(null)} onPointerDown={(event) => { const cell = getCell(event); if (!cell) return; const matches = objects.filter((o) => o.gx === cell.gx && o.gy === cell.gy); if (tool === "erase") { setObjects((current) => current.filter((o) => !(o.gx === cell.gx && o.gy === cell.gy))); setStatus(`ERASED GRID ${cell.gx}, ${cell.gy}`); return; } if (tool === "select") { const hit = matches[matches.length - 1]; setSelectedId(hit?.id ?? null); setStatus(hit ? `SELECTED ${hit.assetId.toUpperCase()} · GRID ${cell.gx}, ${cell.gy}` : `EMPTY GRID ${cell.gx}, ${cell.gy}`); return; } const object: WorldObject = { id: `${selectedAssetId}-${cell.gx}-${cell.gy}-${Date.now()}`, assetId: selectedAssetId, gx: cell.gx, gy: cell.gy }; setObjects((current) => [...current, object]); setSelectedId(object.id); setStatus(`PLACED ${selectedName} · GRID ${cell.gx}, ${cell.gy} · AUTO-ANCHORED`); }} /></div><p className="mt-3 text-[8px] leading-[1.7] text-muted-foreground">{status}</p></section>
      <aside className="border-2 border-border bg-card p-3"><h2 className="mb-3 text-[11px] text-primary">PLATFORM INSPECTOR</h2><dl className="space-y-3 text-[9px]"><div><dt className="text-muted-foreground">TILE</dt><dd>32 × 16 PX</dd></div><div><dt className="text-muted-foreground">GRID</dt><dd>14 × 14</dd></div><div><dt className="text-muted-foreground">VIEWPORT</dt><dd>480 × 300 PX</dd></div><div><dt className="text-muted-foreground">RENDERING</dt><dd>PIXEL PERFECT</dd></div><div><dt className="text-muted-foreground">SNAP</dt><dd>AUTOMATIC</dd></div><div><dt className="text-muted-foreground">DEPTH</dt><dd>AUTO SORT</dd></div></dl><div className="mt-5 border-t-2 border-border pt-4 text-[8px] text-muted-foreground"><p className="mb-1 text-primary">SELECTED</p><p>{selectedObject ? selectedObject.assetId.toUpperCase() : "NONE"}</p><p className="mt-3">OBJECTS: {objects.length}</p><p className="mt-3">AI LIBRARY: {libraryAssets.length}</p></div></aside>
    </div>
    {factoryOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050914]/90 p-4"><section className="mx-auto my-6 max-w-[1080px] border-2 border-border bg-card p-4 shadow-[6px_6px_0_hsl(var(--border))]"><div className="mb-4 flex items-start justify-between gap-4 border-b-2 border-border pb-3"><div><h2 className="text-[16px] text-primary">AI ASSET FACTORY</h2><p className="mt-1 text-[8px] text-muted-foreground">GENERATE ASSET BLUEPRINTS FROM A LOCKED PIXELCHAT PLATFORM PROFILE</p></div><button className="pixel-btn" onClick={() => setFactoryOpen(false)}>CLOSE</button></div><div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]"><div className="border-2 border-border p-3"><h3 className="mb-3 text-[10px] text-primary">1. ASSET TYPE</h3>{(Object.keys(AI_KINDS) as AiCategory[]).map((category) => <button key={category} className={`pixel-btn mb-2 w-full text-left ${aiCategory === category ? "ring-2 ring-primary" : ""}`} onClick={() => changeCategory(category)}>{category.toUpperCase()}</button>)}<h3 className="mb-2 mt-4 text-[10px] text-primary">SUB TYPE</h3>{AI_KINDS[aiCategory].map((kind) => <button key={kind} className={`pixel-btn mb-2 w-full text-left ${aiKind === kind ? "ring-2 ring-primary" : ""}`} onClick={() => setAiKind(kind)}>{kind.toUpperCase()}</button>)}</div><div className="border-2 border-border p-3"><h3 className="mb-3 text-[10px] text-primary">2. DESCRIBE THE ASSET</h3><textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} className="min-h-[160px] w-full resize-y border-2 border-border bg-background p-3 text-[10px] leading-relaxed outline-none" /><div className="mt-3 grid grid-cols-2 gap-2 text-[8px] text-muted-foreground"><div className="border-2 border-border p-3"><p className="text-primary">STYLE LOCK 🔒</p><p>PIXELCHAT V1</p><p>CRISP PIXELS</p><p>NO ANTI-ALIASING</p><p>TRANSPARENT RGBA</p></div><div className="border-2 border-border p-3"><p className="text-primary">AUTO PRECISION</p><p>PLATFORM SCALE</p><p>AUTO ANCHOR</p><p>DEPTH COMPATIBLE</p><p>ASSET VALIDATION</p></div></div><button className="pixel-btn mt-4 w-full" onClick={generateDrafts}>GENERATE 4 VARIANTS</button></div><div className="border-2 border-border p-3 text-[8px] leading-[1.8] text-muted-foreground"><h3 className="mb-3 text-[10px] text-primary">3. FACTORY STATUS</h3><p>PROFILE: PIXELCHAT V1 ✓</p><p>CATEGORY: {aiCategory.toUpperCase()}</p><p>ASSET: {aiKind.toUpperCase()}</p><p>OUTPUT: TRANSPARENT PNG</p><p>ANCHOR: AUTO</p><p>COLLISION: AUTO PROFILE</p><div className="mt-4 border-t-2 border-border pt-3"><p className="text-primary">VALIDATION PIPELINE</p><p>PROMPT → STYLE → GENERATE → REVIEW → LIBRARY</p></div>{factoryError && <div className="mt-4 border-2 border-red-500 p-2 text-red-300">ERROR: {factoryError}</div>}</div></div>{drafts.length > 0 && <div className="mt-4 border-t-2 border-border pt-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-[12px] text-primary">GENERATED BLUEPRINTS</h3><p className="text-[8px] text-muted-foreground">CHOOSE ONE, THEN APPROVE SELECTED TO GENERATE A REAL PNG</p></div><button className="pixel-btn" disabled={generating} onClick={approveDraft}>{generating ? "GENERATING REAL ASSET..." : "APPROVE SELECTED"}</button></div><div className="grid gap-3 md:grid-cols-4">{drafts.map((draft) => <button key={draft.id} className={`border-2 border-border p-3 text-left ${selectedDraft === draft.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedDraft(draft.id)}><div className="flex h-16 items-center justify-center border-2 border-border text-2xl">{draft.kind === "tree" ? "🌲" : draft.kind === "rock" ? "🪨" : "✦"}</div><p className="mt-2 text-[9px] text-primary">{draft.title}</p><p className="mt-2 text-[7px] text-muted-foreground">COMPOSITION VARIANT</p><p className="mt-2 text-[7px] text-accent">✓ PLATFORM COMPATIBLE</p></button>)}</div></div>}{generatedImage && <div className="mt-4 border-2 border-primary p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-[12px] text-primary">REAL GENERATED ASSET</h3><p className="text-[8px] text-muted-foreground">TRANSPARENT PNG · REVIEW RESULT BEFORE ADDING TO LIBRARY</p></div><div className="flex gap-2"><button className="pixel-btn" onClick={approveDraft}>REGENERATE</button><button className="pixel-btn" onClick={addGeneratedToLibrary}>ACCEPT TO LIBRARY</button></div></div><div className="flex min-h-[300px] items-center justify-center border-2 border-border bg-[#0d1423]"><img src={generatedImage} alt={generatedLabel} className="max-h-[460px] max-w-full object-contain [image-rendering:pixelated]" /></div></div>}</section></div>}
  </section></main>;
}
