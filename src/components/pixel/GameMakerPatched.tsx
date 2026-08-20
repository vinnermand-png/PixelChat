import React, { useEffect, useMemo, useState } from "react";
import GameMaker from "./GameMaker";

type Blueprint = { id: string; label: string; prompt: string };

const FOUNDATION_LIBRARY_KEY = "pixelchat-foundation-library-v2";

const FOUNDATION_TYPES = [
  ["grass", "GRASS", "Fresh green pixel grass"],
  ["dirt", "DIRT", "Warm packed brown earth"],
  ["sand", "SAND", "Warm sandy terrain"],
  ["stone", "STONE", "Natural grey stone terrain"],
  ["water", "WATER", "Clear blue pixel water"],
  ["snow", "SNOW", "Clean snowy terrain"],
  ["moss", "MOSS", "Dark green moss terrain"],
  ["custom", "CUSTOM", "Custom terrain foundation"],
] as const;

const VARIATIONS = [
  ["CLASSIC", "clean readable variation with balanced color and subtle texture"],
  ["NATURAL", "organic uneven variation with natural clusters and small color changes"],
  ["FANTASY", "friendly colorful fantasy variation with clear readable pixels"],
  ["RICH", "slightly richer texture with controlled tonal variation and no noise"],
] as const;

function makeBlueprints(base: string, label: string, seed: number): Blueprint[] {
  return VARIATIONS.map(([name, direction], index) => ({
    id: `${seed}-${index}`,
    label: `${label} · ${name}`,
    prompt: `${base}. ${direction}. Seamless-looking full-bleed PixelChat terrain surface, crisp low-resolution pixel art, simple colorful game style, no objects, no border, no grid, no seams, no diamond tile shape, no text. Variant identity ${seed + index}.`,
  }));
}

/**
 * Compatibility wrapper around the legacy editor.
 * - Removes legacy 1px terrain seams.
 * - Replaces the expensive/ambiguous foundation factory workflow with a local
 *   four-blueprint chooser. Blueprint generation is text-only and free.
 * - Only Generate Selected Image calls the image API once.
 */
export default function GameMakerPatched() {
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [foundationKey, setFoundationKey] = useState("grass");
  const [description, setDescription] = useState("A fresh green fantasy grass foundation with subtle natural pixel variation");
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState(1);

  const type = useMemo(() => FOUNDATION_TYPES.find(([key]) => key === foundationKey) ?? FOUNDATION_TYPES[0], [foundationKey]);
  const selectedBlueprint = blueprints.find((blueprint) => blueprint.id === selected) ?? null;

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
      if (!button) return;
      if (button.textContent?.trim().toUpperCase().includes("AI FACTORY")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setFactoryOpen(true);
      }
    };
    document.addEventListener("click", openFactory, true);
    return () => {
      proto.stroke = original;
      document.removeEventListener("click", openFactory, true);
    };
  }, []);

  const generateBlueprints = () => {
    const nextBatch = batch + 1;
    setBatch(nextBatch);
    const next = makeBlueprints(description.trim() || type[2], type[1], Date.now() + nextBatch * 1000);
    setBlueprints(next);
    setSelected(next[0].id);
    setImage(null);
    setError("");
  };

  const generateSelectedImage = async () => {
    if (!selectedBlueprint || generating) return;
    setGenerating(true);
    setError("");
    setImage(null);
    try {
      const response = await fetch("/api/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: selectedBlueprint.prompt, kind: "foundation" }),
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

  const acceptFoundation = () => {
    if (!image) return;
    const key = `ai-${foundationKey}-${Date.now()}`;
    const label = `${type[1]} FOUNDATION`;
    const entry = { key, label, color: "#4b922d", edge: "#4b922d", hint: selectedBlueprint?.label ?? type[2], image, ai: true };
    try {
      const current = JSON.parse(localStorage.getItem(FOUNDATION_LIBRARY_KEY) || "[]");
      const list = Array.isArray(current) ? current : [];
      localStorage.setItem(FOUNDATION_LIBRARY_KEY, JSON.stringify([...list, entry]));
      setFactoryOpen(false);
      window.location.reload();
    } catch {
      setError("Could not save foundation to Library");
    }
  };

  return <>
    <GameMaker />
    {factoryOpen && <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(5,10,18,.94)", overflow: "auto", padding: 24, color: "#eef6ff", fontFamily: "monospace" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", background: "#151f2e", border: "2px solid #3b4c63", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 20 }}>
          <div><h2 style={{ margin: 0, color: "#f2c34d" }}>AI FACTORY · FOUNDATION</h2><div style={{ marginTop: 6, color: "#9fb1c5" }}>Blueprints are free. Only image generation uses a credit.</div></div>
          <button onClick={() => setFactoryOpen(false)}>CLOSE</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginBottom: 16 }}>
          {FOUNDATION_TYPES.map(([key, label, preset]) => <button key={key} onClick={() => { setFoundationKey(key); setDescription(preset); setBlueprints([]); setSelected(null); setImage(null); }} style={{ padding: 12, border: foundationKey === key ? "2px solid #47b9d0" : "1px solid #40546d", background: foundationKey === key ? "#24384d" : "#172435", color: "#fff", fontWeight: 800 }}>{label}</button>)}
        </div>

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

        {error && <div style={{ marginTop: 14, padding: 12, border: "1px solid #d26b5f", color: "#ffd8d2" }}>{error}</div>}
        {image && <div style={{ marginTop: 20 }}><h3>PREVIEW</h3><img src={image} alt="Generated foundation" style={{ width: 280, height: 140, objectFit: "cover", imageRendering: "pixelated", border: "2px solid #47b9d0", display: "block", background: "#111" }} /><div style={{ marginTop: 12, display: "flex", gap: 10 }}><button onClick={generateSelectedImage} disabled={generating}>REGENERATE IMAGE · 1 CREDIT</button><button onClick={acceptFoundation} style={{ padding: "12px 18px", background: "#f6c431", color: "#111827", fontWeight: 900 }}>ACCEPT TO LIBRARY</button></div></div>}
      </div>
    </div>}
  </>;
}
