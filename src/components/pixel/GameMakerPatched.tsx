import React, { useEffect, useMemo, useState } from "react";
import GameMaker from "./GameMaker";

type FactoryTab = "foundation" | "asset" | "library";
type Blueprint = { id: string; label: string; prompt: string };
type LibraryFoundation = { key: string; label: string; color: string; edge: string; hint: string; image: string; ai?: boolean };
type LibraryAsset = { id: string; title: string; image: string; spec: { key: string; label: string; cat: string; prompt: string; w: number; h: number } };

const FOUNDATION_LIBRARY_KEY = "pixelchat-foundation-library-v2";
const ASSET_LIBRARY_KEY = "pixelchat-library-v8";

const FOUNDATION_TYPES = [
  ["grass", "GRASS", "Fresh green pixel grass", "#4b922d"],
  ["dirt", "DIRT", "Warm packed brown earth", "#a96a2b"],
  ["sand", "SAND", "Warm sandy terrain", "#c9ad63"],
  ["stone", "STONE", "Natural grey stone terrain", "#59606b"],
  ["water", "WATER", "Clear blue pixel water", "#287fa3"],
  ["snow", "SNOW", "Clean snowy terrain", "#d7e4ee"],
  ["moss", "MOSS", "Dark green moss terrain", "#356f3b"],
  ["custom", "CUSTOM", "Custom terrain foundation", "#4b922d"],
] as const;

const ASSET_TYPES = [
  ["tree", "TREE", "A natural forest tree", 64, 96],
  ["pine", "PINE TREE", "A tall compact pine tree", 56, 96],
  ["bush", "BUSH", "A compact green forest bush", 48, 40],
  ["plant", "PLANT", "A small green plant", 28, 36],
  ["flower", "FLOWER", "A small wild flower", 22, 28],
  ["mushroom", "MUSHROOM", "A small forest mushroom", 24, 24],
  ["rock", "ROCK", "A compact natural grey rock", 36, 28],
  ["boulder", "BOULDER", "A rounded natural boulder", 48, 36],
  ["log", "LOG", "A fallen forest log", 48, 24],
  ["stump", "TREE STUMP", "A small cut tree stump", 34, 30],
  ["house", "HOUSE", "A small cozy game house", 96, 96],
  ["cabin", "CABIN", "A rustic wooden cabin", 96, 96],
] as const;

const VARIATIONS = [
  ["CLASSIC", "clean readable variation with balanced color and subtle texture"],
  ["NATURAL", "organic uneven variation with natural clusters and small color changes"],
  ["FANTASY", "friendly colorful fantasy variation with clear readable pixels"],
  ["RICH", "slightly richer texture with controlled tonal variation and no noise"],
] as const;

function makeBlueprints(base: string, label: string, kind: "foundation" | "asset", seed: number): Blueprint[] {
  const contract = kind === "foundation"
    ? "Full-bleed PixelChat foundation surface that fits the 32x16 isometric grid exactly. No border, no grid, no seams, no diamond tile shape, no objects, no text."
    : "Standalone PixelChat game asset with a transparent background, centered readable silhouette, no ground plane, no border, no text.";
  return VARIATIONS.map(([name, direction], index) => ({
    id: `${seed}-${index}`,
    label: `${label} · ${name}`,
    prompt: `${base}. ${direction}. ${contract} Crisp low-resolution pixel art, simple colorful game style. Variant identity ${seed + index}.`,
  }));
}

