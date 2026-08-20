import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/ai-asset-test")({ component: AiAssetTest });

function AiAssetTest() {
  const [prompt, setPrompt] = useState("A simple green oak tree for an isometric pixel chat game");
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState("READY");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setStatus("GENERATING WITH OPENAI...");
    setImage(null);
    try {
      const response = await fetch("/api/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = await response.json() as { imageBase64?: string; error?: string };
      if (!response.ok || !payload.imageBase64) throw new Error(payload.error ?? "Generation failed");
      setImage(`data:image/png;base64,${payload.imageBase64}`);
      setStatus("SUCCESS · REAL PNG GENERATED");
    } catch (error) {
      setStatus(`ERROR · ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-3xl border-2 border-border bg-card p-5 shadow-[5px_5px_0_hsl(var(--border))]">
        <h1 className="text-[20px] text-primary">OPENAI AI ASSET TEST</h1>
        <p className="mt-2 text-[9px] text-muted-foreground">REAL API → GPT IMAGE → PNG</p>
        <textarea className="mt-5 min-h-32 w-full border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <button className="pixel-btn mt-4 w-full" disabled={busy} onClick={generate}>{busy ? "GENERATING..." : "GENERATE REAL ASSET"}</button>
        <p className="mt-4 text-[9px] text-muted-foreground">{status}</p>
        {image && <div className="mt-5 border-2 border-border bg-background p-4"><img src={image} alt="Generated asset" className="mx-auto max-h-[512px] [image-rendering:pixelated]" /></div>}
        <a className="pixel-btn mt-5 inline-block" href="/game-maker">BACK TO GAME MAKER</a>
      </section>
    </main>
  );
}