function readArray<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function normalizeImage(src: string, width: number, height: number): Promise<string> {
  const image = new Image();
  image.src = src;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not process generated image")); });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

/**
 * Compatibility wrapper around the legacy editor.
 * Keeps the editor intact, removes legacy 1px terrain seams and provides the
 * cheaper blueprint-first AI Factory workflow. Generated library images are
 * normalized before localStorage so large AI base64 images cannot exhaust the
 * browser quota and cause the old "Could not save foundation to Library" error.
 */
export default function GameMakerPatched() {
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [tab, setTab] = useState<FactoryTab>("foundation");
  const [foundationKey, setFoundationKey] = useState("grass");
  const [assetKey, setAssetKey] = useState("tree");
  const [description, setDescription] = useState("Fresh green pixel grass");
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [batch, setBatch] = useState(1);
  const [reloadOnClose, setReloadOnClose] = useState(false);
  const [foundations, setFoundations] = useState<LibraryFoundation[]>([]);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);

  const foundation = useMemo(() => FOUNDATION_TYPES.find(([key]) => key === foundationKey) ?? FOUNDATION_TYPES[0], [foundationKey]);
  const asset = useMemo(() => ASSET_TYPES.find(([key]) => key === assetKey) ?? ASSET_TYPES[0], [assetKey]);
  const selectedBlueprint = blueprints.find((blueprint) => blueprint.id === selected) ?? null;
  const activeKind = tab === "asset" ? "asset" : "foundation";
  const activeLabel = activeKind === "foundation" ? foundation[1] : asset[1];
  const activePreset = activeKind === "foundation" ? foundation[2] : asset[2];

  const refreshLibrary = () => {
    setFoundations(readArray<LibraryFoundation>(FOUNDATION_LIBRARY_KEY));
    setAssets(readArray<LibraryAsset>(ASSET_LIBRARY_KEY));
  };

  const closeFactory = () => {
    setFactoryOpen(false);
    if (reloadOnClose) window.location.reload();
  };

  useEffect(() => {
    const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & { __pixelChatOriginalStroke?: typeof CanvasRenderingContext2D.prototype.stroke };
    const original = proto.__pixelChatOriginalStroke ?? proto.stroke;
    if (!proto.__pixelChatOriginalStroke) proto.__pixelChatOriginalStroke = original;
    proto.stroke = function patchedStroke(...args: Parameters<typeof original>) {
      if (this.lineWidth === 1) return;
      return original.apply(this, args);
    };

    const openFactory = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button || !button.textContent?.trim().toUpperCase().includes("AI FACTORY")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      refreshLibrary();
      setFactoryOpen(true);
    };
    document.addEventListener("click", openFactory, true);
    return () => {
      proto.stroke = original;
      document.removeEventListener("click", openFactory, true);
    };
  }, []);

  const chooseFoundation = (key: string, preset: string) => {
    setTab("foundation"); setFoundationKey(key); setDescription(preset); setBlueprints([]); setSelected(null); setImage(null); setError(""); setNotice("");
  };
  const chooseAsset = (key: string, preset: string) => {
    setTab("asset"); setAssetKey(key); setDescription(preset); setBlueprints([]); setSelected(null); setImage(null); setError(""); setNotice("");
  };

  const generateBlueprints = () => {
    const nextBatch = batch + 1;
    setBatch(nextBatch);
    const next = makeBlueprints(description.trim() || activePreset, activeLabel, activeKind, Date.now() + nextBatch * 1000);
    setBlueprints(next);
    setSelected(next[0].id);
    setImage(null);
    setError("");
    setNotice("");
  };

  const generateSelectedImage = async () => {
    if (!selectedBlueprint || generating) return;
    setGenerating(true);
    setError("");
    setNotice("");
    setImage(null);
    try {
      const response = await fetch("/api/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: selectedBlueprint.prompt, kind: activeKind }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.imageBase64) throw new Error(payload.error || "Image generation failed");
      setImage(`data:image/png;base64,${payload.imageBase64}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const acceptGenerated = async () => {
    if (!image || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (activeKind === "foundation") {
        // Critical fix: generated AI images can be several MB. The editor only needs
        // one exact 32x16 tile, so store a tiny normalized tile instead.
        const normalized = await normalizeImage(image, 32, 16);
        const key = `ai-${foundationKey}-${Date.now()}`;
        const entry: LibraryFoundation = {
          key,
          label: `${foundation[1]} FOUNDATION`,
          color: foundation[3],
          edge: foundation[3],
          hint: selectedBlueprint?.label ?? foundation[2],
          image: normalized,
          ai: true,
        };
        const list = readArray<LibraryFoundation>(FOUNDATION_LIBRARY_KEY);
        localStorage.setItem(FOUNDATION_LIBRARY_KEY, JSON.stringify([...list, entry]));
      } else {
        const normalized = await normalizeImage(image, asset[3], asset[4]);
        const entry: LibraryAsset = {
          id: `ai-${assetKey}-${Date.now()}`,
          title: asset[1],
          image: normalized,
          spec: { key: asset[0], label: asset[1], cat: "ai", prompt: selectedBlueprint?.prompt ?? asset[2], w: asset[3], h: asset[4] },
        };
        const list = readArray<LibraryAsset>(ASSET_LIBRARY_KEY);
        localStorage.setItem(ASSET_LIBRARY_KEY, JSON.stringify([...list, entry]));
      }
      refreshLibrary();
      setNotice(`${activeLabel} SAVED TO LIBRARY. CLOSE AI FACTORY TO USE IT IN THE EDITOR.`);
      setReloadOnClose(true);
      setTab("library");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown save error";
      setError(`Could not save to Library: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const tabButton = (key: FactoryTab, label: string) => <button onClick={() => { setTab(key); setError(""); setNotice(""); if (key === "library") refreshLibrary(); }} style={{ padding: "11px 16px", background: tab === key ? "#24384d" : "#172435", color: tab === key ? "#fff" : "#c4d0dc", border: tab === key ? "2px solid #47b9d0" : "1px solid #40546d", fontWeight: 900 }}>{label}</button>;

  return <>
    <GameMaker />
    {factoryOpen && <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(5,10,18,.94)", overflow: "auto", padding: 24, color: "#eef6ff", fontFamily: "monospace" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", background: "#151f2e", border: "2px solid #3b4c63", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16 }}>
          <div><h2 style={{ margin: 0, color: "#f2c34d" }}>AI FACTORY</h2><div style={{ marginTop: 6, color: "#9fb1c5" }}>Blueprints are free. Only image generation uses a credit.</div></div>
          <button onClick={closeFactory}>CLOSE</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {tabButton("foundation", "FOUNDATION")}
          {tabButton("asset", "ASSETS")}
          {tabButton("library", `LIBRARY · ${foundations.length + assets.length}`)}
        </div>

        {tab === "foundation" && <>
          <div style={{ color: "#f2c34d", fontWeight: 900, marginBottom: 10 }}>FOUNDATION TYPE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginBottom: 16 }}>
            {FOUNDATION_TYPES.map(([key, label, preset]) => <button key={key} onClick={() => chooseFoundation(key, preset)} style={{ padding: 12, border: foundationKey === key ? "2px solid #47b9d0" : "1px solid #40546d", background: foundationKey === key ? "#24384d" : "#172435", color: "#fff", fontWeight: 800 }}>{label}</button>)}
          </div>
        </>}

        {tab === "asset" && <>
          <div style={{ color: "#f2c34d", fontWeight: 900, marginBottom: 10 }}>ASSET TYPE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginBottom: 16 }}>
            {ASSET_TYPES.map(([key, label, preset]) => <button key={key} onClick={() => chooseAsset(key, preset)} style={{ padding: 12, border: assetKey === key ? "2px solid #47b9d0" : "1px solid #40546d", background: assetKey === key ? "#24384d" : "#172435", color: "#fff", fontWeight: 800 }}>{label}</button>)}
          </div>
        </>}

        {(tab === "foundation" || tab === "asset") && <>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ width: "100%", minHeight: 100, boxSizing: "border-box", padding: 12, background: "#0d1520", color: "#fff", border: "1px solid #40546d", marginBottom: 12 }} />
          <button onClick={generateBlueprints} style={{ padding: "12px 18px", background: "#f6c431", color: "#111827", fontWeight: 900 }}>GENERATE 4 BLUEPRINTS · FREE</button>

          {blueprints.length > 0 && <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 18 }}>
              {blueprints.map((blueprint) => <button key={blueprint.id} onClick={() => { setSelected(blueprint.id); setImage(null); }} style={{ textAlign: "left", minHeight: 170, padding: 14, background: selected === blueprint.id ? "#24384d" : "#0d1520", color: "#eef6ff", border: selected === blueprint.id ? "2px solid #f2c34d" : "1px solid #40546d" }}><strong>{blueprint.label}</strong><div style={{ marginTop: 10, lineHeight: 1.45, color: "#c4d0dc" }}>{blueprint.prompt}</div></button>)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
              <button onClick={generateBlueprints} style={{ padding: "12px 18px" }}>REGENERATE BLUEPRINTS · FREE</button>
              <button disabled={!selectedBlueprint || generating} onClick={generateSelectedImage} style={{ padding: "12px 18px", background: "#176b61", color: "#fff", fontWeight: 900 }}>{generating ? "GENERATING..." : "GENERATE SELECTED IMAGE · 1 CREDIT"}</button>
            </div>
          </>}
        </>}

        {tab === "library" && <div>
          <div style={{ color: "#f2c34d", fontWeight: 900, marginBottom: 12 }}>YOUR AI LIBRARY</div>
          {foundations.length === 0 && assets.length === 0 ? <div style={{ padding: 18, border: "1px dashed #40546d", color: "#9fb1c5" }}>NO SAVED AI ASSETS YET</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {foundations.map((item) => <div key={item.key} style={{ padding: 12, background: "#0d1520", border: "1px solid #40546d" }}><img src={item.image} alt={item.label} style={{ width: "100%", height: 90, objectFit: "cover", imageRendering: "pixelated", background: "#111" }} /><div style={{ marginTop: 10, fontWeight: 900 }}>{item.label}</div><div style={{ color: "#9fb1c5", marginTop: 4 }}>{item.hint}</div></div>)}
            {assets.map((item) => <div key={item.id} style={{ padding: 12, background: "#0d1520", border: "1px solid #40546d" }}><img src={item.image} alt={item.title} style={{ width: "100%", height: 120, objectFit: "contain", imageRendering: "pixelated", background: "#111" }} /><div style={{ marginTop: 10, fontWeight: 900 }}>{item.title}</div></div>)}
          </div>}
        </div>}

        {error && <div style={{ marginTop: 14, padding: 12, border: "1px solid #d26b5f", color: "#ffd8d2" }}>{error}</div>}
        {notice && <div style={{ marginTop: 14, padding: 12, border: "1px solid #45c7b5", color: "#d7fff8" }}>{notice}</div>}
        {image && <div style={{ marginTop: 20 }}><h3>PREVIEW</h3><img src={image} alt="Generated asset" style={{ width: activeKind === "foundation" ? 280 : 220, height: activeKind === "foundation" ? 140 : 220, objectFit: activeKind === "foundation" ? "cover" : "contain", imageRendering: "pixelated", border: "2px solid #47b9d0", display: "block", background: "#111" }} /><div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}><button onClick={generateSelectedImage} disabled={generating}>REGENERATE IMAGE · 1 CREDIT</button><button onClick={acceptGenerated} disabled={saving} style={{ padding: "12px 18px", background: "#f6c431", color: "#111827", fontWeight: 900 }}>{saving ? "SAVING..." : "ACCEPT TO LIBRARY"}</button></div></div>}
      </div>
    </div>}
  </>;
}
